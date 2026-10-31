# Proposal: CI policy check, trusted checker, and enforced workflow ownership

Status: proposal, not applied. `.github/workflows/ci.yml` and branch settings are human-owned. This document
separates what the repository can enforce from what needs GitHub owner settings, and says which is which.

Bootstrap status: the stdlib checker and this job are on `review/bootstrap-policy-check` at `07e3ffe`, not on
`main`. The job in that commit is not required. The factory package's `policy-check` command implements the same
rules; the job calls `tools/policy_check.py`, so the job does not need the factory package on `main`.

## 1. The checker runs from a trusted checkout (repository code, proven by test)

`python3 tools/policy_check.py --repo <PR checkout> --base <sha> --head <sha>` reads the policy and approvals
at the base commit, and reads the pull request's git data as data. Run from a trusted checkout of the base
commit (`working-directory: trusted`), it cannot be replaced by the pull request's own checker. Two regressions
in `factory/tests/test_policy_check_trust.py` cover this: the trusted checker rejects the pull request, and the
pull request's checker passes it when it judges itself. Both pass.

## 2. Workflow replacement (the remaining gap)

A pull request runs the workflow file from the pull request. It can keep the job name `policy-check` and replace
its command with `exit 0`. A status check named `policy-check` then passes. **Requiring the status name alone is
insufficient.** The checker from section 1 protects only a job that still runs it.

So the policy check has to be enforced by something a pull request cannot edit. Three options, with what each depends on:

| Option | What it enforces | What it depends on | Verified here |
|---|---|---|---|
| A. Trusted required workflow (a workflow defined outside the repository, required by policy) | Runs a fixed job the pull request cannot change | GitHub organisation or enterprise rulesets. Availability for a personal account is **unverified** | No |
| B. Code-owner review of workflow and checker changes, enforced by branch protection | A pull request that edits `.github/workflows/**` or `factory/**` cannot merge without an owner's approval | Branch protection with "require review from code owners", CODEOWNERS on the base branch, "dismiss stale approvals" on new pushes, and "restrict who can push" | No (see section 3) |
| C. A merge check run from the base branch by a person | A human compares the workflow diff with the base before merging | Discipline, not automation | Not enforcement |

Recommended: B, with A if available. Both need owner settings. Neither is a code change.

### Option B, exact settings to request

For the default branch `main`:

1. Require a pull request before merging, with **1 approval**.
2. **Require review from code owners.**
3. **Dismiss stale pull request approvals when new commits are pushed.** A new push after approval must be reviewed again.
4. Require the status check `policy-check` and the existing `ci` check. This is necessary, not sufficient.
5. Restrict who can push to `main`. Include administrators, so the owner cannot bypass the rule casually.
6. Disallow force pushes and deletions.

CODEOWNERS on the base branch (proposal, not created):

```
# Human review required for any change to workflow, checker, policy or approvals.
/.github/            @ParthibanRajasekaran
/factory/            @ParthibanRajasekaran
/policy/             @ParthibanRajasekaran
/docs/factory/       @ParthibanRajasekaran
/docs/adr/           @ParthibanRajasekaran
```

**Unverified:** whether GitHub reads CODEOWNERS from the pull request or from the base branch when deciding required
reviewers. Confirm this in a throwaway test repository before relying on it. If the pull request's file is used, a
pull request could remove its own owner rule. The base-branch behaviour is what this document assumes.

### Stale approvals and bypass

- A reviewer approves commit X. A new commit Y that edits a workflow must not inherit that approval. Setting 3
  handles this, and it is **unverified** until tested with the owner's settings.
- Bypass restrictions: administrator inclusion (setting 5). The owner account is also the only collaborator, so
  this is a single-person control. It stops accidents, not a deliberate act by the owner.

## 3. Read-only evidence of the current settings

Checked with `gh api` (read-only GET), 31 October 2026:

- `GET repos/ParthibanRajasekaran/journal/branches/main/protection`: **HTTP 404, "Branch not protected".**
- `GET repos/ParthibanRajasekaran/journal/rulesets`: **empty.**
- Collaborators: **one**, the repository owner.
- CODEOWNERS: **no file** in the repository (`git ls-files` finds none).

So today no enforcement exists. Nothing in this document is in force until the owner applies the settings.

## 4. Bootstrap sequence (why this cannot enforce itself yet)

- `main` (`b5f296f`) does not contain `factory/` or `factory/tests/`. A `policy-check` job that runs the
  trusted checker from the base branch cannot run on `main` until the checker is on `main`.
- The checker can only reach `main` through human review, because it is under `factory/**` and `.github/**`.
- Until then, the job, if added, must be marked non-required, so it can run without blocking a merge that
  the checker does not yet exist to judge.
- Sequence: (1) owner reviews and merges the checker and tests, (2) owner adds the job, (3) owner turns on
  branch protection and CODEOWNERS, (4) only then is the check required.

## 5. The job itself

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
      - name: Pull request (data only, never executed)
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
        run: python3 tools/policy_check.py --repo "$GITHUB_WORKSPACE/pr" --base "${{ github.event.pull_request.base.sha }}" --head "${{ github.event.pull_request.head.sha }}"
```

Limits: this checks policy only. It does not run gates or an independent review. The job still runs the pull request's
`ci.yml`, so section 2 is required for it to matter.
