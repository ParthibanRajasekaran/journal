# Narrow authorisation for the outbox milestone: `web/src/` only

Status: proposal. **Not approved.** Nothing in this file records your approval. You approve by making the change
yourself, on `main`, through your own pull request or a direct commit, with your own name.

## Why this scope

The outbox candidate's web changes are all in `web/src/`. `web/e2e/`, `web/android/`, `web/ios/` and `factory/` are not
needed for it, and they stay human-owned. Option A (`change_policy.option-a.rego`) would allow all of `web/src/**` and
`web/e2e/**` to agents; this proposal allows only the `web/src/` prefix, through the approvals file the factory already
reads, so the policy file itself does not change.

## Exact change proposed (you apply it)

File: `docs/factory/policy-exceptions.json`. Add this entry to `exceptions`:

```json
{
  "prefix": "web/src/",
  "status": "approved",
  "approved_by": "<your name, entered by you>",
  "reason": "Outbox milestone: account-safe offline capture. Scope limited to web/src/. Excludes web/e2e, web/android, web/ios and factory/."
}
```

Notes:
- `approved_by` is left for you to fill. The factory and the checker treat an empty or missing name as no approval.
- The entry is only effective on `main`, where the factory and the checker read it at the base commit.
- It does not change `policy/`, and it does not touch the protected paths.

## What it authorises, and what it does not

- Authorises: changes under `web/src/` by the outbox candidate, judged by the checker and the factory.
- Does not authorise: `web/e2e/`, `web/android/`, `web/ios/`, `factory/`, `policy/`, `docs/factory/policy-exceptions.json`
  (protected in every case), or any path outside `web/src/`.

## Uncertainty

- The approval is recorded as data in a file the owner edits. It is not a GitHub approval, and it does not prove anyone
  reviewed the diff. Your own reading of the candidate diff is the review for this item.
- A future change under `web/src/` that is unrelated to outbox work would also pass this check. That is accepted for
  this milestone and can be narrowed later.
