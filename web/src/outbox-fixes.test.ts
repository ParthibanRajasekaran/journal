// Regressions for the independent review of the outbox candidate (findings 1 to 7 and the owner's
// requirements). Each test names the finding it covers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NewMeal, OTHER_ACCOUNT, api } from "./api";
import {
  DISCARD_KEY,
  GAVE_UP_REASON,
  LIMITED_REASON,
  MAX_ATTEMPTS,
  OUTBOX_KEY,
  QUARANTINE_KEY,
  backoffMs,
  discardAccountDurably,
  discardEntry,
  enqueue,
  flushQueue,
  pendingDeviceCleanup,
  readQueue,
  retryPendingDiscard,
} from "./offline";
import { attemptFor } from "./attempt";
import { sessionOwner, setSessionOwner } from "./session";

const A = "user-a";
const B = "user-b";

const meal = (id: string): NewMeal => ({
  client_id: id,
  meal_type: "lunch",
  eaten_at: "2026-10-31T12:00:00.000Z",
  name: `Dal ${id}`,
  calories: 300,
  protein_g: 12,
  carbs_g: 40,
  fat_g: 8,
  source: "manual",
});

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  setSessionOwner(null);
});

// Finding 2: corrupt stored outbox text used to be quarantined again on every read, and the quarantine grew.
describe("corrupt outbox data", () => {
  it("quarantines the corrupt text once, however many times it is read, and then clears the outbox", () => {
    localStorage.setItem(OUTBOX_KEY, "{not json");
    for (let i = 0; i < 5; i += 1) readQueue(A);

    expect(JSON.parse(localStorage.getItem(QUARANTINE_KEY) ?? "null")).toEqual(["{not json"]);
    expect(localStorage.getItem(OUTBOX_KEY)).toBe("[]");
  });

  it("does not add a malformed record to quarantine again when the same data is read repeatedly", () => {
    enqueue(A, meal("a1"));
    const stored = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
    stored.push({ broken: true });
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(stored));

    for (let i = 0; i < 4; i += 1) expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a1"]);
    expect(JSON.parse(localStorage.getItem(QUARANTINE_KEY) ?? "null")).toEqual([JSON.stringify({ broken: true })]);
  });

  it("keeps the original text until its quarantine copy is verified", () => {
    localStorage.setItem(OUTBOX_KEY, "{not json");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === QUARANTINE_KEY) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });

    expect(readQueue(A)).toEqual([]);
    expect(localStorage.getItem(OUTBOX_KEY)).toBe("{not json");
    expect(enqueue(A, meal("a1"))).toEqual({ ok: false, error: "outbox-unsafe" });
  });
});

// Finding 3 and the owner's requirement: a refused removal is never reported as done, and it is finished later.
describe("removing a deleted account's meals", () => {
  it("reports a refused removal, keeps the obligation, and finishes it on the next start", () => {
    enqueue(A, meal("a1"));
    let refuse = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (refuse && key === OUTBOX_KEY) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });

    expect(discardAccountDurably(A)).toEqual({ ok: false, recorded: true });
    expect(pendingDeviceCleanup()).toBe("pending");
    expect(readQueue(A)).toHaveLength(1);

    // A later start, with storage working again, finishes the removal.
    refuse = false;
    expect(retryPendingDiscard()).toBe(true);
    expect(readQueue(A)).toEqual([]);
    expect(pendingDeviceCleanup()).toBe("none");
    expect(localStorage.getItem(DISCARD_KEY)).toBeNull();
  });

  it("says so when even the record of the obligation cannot be written", () => {
    enqueue(A, meal("a1"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === OUTBOX_KEY || key === DISCARD_KEY) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });

    expect(discardAccountDurably(A)).toEqual({ ok: false, recorded: false });
    expect(pendingDeviceCleanup()).toBe("unrecorded");

    // Storage recovers and the removal succeeds, which clears the warning.
    vi.restoreAllMocks();
    expect(discardAccountDurably(A)).toEqual({ ok: true });
    expect(pendingDeviceCleanup()).toBe("none");
  });

  it("reports success only after the removal reads back", () => {
    enqueue(A, meal("a1"));
    expect(discardAccountDurably(A)).toEqual({ ok: true });
    expect(readQueue(A)).toEqual([]);
    expect(pendingDeviceCleanup()).toBe("none");
  });
});

// The owner's requirement: a retried save of the same meal keeps its client_id, so an ambiguous storage
// result cannot create two meals.
describe("save retries", () => {
  it("stores one meal when the first write's read-back failed and the save is retried", () => {
    let lied = false;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      const value = originalGetItem.call(this, key);
      // The first read-back after a write reports the old value, as if the write had not been kept.
      if (!lied && key === OUTBOX_KEY && value !== null && value.includes("a1")) {
        lied = true;
        return "[]";
      }
      return value;
    });

    expect(enqueue(A, meal("a1")).ok).toBe(false);
    expect(enqueue(A, meal("a1")).ok).toBe(true);
    expect(readQueue(A)).toHaveLength(1);
  });

  it("keeps the same id for an unchanged meal and a new id once the meal changes", () => {
    let counter = 0;
    const newId = () => `id-${(counter += 1)}`;
    const first = attemptFor(null, "meal-x", newId);
    expect(attemptFor(first, "meal-x", newId)).toBe(first);
    const changed = attemptFor(first, "meal-y", newId);
    expect(changed.id).not.toBe(first.id);
  });
});

// Finding 1: the owner check and the server's expected-account header.
describe("owner guard on sends", () => {
  it("does not send when this tab's session has moved to another account (same tab)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setSessionOwner(B);

    await expect(api.createMeal(meal("a1"), () => sessionOwner() === A, A)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the expected account, so the server refuses a shared session that another tab changed", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ detail: OTHER_ACCOUNT }), { status: 409, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    // This tab still believes it is A. The cookie now belongs to B, which only the server can see.
    setSessionOwner(A);

    await expect(api.createMeal(meal("a1"), () => sessionOwner() === A, A)).rejects.toMatchObject({
      status: 409,
      message: OTHER_ACCOUNT,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Journal-Expected-Account"]).toBe(A);
  });
});

// Finding 6 and the owner's requirement: rate limits wait and then block with a reason, and a blocked
// meal can be discarded.
describe("rate limits and blocked meals", () => {
  it("waits between tries after a 429, then blocks with the rate-limit reason", async () => {
    vi.useFakeTimers();
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(429, "Too many requests"));

    await flushAs(A, send);
    expect(readQueue(A)[0].retryAt).toBeGreaterThan(Date.now());

    await vi.advanceTimersByTimeAsync(10 * 60_000 * MAX_ATTEMPTS);
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(readQueue(A)[0]).toMatchObject({ state: "blocked", reason: LIMITED_REASON });
  });

  it("gives transient failures a bounded, growing delay", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(10 * 60_000);
    expect(GAVE_UP_REASON).toMatch(/online/);
  });

  it("lets the user discard one blocked meal and keeps the others", async () => {
    enqueue(A, meal("a1"));
    enqueue(A, meal("a2"));
    const send = vi.fn().mockRejectedValue(new ApiError(422, "Bad fields"));
    await flushAs(A, send);

    expect(readQueue(A).map((e) => e.state)).toEqual(["blocked", "blocked"]);
    expect(discardEntry(A, "a1")).toEqual({ ok: true });
    expect(readQueue(A).map((e) => e.meal.client_id)).toEqual(["a2"]);
  });
});

// Finding 7: the server's 409 text is compared exactly, so the classification must be tested against the
// text the backend really sends. The backend side is in backend/tests/test_expected_account.py.
describe("classification of the server's account refusal", () => {
  it("pauses, rather than blocks, when the server names another account", async () => {
    enqueue(A, meal("a1"));
    const send = vi.fn().mockRejectedValue(new ApiError(409, OTHER_ACCOUNT));
    await flushAs(A, send);
    expect(readQueue(A)[0].state).toBe("pending");
  });
});

// Re-review, blocking finding: a second deletion on the same device must not erase the first account's
// obligation. The owed list keeps both.
describe("two deletions on one device", () => {
  it("keeps the first account owed when a second deletion finishes", () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));
    let refuseA = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      // Refuse only the write that would remove A's meal.
      if (refuseA && key === OUTBOX_KEY && !value.includes("a1")) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });

    expect(discardAccountDurably(A)).toEqual({ ok: false, recorded: true });
    refuseA = false;
    expect(discardAccountDurably(B)).toEqual({ ok: true });

    expect(pendingDeviceCleanup()).toBe("pending");
    expect(readQueue(A)).toHaveLength(1);
    expect(retryPendingDiscard()).toBe(true);
    expect(readQueue(A)).toEqual([]);
    expect(pendingDeviceCleanup()).toBe("none");
  });

  it("does not report pending once an owed account has no meals left", () => {
    enqueue(A, meal("a1"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === OUTBOX_KEY && !value.includes("a1")) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });
    expect(discardAccountDurably(A).ok).toBe(false);
    vi.restoreAllMocks();
    // The meals are removed by another path; the record is now stale.
    discardEntry(A, "a1");
    expect(pendingDeviceCleanup()).toBe("none");
  });
});

// Delta re-review: a failed re-read must never erase another owed account, and rendering must not write.
describe("delta re-review regressions", () => {
  it("a retry that cannot finish keeps every other owed account", () => {
    enqueue(A, meal("a1"));
    enqueue(B, meal("b1"));
    let refuseB = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (refuseB && key === OUTBOX_KEY && !value.includes("b1")) throw new Error("quota exceeded");
      return originalSetItem.call(this, key, value);
    });
    discardAccountDurably(A);
    discardAccountDurably(B);
    refuseB = false;
    expect(retryPendingDiscard()).toBe(true);
    expect(readQueue(A)).toEqual([]);
    expect(readQueue(B)).toEqual([]);
  });

  it("reports unrecorded, and writes nothing, when the outbox cannot be read", () => {
    localStorage.setItem(OUTBOX_KEY, "{not json");
    const before = localStorage.getItem(QUARANTINE_KEY);
    localStorage.setItem(DISCARD_KEY, JSON.stringify([A]));
    expect(pendingDeviceCleanup()).toBe("unrecorded");
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(before);
    expect(localStorage.getItem(OUTBOX_KEY)).toBe("{not json");
  });
});
