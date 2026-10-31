# Proposal: run the change-set policy check in CI

Status: proposal, not applied. `.github/workflows/ci.yml` is human-review-only under the change policy.

## The job

Add this job to `.github/workflows/ci.yml`. It runs on pull requests only, uses full history so the base
commit's policy and approvals can be read, and fails the build on any violation.

```yaml
  policy-check:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - name: Change-set policy (base policy and approvals)
        run: python3 -m factory policy-check --base "${{ github.event.pull_request.base.sha }}" --head "${{ github.event.pull_request.head.sha }}"
```

## What it judges

- Each changed path must be inside the policy's allowed roots, or under an approval with status
  `approved` and a named approver, recorded at the base commit.
- Protected paths are refused even when allowed or approved.
- `docs/factory/policy-exceptions.json` is always protected, so a pull request cannot approve itself.

## What it will do on the current branch

It will fail on the review branch's web changes. Those paths are outside the current allowed roots and have
no approval recorded. That is the correct outcome until one of two things happens: the owner adopts option
A (`docs/factory/proposals/change_policy.option-a.rego`) through CODEOWNERS review, or the owner records an
approval in `docs/factory/policy-exceptions.json` on the base branch.

## Not covered

- The check reads the policy from the base commit. A pull request that changes the policy is judged by the
  old policy until it is merged, which is the intended behaviour.
- It does not run the gates or the independent review. Those are separate evidence.
