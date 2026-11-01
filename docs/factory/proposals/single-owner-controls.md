# Repository controls for a single-owner workflow

Status: prepared, not applied. These are account settings for you to choose. The agent has not changed any setting.

## What each kind of check is

| Kind | What it is | What it proves | What it does not prove |
|---|---|---|---|
| **Automated checks** | `scripts/verify.sh`, run on a named commit. Gates, secret scan, candidate identity. | That the listed commands passed on that commit, in this environment. | That the design is right, or that a person reviewed it. |
| **Independent technical review** | A reviewer that did not write the change reads it against the acceptance criteria and writes findings. This can be an AI reviewer, reported as such. | That a second reader found no issues, on that commit, with the review recorded. | That a human approved the change. It is never shown as a GitHub approval. |
| **Owner merge authorization** | You decide to merge a named pull request, or record a named approval in the repository. | That the accountable owner accepted that specific change. | That it passed any check, unless the checks are listed with it. |

## What GitHub can enforce for one person

GitHub's branch protection requires approvals from reviewers with write access, and it does not count an author's own
approval for this purpose, as far as its documentation states. A repository with one collaborator therefore cannot
satisfy a required human approval. Do not configure one. A rule that cannot be met blocks merging and is removed
within the hour, which is worse than no rule.

## Settings to apply (recommended for now)

1. Protect `main`: require a pull request before merging, with **zero** required approvals, so you can merge your own
   pull request once its checks pass.
2. Require the status checks `ci` (and `policy-check` only after it has run successfully on `main`).
3. Disallow force pushes and branch deletion.
4. Leave "Do not allow bypassing" **off**. With it on, you could not merge at all. This means the owner can bypass the
   rules. That is stated below as a limit, not hidden.

## What this does not protect against

- A deliberate bypass by the owner. Nothing in this repository stops you from merging, changing a setting, or editing
  a workflow. Only an independent person with write access would give a second check, and there is none.
- A workflow edit in a pull request that removes a check. GitHub runs the workflow file from the pull request. The
  trusted checker (`tools/policy_check.py`) protects the policy judgement only when it runs from the base branch.

## Path to enforced human review

When a second person with write access joins:

1. Add them as a collaborator.
2. Add `.github/CODEOWNERS` on `main` listing them for `.github/`, `factory/`, `tools/`, `policy/` and `docs/factory/`
   (GitHub reads CODEOWNERS from the base branch, from `.github/`, the root or `docs/`, first found wins).
3. Change the settings above: require one approval, require review from code owners, dismiss stale approvals, and
   turn on "Do not allow bypassing".
4. Only then mark `policy-check` as required.

## Limits, in one place

- The owner account is the only accountable human. Independent AI review is evidence of technical review, and it is
  never presented as a human approval.
- Settings are not enforceable against the owner. They protect against accidents and against unreviewed automation.
