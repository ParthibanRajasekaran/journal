// Meals that could not be sent because the connection dropped. Every entry belongs to the account
// that created it, and is only ever sent while that same account owns the session. Each meal keeps
// its client_id, so the server answers a repeat with the meal it already has and never saves it twice.
import { api, ApiError, NewMeal, OTHER_ACCOUNT } from "./api";
import { sessionOwner } from "./session";

export const OUTBOX_KEY = "journal.outbox.v2";
// The original queue had no owner, so its entries cannot be attributed safely. It is moved aside
// and never sent. See quarantineLegacy().
const LEGACY_KEY = "journal.pending-meals";
export const QUARANTINE_KEY = "journal.quarantine.v1";
// Records the account whose queued meals must still be removed from this device. Written before the
// removal starts, so a removal that storage refused is retried on the next start.
export const DISCARD_KEY = "journal.discard-pending.v1";
// Transient failures (no connection, timeouts, server errors, rate limits) are retried this many times
// in total before the entry is shown as blocked and waits for the user.
export const MAX_ATTEMPTS = 5;
// Fired whenever the stored outbox changes, so screens can show the current count.
export const OUTBOX_EVENT = "journal:outbox";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;
export const GAVE_UP_REASON = "Couldn't reach Journal after several tries. Try again when you're online.";
export const LIMITED_REASON = "Journal is limiting requests right now. It will try again, or you can try again now.";

// How long a transient failure waits before the next try: 30 s, 60 s, 2 min, 4 min, then 10 min at most.
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

export type EntryState = "pending" | "blocked";

export interface OutboxEntry {
  owner: string;
  meal: NewMeal;
  state: EntryState;
  attempts: number;
  // Earliest time (ms since epoch) the next try may happen after a transient failure.
  retryAt?: number;
  reason?: string;
}

// "outbox-unsafe": a record could not be copied to a verified quarantine, so the stored outbox must not be
// rewritten. Rewriting would drop that record.
export type CommitResult = { ok: true } | { ok: false; error: "storage-unavailable" | "outbox-unsafe" };
// `guard` returns false once the session belongs to someone else. The sender must check it before
// any resend, so a meal cannot be replayed under another account.
// `expected` is the account the meal was queued for. The server refuses the write if the session is another account.
export type SendMeal = (meal: NewMeal, guard: () => boolean, expected: string) => Promise<unknown>;

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

// Writes the quarantine and reads it back. Returns true only when every item is durably there. A
// damaged quarantine is never overwritten, because that would destroy the only copy of its contents.
// Items already in quarantine are not added again, so reading the same damaged data repeatedly does
// not grow the quarantine.
function quarantine(items: string[]): boolean {
  const store = storage();
  if (!store) return false;
  if (items.length === 0) return true;
  let existing: unknown[];
  try {
    const raw = store.getItem(QUARANTINE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    existing = parsed;
  } catch {
    return false;
  }
  const seen = new Set(existing.map((item) => (typeof item === "string" ? item : JSON.stringify(item))));
  const fresh = items.filter((item) => !seen.has(item));
  if (fresh.length === 0) return true;
  const text = JSON.stringify([...existing, ...fresh]);
  try {
    store.setItem(QUARANTINE_KEY, text);
    return store.getItem(QUARANTINE_KEY) === text;
  } catch {
    return false;
  }
}

interface OutboxRead {
  entries: OutboxEntry[];
  // False when the stored text holds records that are not yet safely copied. Nothing may be
  // written, and nothing may be sent, until the copy is verified.
  safe: boolean;
}

// The stored text is replaced only after the damaged part has been copied to quarantine and read back.
// If the copy cannot be verified, the stored text is left exactly as it was and the read is marked unsafe.
function quarantineThenClear(raw: string): OutboxRead {
  if (!quarantine([raw])) return { entries: [], safe: false };
  const cleared = commit([]);
  return { entries: [], safe: cleared.ok };
}

// Reads every entry. Anything that is not a valid entry is copied to quarantine first.
function readOutbox(): OutboxRead {
  const store = storage();
  if (!store) return { entries: [], safe: false };
  let raw: string | null;
  try {
    raw = store.getItem(OUTBOX_KEY);
  } catch {
    return { entries: [], safe: false };
  }
  if (raw === null) return { entries: [], safe: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return quarantineThenClear(raw);
  }
  if (!Array.isArray(parsed)) return quarantineThenClear(raw);
  const valid = parsed.filter(isEntry);
  const malformed = parsed.filter((item) => !isEntry(item));
  if (malformed.length === 0) return { entries: valid, safe: true };
  if (!quarantine(malformed.map((item) => JSON.stringify(item)))) {
    return { entries: valid, safe: false };
  }
  // The malformed records are now verified in quarantine, so the stored text may drop them.
  const rewritten = commit(valid);
  return { entries: valid, safe: rewritten.ok };
}

// Every outbox mutation goes through here. It refuses while the stored outbox is unsafe.
function mutate(change: (entries: OutboxEntry[]) => OutboxEntry[]): CommitResult {
  const read = readOutbox();
  if (!read.safe) return { ok: false, error: "outbox-unsafe" };
  return commit(change(read.entries));
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

// Moves the old, unowned queue out of the way. Its entries are kept but never sent, because the
// old queue did not record whose meals they were. The original is removed only after the quarantine
// copy has been verified. Returns the number of entries moved (0 if nothing moved).
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
  if (!quarantine([raw])) return 0;
  let count = 1;
  try {
    const parsed: unknown = JSON.parse(raw);
    count = Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    count = 1;
  }
  try {
    store.removeItem(LEGACY_KEY);
  } catch {
    // The verified copy is already in quarantine, so a leftover original is harmless and retried next time.
  }
  return count;
}

// Entries for one account, pending or blocked.
export function readQueue(owner: string | null): OutboxEntry[] {
  if (!owner) return [];
  return readOutbox().entries.filter((e) => e.owner === owner);
}

export function enqueue(owner: string, meal: NewMeal): CommitResult {
  return mutate((entries) => [
    ...entries.filter((e) => !(e.owner === owner && e.meal.client_id === meal.client_id)),
    { owner, meal, state: "pending", attempts: 0 },
  ]);
}

// Removes one meal the user has chosen to discard.
export function discardEntry(owner: string, clientId: string): CommitResult {
  return mutate((entries) => entries.filter((e) => !(e.owner === owner && e.meal.client_id === clientId)));
}

// Removes one account's entries. Used when the account is deleted, so queued meals cannot come back.
export function discardOwner(owner: string): CommitResult {
  return mutate((entries) => entries.filter((e) => e.owner !== owner));
}

// Set when the account's removal was refused and the refusal could not be recorded either.
let unrecordedCleanup: string | null = null;

function readDiscardRecord(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DISCARD_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { owner?: unknown };
    return typeof parsed.owner === "string" ? parsed.owner : null;
  } catch {
    return null;
  }
}

function recordDiscard(owner: string): boolean {
  const store = storage();
  if (!store) return false;
  const text = JSON.stringify({ owner });
  try {
    store.setItem(DISCARD_KEY, text);
    return store.getItem(DISCARD_KEY) === text;
  } catch {
    return false;
  }
}

function clearDiscardRecord(owner: string): void {
  if (readDiscardRecord() !== owner) return;
  try {
    storage()?.removeItem(DISCARD_KEY);
  } catch {
    // A leftover record only means one more harmless retry, which finds nothing to remove.
  }
}

export type DiscardResult = { ok: true } | { ok: false; recorded: boolean };

// Removes a deleted account's queued meals from this device. Success is reported only when the
// removal has been read back. On failure the obligation is recorded, so retryPendingDiscard() can
// finish it after a restart; if even the record cannot be written, pendingDeviceCleanup() says so.
export function discardAccountDurably(owner: string): DiscardResult {
  const recorded = recordDiscard(owner);
  const result = discardOwner(owner);
  if (result.ok) {
    clearDiscardRecord(owner);
    if (unrecordedCleanup === owner) unrecordedCleanup = null;
    return { ok: true };
  }
  unrecordedCleanup = recorded ? null : owner;
  return { ok: false, recorded };
}

// Runs at start-up. Finishes a removal that an earlier run could not complete. Returns true when
// nothing is left to remove.
export function retryPendingDiscard(): boolean {
  const owner = readDiscardRecord();
  if (owner === null) return true;
  const result = discardOwner(owner);
  if (!result.ok) return false;
  clearDiscardRecord(owner);
  if (unrecordedCleanup === owner) unrecordedCleanup = null;
  return true;
}

// What the sign-in screen must say about this device's data for a deleted account.
export type DeviceCleanup = "none" | "pending" | "unrecorded";
export function pendingDeviceCleanup(): DeviceCleanup {
  if (readDiscardRecord() !== null) return "pending";
  if (unrecordedCleanup !== null) return "unrecorded";
  return "none";
}

// Puts blocked entries back in line, for example after the user has fixed the problem.
export function retryBlocked(owner: string): CommitResult {
  return mutate((entries) =>
    entries.map((e) =>
      e.owner === owner && e.state === "blocked" ? { ...e, state: "pending", attempts: 0, retryAt: undefined, reason: undefined } : e,
    ),
  );
}

// Decides what a failed send means for the entry.
//   "pause": the account needs to sign in again, or the session changed. Stop sending for everyone.
//   "retry": a transient problem; try again after a delay, up to MAX_ATTEMPTS. `limited` marks a rate limit.
//   "block": the server refused this meal; the user must act.
type Verdict = { kind: "pause" } | { kind: "retry"; limited: boolean } | { kind: "block"; reason: string };
function classify(err: unknown): Verdict {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return { kind: "pause" };
    // Another account owns the session. The meal stays queued for its own account; it is not invalid.
    if (err.status === 409 && err.message === OTHER_ACCOUNT) return { kind: "pause" };
    if (err.status === 429) return { kind: "retry", limited: true };
    if (err.status === 0 || err.status === 408 || err.status >= 500) return { kind: "retry", limited: false };
    if (err.status === 409 && err.message === "Retry the request.") return { kind: "retry", limited: false };
    return { kind: "block", reason: err.message };
  }
  return { kind: "retry", limited: false };
}

function update(owner: string, clientId: string, change: (e: OutboxEntry) => OutboxEntry | null): void {
  mutate((entries) => {
    const next: OutboxEntry[] = [];
    for (const e of entries) {
      if (e.owner === owner && e.meal.client_id === clientId) {
        const replaced = change(e);
        if (replaced) next.push(replaced);
      } else {
        next.push(e);
      }
    }
    return next;
  });
}

// Schedules the next pass for an account after a transient failure. One timer per account.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// The retry uses the same sender as the failed attempt, so a retry never goes somewhere else.
function scheduleRetry(owner: string, delay: number, send: SendMeal): void {
  if (typeof window === "undefined") return;
  clearTimeout(timers.get(owner));
  timers.set(
    owner,
    setTimeout(() => {
      timers.delete(owner);
      void flushQueue(owner, send);
    }, delay),
  );
}

async function sendPending(owner: string, send: SendMeal): Promise<number> {
  const stillOwner = () => sessionOwner() === owner;
  // Sending removes entries afterwards. If the outbox is unsafe, that removal could drop a record, so nothing is sent.
  if (!readOutbox().safe) return 0;
  let sent = 0;
  for (const entry of readQueue(owner)) {
    if (entry.state !== "pending") continue;
    // A transient failure set this entry aside until its delay has passed.
    if (entry.retryAt !== undefined && entry.retryAt > Date.now()) continue;
    // Check before every send: the session may have changed while an earlier request was in flight.
    if (!stillOwner()) break;
    try {
      await send(entry.meal, stillOwner, owner);
    } catch (err) {
      const verdict = classify(err);
      if (verdict.kind === "pause") break;
      if (verdict.kind === "retry") {
        const { limited } = verdict;
        let delay = 0;
        update(owner, entry.meal.client_id, (e) => {
          const attempts = e.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            return { ...e, attempts, state: "blocked", retryAt: undefined, reason: limited ? LIMITED_REASON : GAVE_UP_REASON };
          }
          delay = backoffMs(attempts);
          return { ...e, attempts, retryAt: Date.now() + delay };
        });
        if (delay > 0) scheduleRetry(owner, delay, send);
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

// Sends the signed-in account's waiting meals. Does nothing when no account is signed in, and stops
// as soon as the session belongs to a different account.
export function flushQueue(owner: string | null, send: SendMeal = (m, guard, expected) => api.createMeal(m, guard, expected)): Promise<number> {
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
      } while (slot.again && sessionOwner() === owner);
    } finally {
      inFlight.delete(owner);
    }
    return sent;
  })();
  inFlight.set(owner, slot);
  return slot.promise;
}
