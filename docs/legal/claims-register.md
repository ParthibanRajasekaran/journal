# Claims register

Every promise Journal makes to users, with the evidence we hold today. The rule: a claim stays only
if we can prove it now, or it is rewritten to something we can prove. Not legal advice; a solicitor
reviews this before any store listing or policy is published.

Status key: **Provable** (evidence in the repo or tests), **Needs evidence** (true in intent, not yet
shown), **Remove or reword** (cannot be proved as written).

| # | Where the claim appears | Claim as written | Evidence today | Status | Action |
|---|---|---|---|---|---|
| 1 | Sign-in, Settings | "Your key is checked once, stored encrypted, and never shown again." | AES-GCM encryption with per-user, per-provider context (`backend/app/crypto.py`); tests show ciphertext only and last-four display (`backend/tests/test_ai_keys.py`) | Provable | Keep. Test stays in the gate. |
| 2 | Settings, key help | "Journal stores it encrypted and never shows it again." | Same as 1 | Provable | Keep. |
| 3 | Sign-in (was "Only you see your meals") | Now: "Your meal notes are yours. Estimates use only the AI account you choose." | Meal text is sent to the chosen provider (`backend/app/ai/estimate.py`); ADR-005 records provider data terms | Provable as written, but "yours" is a legal-sounding word | Solicitor to confirm wording. |
| 4 | Sign-in | "We never sell your data." | No sale of data in code; no written data-sharing agreement, no defined meaning of "sell", no provider terms reviewed in this repo | Needs evidence | Keep only after a written data-sharing position and a published definition; otherwise remove. |
| 5 | Sign-in | "Delete everything, any time, from Settings." | Account deletion cascades meals and tokens (`backend/tests/test_days_and_profile.py`, `me.py` delete). Backups keep data for up to 14 days | Needs evidence | Reword to "Deleting your account removes your meals and key from Journal. Backups are cleared within 14 days." |
| 6 | Sign-in, copy | "We use your Google account only to confirm it's you." | Only the Google subject and email are stored (`backend/app/auth/service.py`, `users` table) | Provable (check the table columns) | Keep; re-check if columns change. |
| 7 | Estimates, Week, Today | "Approximate, based on what you've entered." | Estimates come from a model; figures are sums of the entries; the split is arithmetic on entries | Provable | Keep on every estimate figure and derived total. |
| 8 | Encouragement | "Good progress", "Great", "Amazing" tiers at 80%, 90%, 100% of the user's own target | Arithmetic on entries and the user's target; no percentages printed | Provable as arithmetic | Keep; solicitor to confirm copy. |
| 9 | Encouragement | "Turn it off to hide every note." | Flag gates the save line and Week summary (`web/src/App.tsx`, `Week.tsx`) | Provable for these two places | Re-check each time a new encouragement element is added. |
| 10 | Earlier copy (removed) | "We never discourage food choices" | Not provable; a claim about intent | Remove | Use "designed not to judge food" only if the solicitor agrees. |
| 11 | Earlier copy (removed) | "Only you can see it" | Not true: the AI provider receives the text | Removed | None. |
| 12 | Settings, billing | Providers bill the user's own account directly | True by design (bring-your-own-key); no Journal billing | Provable | Keep. |
| 13 | Store listing (not yet written) | "Free" | Free to download and use; users need their own AI key to estimate | Needs evidence | Say "Free to use, with your own AI key." Solicitor to check. |
| 14 | Macro split | Split of protein, carbs and fat | Arithmetic on entries with standard energy values | Provable | Keep, with the approximate line. |

## Open items for the solicitor
- Claim 4 (sale of data) and claim 5 (deletion and backups).
- Claim 13 (the word "free").
- Whether "yours" in claim 3 is an ownership claim the solicitor will accept.
