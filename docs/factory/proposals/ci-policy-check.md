# Proposal: run the change-set policy check in CI, from a trusted checkout

Status: proposal, not applied. `.github/workflows/ci.yml` is human-review-only under the change policy.

## Why the checker must not come from the pull request

A pull request that replaces the checker with one that always passes would approve itself if CI ran that
checker. The regression in `factory/tests/test_policy_check_trust.py` reproduces this: the candidate's own
checker passes a pull request the trusted checker rejects.

So the checker runs from the **base** commit's checkout, and the pull request is read only as data: its git
objects are read by `policy-check --repo`, and its code is never imported or executed.

## The job

```yaml
  policy-check:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    permissions:
      contents: read
    steps:
      - name: Trusted checker (base commit)
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          path: trusted
          persist-credentials: false
      - name: Pull request (data only, not executed)
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          path: pr
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - name: Change-set policy
        working-directory: trusted
        run: python3 -m factory policy-check --repo "$GITHUB_WORKSPACE/pr" --base "${{ github.event.pull_request.base.sha }}" --head "${{ github.event.pull_request.head.sha }}"
```

`working-directory: trusted` makes `python3 -m factory` import the base commit's `factory` package, because the
current directory comes first on the import path. The pull request's `factory` is never on that path.

## Protections the job depends on (owner settings, not code)

1. **Branch protection** on the default branch requires the `policy-check` status. Without this, a pull request
   can delete the job from `ci.yml`, because a `pull_request` workflow runs the workflow file from the pull
   request. The job is only as strong as this requirement.
2. **CODEOWNERS** on `.github/**` and `policy/**`, so that a change to the job or the policy needs a human owner's
   review.
3. The approvals file `docs/factory/policy-exceptions.json` is always protected by the checker, so a pull request
   cannot approve itself.

## Residual risk

- git reads the pull request's `.git` configuration when it runs `diff` and `show`. A pull request cannot change
  that configuration through its commits, but a repository setting that a human sets could. The job runs read-only
  git commands only.
- The job checks policy only. It does not run gates or an independent review.

## What it will do on the current branch

It fails on the web changes. Those paths are outside the current allowed roots and have no owner approval
recorded. That is correct until the owner adopts option A (`docs/factory/proposals/change_policy.option-a.rego`)
through CODEOWNERS review, or records an approval in `docs/factory/policy-exceptions.json` on the base branch.
