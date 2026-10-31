import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NewMeal } from "./api";
import {
  MAX_ATTEMPTS,
  OUTBOX_KEY,
  QUARANTINE_KEY,
  discardOwner,
  enqueue,
  flushQueue,
  quarantineLegacy,
  readQueue,
  retryBlocked,
} from "./offline";
import { setSessionOwner } from "./session";

const A = "user-a";
const B = "user-b";
const LEGACY_KEY = "journal.pending-meals";

const meal = (id: string): NewMeal => ({
  client_id: id,
  meal_type: "lunch",
  eaten_at: "2026-10-31T12:00:00.000Z",
  name: "Dal",
  calories: 300,
  protein_g: 12,
  carbs_g: 40,
  fat_g: 8,
  source: "manual",
});

// A stand-in server. It keeps one meal per client_id, as the real API does.
function fakeServer() {
  const stored = new Map<string, NewMeal>();
  const send = vi.fn(async (m: NewMeal) => {
    stored.set(m.client_id, m);
    return m;
  });
  return { stored, send };
}

// Flushes as the account that owns the session, which is what the app does after sign-in.
function flushAs(owner: string, send: Parameters<typeof flushQueue>[1]) {
  setSessionOwner(owner);
  return flushQueue(owner, send);
}

const originalSetItem = Storage.prototype.setItem;
const originalGetItem = Storage.prototype.getItem;

beforeEach(() => {
  localStorage.clear();
  setSessionOwner(null);
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  setSessionOwner(null);
});

describe("account-scoped outbox", () => {
  it("does not send account A's meal while account B owns the session", async () => {
    enqueue(A, meal("a1"));
    const server = fakeServer();

    expect(await flushAs(B, server.send)).toBe(0);
    expect(server.send).not.toHaveBeenCalled();
    expect(readQueue(A)).toHaveLength(1);
  });

  it("sends only account A's meals when A owns the session again", async () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));
    const server = fakeServer();

    expect(await flushAs(A, server.send)).toBe(1);
    expect(server.send.mock.calls.map(([m]) => m.client_id)).toEqual(["a1"]);
    expect(readQueue(B)).toHaveLength(1);
  });

  it("sends nothing when no account is signed in", async () => {
    enqueue(A, meal("a1"));
    const server = fakeServer();

    expect(await flushQueue(null, server.send)).toBe(0);
    expect(server.send).not.toHaveBeenCalled();
  });

  it("removes a meal only after the server has accepted it", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const server = fakeServer();

    expect(await flushAs(A, server.send)).toBe(2);
    expect(readQueue(A)).toEqual([]);
    expect(server.stored.size).toBe(2);
  });

  it("keeps a meal once even if it is queued twice", () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a1"));
    expect(readQueue(A)).toHaveLength(1);
  });
});

describe("account switch while a request is in flight", () => {
  it("stops after the in-flight request and never sends A's remaining meals under B", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const server = fakeServer();
    let finishFirst!: (value: unknown) => void;
    const send = vi.fn((m: NewMeal) => {
      if (m.client_id === "a1") {
        // The first request is already on its way, under A's session.
        return new Promise((resolve) => {
          finishFirst = () => resolve(m);
        });
      }
      return server.send(m);
    });

    const running = flushAs(A, send);
    // B signs in while A's first request is still in flight.
    setSessionOwner(B);
    finishFirst({});
    await running;

    expect(send.mock.calls.map(([m]) => m.client_id)).toEqual(["a1"]);
    expect(server.stored.has("a2")).toBe(false);
    // A's meals stay queued for A, and nothing was dropped.
    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a2"]);
  });

  it("hands the guard to the sender so a resend can be refused", async () => {
    enqueue(A, meal("a1"));
    const seen: boolean[] = [];
    const send = vi.fn(async (_m: NewMeal, guard: () => boolean) => {
      seen.push(guard());
      setSessionOwner(B);
      seen.push(guard());
      return {};
    });

    await flushAs(A, send);
    expect(seen).toEqual([true, false]);
  });

  it("pauses without retrying when the send reports a stale session", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(401, "The signed-in account changed. This request was not sent."));

    await flushAs(A, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(readQueue(A)[0].state).toBe("pending");
    expect(readQueue(A)[0].attempts).toBe(0);
  });
});

describe("saving on this device", () => {
  it("reports failure when storage refuses the write, and keeps nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    const result = enqueue(A, meal("a1"));

    expect(result).toEqual({ ok: false, error: "storage-unavailable" });
    expect(readQueue(A)).toEqual([]);
  });

  it("reports failure when the write is accepted but not kept", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => "[]");

    expect(enqueue(A, meal("a1"))).toEqual({ ok: false, error: "storage-unavailable" });
  });

  it("keeps earlier waiting meals when a later save fails", () => {
    expect(enqueue(A, meal("a1"))).toEqual({ ok: true });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(enqueue(A, meal("a2")).ok).toBe(false);
    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a1"]);
  });
});

describe("lost responses and concurrency", () => {
  it("creates one server meal when the response is lost after the server saved it", async () => {
    enqueue(A, meal("a1"));
    const server = fakeServer();
    server.send.mockImplementationOnce(async (m: NewMeal) => {
      server.stored.set(m.client_id, m);
      throw new ApiError(0, "Can't reach Journal right now.");
    });

    expect(await flushAs(A, server.send)).toBe(0);
    expect(readQueue(A)).toHaveLength(1);

    expect(await flushAs(A, server.send)).toBe(1);
    expect(server.stored.size).toBe(1);
    expect(readQueue(A)).toEqual([]);
  });

  it("does not send the same meal twice when two flushes run at once", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const server = fakeServer();
    setSessionOwner(A);

    const [first, second] = await Promise.all([flushQueue(A, server.send), flushQueue(A, server.send)]);

    expect(server.send).toHaveBeenCalledTimes(2);
    expect(first + second).toBeGreaterThanOrEqual(2);
    expect(readQueue(A)).toEqual([]);
  });

  it("sends a meal queued while a flush is running", async () => {
    enqueue(A, meal("a1"));
    const server = fakeServer();
    let release!: () => void;
    server.send.mockImplementationOnce(
      (m: NewMeal) =>
        new Promise((resolve) => {
          release = () => resolve(m);
        }),
    );
    setSessionOwner(A);

    const running = flushQueue(A, server.send);
    enqueue(A, meal("a2"));
    const second = flushQueue(A, server.send);
    release();
    await Promise.all([running, second]);

    expect(server.stored.has("a2")).toBe(true);
    expect(readQueue(A)).toEqual([]);
  });
});

describe("pausing and blocking", () => {
  it("pauses on an expired session and keeps the meal", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const send = vi.fn().mockRejectedValue(new ApiError(401, "Sign in again."));

    expect(await flushAs(A, send)).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(readQueue(A).map((e) => e.state)).toEqual(["pending", "pending"]);
  });

  it("shows a refused meal as blocked instead of retrying it forever", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(422, "Calories must be a number."));

    await flushAs(A, send);
    await flushAs(A, send);

    expect(send).toHaveBeenCalledTimes(1);
    const [entry] = readQueue(A);
    expect(entry.state).toBe("blocked");
    expect(entry.reason).toBe("Calories must be a number.");
  });

  it("blocks a meal after the bounded number of transient failures", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(503, "Unavailable"));

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) await flushAs(A, send);

    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(readQueue(A)[0].state).toBe("blocked");
    await flushAs(A, send);
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("sends a blocked meal again after the user asks", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValueOnce(new ApiError(422, "Bad")).mockResolvedValue({});
    await flushAs(A, send);

    expect(retryBlocked(A)).toEqual({ ok: true });
    expect(await flushAs(A, send)).toBe(1);
    expect(readQueue(A)).toEqual([]);
  });
});

describe("account deletion", () => {
  it("removes a deleted account's queued meals so they cannot come back", async () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));

    expect(discardOwner(A)).toEqual({ ok: true });
    const server = fakeServer();
    await flushAs(A, server.send);

    expect(server.send).not.toHaveBeenCalled();
    expect(readQueue(B)).toHaveLength(1);
  });
});

describe("quarantine is verified before anything is removed", () => {
  it("removes the legacy queue only after the quarantine copy is read back", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([meal("old")]));

    expect(quarantineLegacy()).toBe(1);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(QUARANTINE_KEY)).toContain("old");
  });

  it("keeps the legacy queue when the quarantine cannot be written", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([meal("old")]));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === QUARANTINE_KEY) throw new DOMException("full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    expect(quarantineLegacy()).toBe(0);
    expect(localStorage.getItem(LEGACY_KEY)).toContain("old");
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull();
  });

  it("keeps the legacy queue when the quarantine reads back different text", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([meal("old")]));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === QUARANTINE_KEY) return "[]";
      return originalGetItem.call(this, key);
    });

    expect(quarantineLegacy()).toBe(0);
    expect(localStorage.getItem(LEGACY_KEY)).toContain("old");
  });

  it("never overwrites a damaged quarantine, so its contents are not destroyed", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([meal("old")]));
    localStorage.setItem(QUARANTINE_KEY, "{damaged");

    expect(quarantineLegacy()).toBe(0);
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe("{damaged");
    expect(localStorage.getItem(LEGACY_KEY)).toContain("old");
  });

  it("never sends entries from the old unowned queue", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([meal("old")]));
    const server = fakeServer();

    quarantineLegacy();
    await flushAs(A, server.send);

    expect(server.send).not.toHaveBeenCalled();
  });
});

describe("malformed outbox entries", () => {
  const validEntry = { owner: A, meal: meal("a1"), state: "pending", attempts: 0 };

  it("moves malformed entries aside and keeps valid ones", () => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([validEntry, { owner: "", meal: null }]));

    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a1"]);
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]")).toHaveLength(1);
    const quarantined = JSON.parse(localStorage.getItem(QUARANTINE_KEY) ?? "[]") as string[];
    expect(quarantined).toHaveLength(1);
    expect(JSON.parse(quarantined[0])).toEqual({ owner: "", meal: null });
  });

  it("leaves the outbox byte-for-byte unchanged when the quarantine write fails", () => {
    const original = JSON.stringify([validEntry, { owner: "", meal: null }]);
    localStorage.setItem(OUTBOX_KEY, original);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === QUARANTINE_KEY) throw new DOMException("full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a1"]);
    expect(localStorage.getItem(OUTBOX_KEY)).toBe(original);
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull();
  });

  it("survives a corrupted outbox and keeps the damaged text", () => {
    localStorage.setItem(OUTBOX_KEY, "{not json");

    expect(readQueue(A)).toEqual([]);
    expect(localStorage.getItem(QUARANTINE_KEY)).toContain("{not json");
  });
});
