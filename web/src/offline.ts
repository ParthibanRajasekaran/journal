// Meals that could not be sent because the connection dropped. Every entry belongs to the account
// that created it, and is only ever sent while that same account is signed in. Each meal keeps its
// client_id, so the server answers a repeat with the meal it already has and never saves it twice.
import { api, ApiError, NewMeal } from "./api";

export const OUTBOX_KEY = "journal.outbox.v2";
// The original queue had no owner, so its entries cannot be attributed safely. It is moved aside
// and never sent. See quarantineLegacy().
const LEGACY_KEY = "journal.pending-meals";
const QUARANTINE_KEY = "journal.quarantine.v1";
// Transient failures (no connection, timeouts, server errors) are retried this many times in total
// before the entry is shown as blocked and waits for the user.
export const MAX_ATTEMPTS = 5;
// Fired whenever the stored outbox changes, so screens can show the current count.
export const OUTBOX_EVENT = "journal:outbox";

export type EntryState = "pending" | "blocked";

export interface OutboxEntry {
  owner: string;
  meal: NewMeal;
  state: EntryState;
  attempts: number;
  reason?: string;
}

export type CommitResult = { ok: true } | { ok: false; error: "storage-unavailable" };
export type SendMeal = (meal: NewMeal) => Promise<unknown>;

function isEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<OutboxEntry>;
  return (
    typeof e.owner === "string" &&
    e.owner.length > 0 &&
    typeof e.meal === "object" &&
    e.meal !== null &&
    typeof e.meal.client_id === "string" &&
    (e.state === "pending" || e.state === "blocked") &&
    typeof e.attempts === "number"
  );
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// Reads every entry. Anything that is not a valid entry is moved to quarantine rather than dropped
// or guessed at, so no unsynced work is silently lost.
function readAll(): OutboxEntry[] {
  const store = storage();
  if (!store) return [];
  let raw: string | null;
  try {
    raw = store.getItem(OUTBOX_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine([raw]);
    return [];
  }
  if (!Array.isArray(parsed)) {
    quarantine([raw]);
    return [];
  }
  const valid = parsed.filter(isEntry);
  if (valid.length !== parsed.length) {
    quarantine(parsed.filter((item) => !isEntry(item)).map((item) => JSON.stringify(item)));
    commit(valid);
  }
  return valid;
}

// Writes the whole outbox and reads it back. A write that the browser accepted but did not keep
// (or refused, for example when storage is full) is reported as a failure, never as saved.
function commit(entries: OutboxEntry[]): CommitResult {
  const store = storage();
  if (!store) return { ok: false, error: "storage-unavailable" };
  const text = JSON.stringify(entries);
  try {
    store.setItem(OUTBOX_KEY, text);
    if (store.getItem(OUTBOX_KEY) !== text) return { ok: false, error: "storage-unavailable" };
  } catch {
    return { ok: false, error: "storage-unavailable" };
  }
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  return { ok: true };
}

// Kept as text so it can be recovered by support if needed. It is never imported into an account.
function quarantine(items: string[]): void {
  const store = storage();
  if (!store || items.length === 0) return;
  try {
    const existing: unknown = JSON.parse(store.getItem(QUARANTINE_KEY) ?? "[]");
    const list = Array.isArray(existing) ? existing : [];
    store.setItem(QUARANTINE_KEY, JSON.stringify([...list, ...items]));
  } catch {
    // If even quarantine cannot be written, leave the original data where it is.
  }
}

// Moves the old, unowned queue out of the way. Its entries are kept but never sent, because the
// old queue did not record whose meals they were.
export function quarantineLegacy(): number {
  const store = storage();
  if (!store) return 0;
  let raw: string | null;
  try {
    raw = store.getItem(LEGACY_KEY);
  } catch {
    return 0;
  }
  if (raw === null) return 0;
  let count = 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    count = Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    count = 1;
  }
  quarantine([raw]);
  try {
    store.removeItem(LEGACY_KEY);
  } catch {
    // The entries are already in quarantine, so a leftover copy is harmless.
  }
  return count;
}

// Entries for one account, pending or blocked.
export function readQueue(owner: string | null): OutboxEntry[] {
  if (!owner) return [];
  return readAll().filter((e) => e.owner === owner);
}

export function enqueue(owner: string, meal: NewMeal): CommitResult {
  const others = readAll().filter((e) => !(e.owner === owner && e.meal.client_id === meal.client_id));
  return commit([...others, { owner, meal, state: "pending", attempts: 0 }]);
}

// Removes one account's entries. Used when the account is deleted, so queued meals cannot come back.
export function discardOwner(owner: string): CommitResult {
  return commit(readAll().filter((e) => e.owner !== owner));
}

// Puts blocked entries back in line, for example after the user has fixed the problem.
export function retryBlocked(owner: string): CommitResult {
  return commit(
    readAll().map((e) => (e.owner === owner && e.state === "blocked" ? { ...e, state: "pending", attempts: 0, reason: undefined } : e)),
  );
}

// Decides what a failed send means for the entry.
//   "pause": the account needs to sign in again, so stop sending for everyone.
//   "retry": a transient problem; try again later, up to MAX_ATTEMPTS.
//   "block": the server refused this meal; the user must act.
function classify(err: unknown): { kind: "pause" } | { kind: "retry" } | { kind: "block"; reason: string } {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return { kind: "pause" };
    if (err.status === 0 || err.status === 408 || err.status >= 500) return { kind: "retry" };
    if (err.status === 409 && err.message === "Retry the request.") return { kind: "retry" };
    return { kind: "block", reason: err.message };
  }
  return { kind: "retry" };
}

function update(owner: string, clientId: string, change: (e: OutboxEntry) => OutboxEntry | null): void {
  const next: OutboxEntry[] = [];
  for (const e of readAll()) {
    if (e.owner === owner && e.meal.client_id === clientId) {
      const replaced = change(e);
      if (replaced) next.push(replaced);
    } else {
      next.push(e);
    }
  }
  commit(next);
}

async function sendPending(owner: string, send: SendMeal): Promise<number> {
  let sent = 0;
  for (const entry of readQueue(owner)) {
    if (entry.state !== "pending") continue;
    try {
      await send(entry.meal);
    } catch (err) {
      const verdict = classify(err);
      if (verdict.kind === "pause") break;
      if (verdict.kind === "retry") {
        update(owner, entry.meal.client_id, (e) => {
          const attempts = e.attempts + 1;
          return attempts >= MAX_ATTEMPTS
            ? { ...e, attempts, state: "blocked", reason: "Couldn't reach Journal after several tries. Retry when you're online." }
            : { ...e, attempts };
        });
        break;
      }
      update(owner, entry.meal.client_id, (e) => ({ ...e, state: "blocked", reason: verdict.reason }));
      continue;
    }
    // The server has the meal. Remove it, unless it was discarded while the request was in flight.
    update(owner, entry.meal.client_id, () => null);
    sent += 1;
  }
  return sent;
}

// One flush per account at a time. A call made during a flush asks for another pass, so meals
// queued meanwhile are sent without starting a second loop.
const inFlight = new Map<string, { again: boolean; promise: Promise<number> }>();

// Sends the signed-in account's waiting meals. Does nothing when no account is signed in, so
// entries are never replayed under a different login.
export function flushQueue(owner: string | null, send: SendMeal = (m) => api.createMeal(m)): Promise<number> {
  if (!owner) return Promise.resolve(0);
  const running = inFlight.get(owner);
  if (running) {
    running.again = true;
    return running.promise;
  }
  const slot: { again: boolean; promise: Promise<number> } = { again: false, promise: Promise.resolve(0) };
  slot.promise = (async () => {
    let sent = 0;
    try {
      do {
        slot.again = false;
        sent += await sendPending(owner, send);
      } while (slot.again);
    } finally {
      inFlight.delete(owner);
    }
    return sent;
  })();
  inFlight.set(owner, slot);
  return slot.promise;
}
