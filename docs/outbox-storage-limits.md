# Offline outbox: what the device can and cannot keep when storage refuses writes

Status: candidate documentation, reviewed with the outbox change. It describes the code in `web/src/offline.ts`,
`web/src/attempt.ts` and `web/src/screens/SignIn.tsx`, and the server behaviour in `backend/app/routes/meals.py`.

## What the device stores

- **Queued meals** (`journal.outbox.v2`): meals saved while offline, each with its account and `client_id`.
- **Quarantine** (`journal.quarantine.v1`): damaged or unowned records, kept and never sent.
- **Owed deletions** (`journal.discard-pending.v1`): the accounts whose queued meals must still be removed from
  this device. Written before a removal starts, and cleared only after the removal reads back.
- **Save attempt** (session storage): the `client_id` of an unfinished save, so a retry keeps it. Released when the
  save succeeds, or when the user leaves the form on purpose.

## What is guaranteed

- A meal is reported as saved only after the device has read it back, or after the server has saved it.
- A queued meal is never sent while another account owns the session. The server refuses a write for an account
  other than the session's, and refuses a write for a deleted account, before anything is read or written.
- A retry of the same unchanged save keeps its `client_id`. The server stores one meal per `client_id` and account.
- A removal of a deleted account's queued meals is reported as complete only after it reads back.

## The unavoidable limit

The browser provides one storage area per site. If it refuses every write (storage full, private browsing with
storage disabled, or storage blocked by the user), **nothing can be persisted**. In that case:

1. The app cannot keep a meal for later. Save shows a storage error and keeps the form.
2. The app cannot record an owed deletion. The sign-in screen can warn only while the page stays open. The warning
   is held in memory, so **a reload loses it**, and nothing persisted survives a reload because nothing could be
   written. The app must not claim otherwise.
3. Local data for a deleted account can remain on the device, and the app cannot remove it. The server still refuses
   every write for that account, so those meals cannot reach another account. The only way to remove them is to
   clear this site's data in the browser.

A narrower case exists: the browser accepts the outbox but refuses the small deletion record. The owed deletion is
then lost on reload. The deleted account's meals remain on the device with no record, and the sign-in screen does not
mention them. They still cannot be sent to another account, and the server refuses them for the deleted one. The same
fix applies: clear this site's data.

Both cases are inherent to a single browser storage area. They are not fixed by the code.

## Other known limits

- **Two tabs deleting accounts at the same instant** can overwrite each other's owed list, because `localStorage`
  has no compare-and-set. The later write wins.
- **Two tabs sending the same queued meal at the same instant** send two requests. The server stores one meal, and
  both responses carry the same meal. The duplicate request is not a duplicate meal.
- **A deliberate second identical meal** entered in the same minute, without leaving the form, reuses the first
  `client_id` and is stored once. Leaving the form, or entering the meal again after cancelling, gives a new id.

## Tests that cover this

- `backend/tests/test_meal_concurrency.py`: twelve simultaneous identical creates store one meal, and each response is a
  replay. Simultaneous conflicting payloads store one meal and refuse the others with 409. These run against the real
  PostgreSQL test database.
- `backend/tests/test_expected_account.py`: a re-registered account gets a new id and cannot write with the old one;
  one account cannot see another's meals.
- `web/src/outbox-fixes.test.ts`, `web/src/attempt.test.ts`: owed deletions, storage refusal, retry identity.
