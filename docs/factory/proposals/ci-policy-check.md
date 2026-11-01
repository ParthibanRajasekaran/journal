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

## 2. Workflow replacement, and the ownership protections that stop it

A pull request runs the workflow file from the pull request. It can keep the job name `policy-check` and replace
its command with `exit 0`, so requiring the status name alone is insufficient. Enforcement needs something a
pull request cannot edit, and a required reviewer who is not the author.

### 2a. The reviewer arrangement (required, and owner-chosen)

GitHub's protected-branch documentation says approvals must come from reviewers with write permission. It does
not say that the pull request author's own approval counts, so this proposal never relies on it. A repository
with one collaborator therefore cannot satisfy a required review from someone other than the author. Choose one:

- **A. Second reviewer account (recommended).** Add a second GitHub account with write access. List it as the code
  owner for the protected paths below. Its approval is the required review. The agent does not approve, merge or
  request a review on its own behalf.
- **B. Single-owner repository.** No required reviewer can exist. Required reviews and code-owner review are then
  documentation only, not enforcement. This is stated as a residual risk, not a control.

### 2b. Protected paths and their owner (CODEOWNERS)

GitHub's documentation says pull requests use the CODEOWNERS file from the base branch, and that GitHub checks the
`.github/`, root and `docs/` locations, using the first file it finds. The file is therefore placed at
`.github/CODEOWNERS` on `main`. A pull request cannot change the file that routes its own review. A change to the
file takes effect only after it is merged.

Proposed content (placeholder `@REVIEWER` is the second account from option A):

```
# Protected paths. Changes need review from a code owner other than the author.
/.github/           @REVIEWER
/factory/           @REVIEWER
/tools/             @REVIEWER
/policy/            @REVIEWER
/docs/factory/      @REVIEWER
/docs/adr/          @REVIEWER
```

`tools/` is listed because `tools/policy_check.py` and `tools/tests/` are the trusted checker. A pull request that
edits them would otherwise change the judge.

### 2c. Branch protection settings to request on `main` (owner settings)

1. Require a pull request before merging, with **one approval**.
2. **Require review from code owners.** GitHub documents that a change to a code owner's path needs that owner's approval.
3. **Dismiss stale pull request approvals when new commits are pushed.** GitHub documents that a changed diff dismisses the approval and the merge waits for a new one.
4. **Do not allow bypassing the above settings.** GitHub documents that, without this setting, admins are not bound by the rule.
5. Require the `ci` check. Requiring `policy-check` only after it has run from a trusted base checkout (section 4).
6. Restrict pushes to `main`, and disallow force pushes and deletions.

Read-only state, checked 31 October 2026 with `gh api`: no protection on `main` (404), no rulesets, no CODEOWNERS file,
one collaborator. Nothing is enforced today.

### 2d. Bypass and stale approvals

- Stale approvals are handled by setting 3, which is documented behaviour.
- Bypass is handled by setting 4. With it set, the owner account is bound by the rule too. Without a second reviewer,
  the owner then cannot merge at all. That is the cost of option A's enforcement, and the owner must accept it.

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
  branch protection and CODEOWNERS, (4) only then is the check required. Before step 1 the job fails with an explicit
  "BOOTSTRAP STAGE, NOT AN ENFORCEMENT RESULT" message (`883f8c3` on `review/bootstrap-policy-check`). That failure is
  expected, and it is not a passing run.

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
