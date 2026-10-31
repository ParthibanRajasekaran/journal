import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NewMeal } from "./api";
import {
  MAX_ATTEMPTS,
  OUTBOX_KEY,
  discardOwner,
  enqueue,
  flushQueue,
  quarantineLegacy,
  readQueue,
  retryBlocked,
} from "./offline";

const A = "user-a";
const B = "user-b";

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

// A stand-in server. It keeps one meal per client_id, as the real API does, and answers a repeat
// with the meal it already has.
function fakeServer() {
  const stored = new Map<string, NewMeal>();
  const send = vi.fn(async (m: NewMeal) => {
    stored.set(m.client_id, m);
    return m;
  });
  return { stored, send };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("account-scoped outbox", () => {
  it("does not send account A's meal while account B is signed in", async () => {
    enqueue(A, meal("a1"));
    const server = fakeServer();

    expect(await flushQueue(B, server.send)).toBe(0);
    expect(server.send).not.toHaveBeenCalled();
    expect(readQueue(A)).toHaveLength(1);
  });

  it("sends only account A's meals when A signs in again", async () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));
    const server = fakeServer();

    expect(await flushQueue(A, server.send)).toBe(1);
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

    expect(await flushQueue(A, server.send)).toBe(2);
    expect(readQueue(A)).toEqual([]);
    expect(server.stored.size).toBe(2);
  });

  it("keeps a meal once even if it is queued twice", () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a1"));
    expect(readQueue(A)).toHaveLength(1);
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
    // The first request reaches the server and is saved, but the connection drops before the reply.
    server.send.mockImplementationOnce(async (m: NewMeal) => {
      server.stored.set(m.client_id, m);
      throw new ApiError(0, "Can't reach Journal right now.");
    });

    expect(await flushQueue(A, server.send)).toBe(0);
    expect(readQueue(A)).toHaveLength(1);

    expect(await flushQueue(A, server.send)).toBe(1);
    expect(server.stored.size).toBe(1);
    expect(readQueue(A)).toEqual([]);
  });

  it("does not send the same meal twice when two flushes run at once", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const server = fakeServer();

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

    expect(await flushQueue(A, send)).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(readQueue(A).map((e) => e.state)).toEqual(["pending", "pending"]);
  });

  it("shows a refused meal as blocked instead of retrying it forever", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(422, "Calories must be a number."));

    await flushQueue(A, send);
    await flushQueue(A, send);

    expect(send).toHaveBeenCalledTimes(1);
    const [entry] = readQueue(A);
    expect(entry.state).toBe("blocked");
    expect(entry.reason).toBe("Calories must be a number.");
  });

  it("blocks a meal after the bounded number of transient failures", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(503, "Unavailable"));

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) await flushQueue(A, send);

    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(readQueue(A)[0].state).toBe("blocked");
    await flushQueue(A, send);
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("sends a blocked meal again after the user asks", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValueOnce(new ApiError(422, "Bad")).mockResolvedValue({});
    await flushQueue(A, send);

    expect(retryBlocked(A)).toEqual({ ok: true });
    expect(await flushQueue(A, send)).toBe(1);
    expect(readQueue(A)).toEqual([]);
  });
});

describe("account deletion", () => {
  it("removes a deleted account's queued meals so they cannot come back", async () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));

    expect(discardOwner(A)).toEqual({ ok: true });
    const server = fakeServer();
    await flushQueue(A, server.send);

    expect(server.send).not.toHaveBeenCalled();
    expect(readQueue(B)).toHaveLength(1);
  });
});

describe("legacy and damaged storage", () => {
  it("never sends entries from the old unowned queue", async () => {
    localStorage.setItem("journal.pending-meals", JSON.stringify([meal("old")]));
    const server = fakeServer();

    expect(quarantineLegacy()).toBe(1);
    await flushQueue(A, server.send);

    expect(server.send).not.toHaveBeenCalled();
    expect(localStorage.getItem("journal.pending-meals")).toBeNull();
    expect(localStorage.getItem("journal.quarantine.v1")).toContain("old");
  });

  it("survives a corrupted outbox and keeps the damaged text", () => {
    localStorage.setItem(OUTBOX_KEY, "{not json");

    expect(readQueue(A)).toEqual([]);
    expect(localStorage.getItem("journal.quarantine.v1")).toContain("{not json");
  });

  it("drops only invalid entries and keeps valid ones", () => {
    enqueue(A, meal("a1"));
    const current = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([...current, { owner: "", meal: null }]));

    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a1"]);
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]")).toHaveLength(1);
  });
});
