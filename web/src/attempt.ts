// One Save attempt keeps one client_id for as long as the meal stays the same. A retry after an
// ambiguous storage result (the write may have happened) then sends the same id, so the outbox and the
// server both recognise it as the meal they already have. A changed meal gets a new id.
export interface Attempt {
  id: string;
  key: string;
}

// `key` describes the meal content, without the id. Returns the attempt to use for this save.
export function attemptFor(current: Attempt | null, key: string, newId: () => string): Attempt {
  if (current !== null && current.key === key) return current;
  return { id: newId(), key };
}

// The attempt is also kept for this browser session, so leaving the form and coming back does not
// change the id of an unchanged meal whose save outcome was unclear.
const attemptKey = (owner: string) => `journal.save-attempt.v1:${owner}`;

export function readStoredAttempt(owner: string): Attempt | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(attemptKey(owner)) ?? "null") as Partial<Attempt> | null;
    return parsed && typeof parsed.id === "string" && typeof parsed.key === "string" ? { id: parsed.id, key: parsed.key } : null;
  } catch {
    return null;
  }
}

export function writeStoredAttempt(owner: string, attempt: Attempt | null): void {
  try {
    if (attempt) sessionStorage.setItem(attemptKey(owner), JSON.stringify(attempt));
    else sessionStorage.removeItem(attemptKey(owner));
  } catch {
    // Without session storage the id lives only as long as the form, which is the earlier behaviour.
  }
}
