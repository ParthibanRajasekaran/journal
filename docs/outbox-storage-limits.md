# Offline outbox: what the device can and cannot keep when storage refuses writes

Status: candidate documentation, reviewed with the outbox change. It describes `web/src/offline.ts`, `web/src/attempt.ts`,
`web/src/screens/AddMeal.tsx`, `web/src/screens/SignIn.tsx` and `backend/app/routes/meals.py` as they are in this commit.

## What the device stores

- **Queued meals** (`journal.outbox.v2`): meals saved while offline, each with its account and `client_id`.
- **Quarantine** (`journal.quarantine.v1`): damaged or unowned records, kept and never sent.
- **Owed deletions** (`journal.discard-pending.v1`): the accounts whose queued meals must still be removed from this
  device. It is written before a removal starts, and cleared only after the removal reads back.
- **Save attempt** (session storage): the `client_id` of a save whose outcome is not yet known, so a retry keeps it.
  It is released when the save succeeds, or when the user leaves the form with Cancel or Discard while no save is in flight.
  Leaving the form another way (for example through a tab link) does not release it, so the id is kept for the tab session.

## What is guaranteed

- A meal is reported as saved only after the device has read it back, or after the server has saved it.
- A queued meal is never sent while another account owns the session. The client checks the owner before every send and
  resend. The server refuses a write whose `X-Journal-Expected-Account` names another account, before anything is read or
  written.
- A retry of the same unchanged save keeps its `client_id`. The server stores one meal per `client_id` and account, and
  answers a replay with the existing meal (200) and a different meal with a conflict (409).
- A removal of a deleted account's queued meals is reported as complete only after it reads back.
- Cancel and Discard are disabled while a save is pending, so a save's id cannot be released while its outcome is unknown.

## The unavoidable limit

The browser provides one storage area per site. If it refuses writes, what can be kept depends on which write is refused.

1. **Storage refuses every write** (storage full, or storage disabled). Nothing can be kept. Save shows a storage error and
   keeps the form. If an account is deleted, its queued meals cannot be removed. The app keeps the warning in memory only,
   so it is shown while the page stays open, and a reload removes it. Nothing persisted can record the obligation, because
   nothing could be written.

2. **Storage refuses the owed-deletion record, and also refuses the removal.** The deleted account's meals remain on the
   device. The warning is held in memory only, so **a reload removes it**, and the device then holds no record that the meals
   need removing. The sign-in screen does not mention them after a reload. The meals cannot be sent to another account, and
   the server refuses writes for the deleted one, but the app does not tell the user they are still there. Clearing this
   site's data in the browser removes them.

3. **Storage refuses the record but accepts the removal.** The removal succeeds, the meals are gone, and the app reports
   the deletion complete. Nothing remains to warn about.

These limits come from the browser's single storage area. The code does not avoid them.

## Deleted accounts, server side

After `DELETE /me` the browser's session cookie is removed, and the server refuses writes from that session. This is tested
(`backend/tests/test_expected_account.py`). A still-valid access token of a deleted account, presented outside the cookie, is
**not** refused by a separate check. The server's create path reads the account's rows and fails the insert on the foreign
key, which returns `409 "Retry the request."`. The client treats that as transient, retries, and then shows the meal as
blocked. Nothing is written, but this is not the clean refusal the cookie path gives. Closing that gap needs a change to the
authentication dependency, which is in the protected authentication paths and is left for the owner to decide.

## Other known limits

- **Two tabs deleting accounts at the same instant** can overwrite each other's owed list, because `localStorage` has no
  compare-and-set. The later write wins.
- **Two tabs sending the same queued meal at the same instant** send two requests. The server stores one meal, and both
  responses carry that meal. The duplicate request is not a duplicate meal.
- **Another device** that still holds a deleted account's queued meals does not discard them. They are never replayed to
  another account, but they end up blocked after the retry limit.
- **A deliberate second identical meal** entered in the same tab session reuses the first `client_id` only if the first save
  did not succeed. A successful save releases the id, so the next identical meal is new.

## Tests that cover this

- `backend/tests/test_meal_concurrency.py`: twelve simultaneous identical creates store one meal, and each response is a
  replay. Simultaneous conflicting payloads store one meal and refuse the others with 409. These run against the real
  PostgreSQL test database.
- `backend/tests/test_expected_account.py`: a re-registered account gets a new id and cannot write with the old one; one
  account cannot see another's meals; a write for another account is refused by the expected-account check.
- `web/src/outbox-fixes.test.ts`, `web/src/attempt.test.ts`: owed deletions, storage refusal, retry identity.
- `web/src/screens/AddMeal.inflight.test.ts`: Cancel and Discard during an in-flight save, lost responses and retries.
