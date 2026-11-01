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
