# Open-source calorie and nutrition trackers: research notes

Date of review: 2026-10-30. Sources: public GitHub metadata (unauthenticated API), public READMEs and docs only.
Scope rule: no closed-source or store binaries were analysed; no code was copied; nothing was cloned into the Journal repo or executed.

## Summary table

| Project | Licence | Last commit (pushed) | Language | What is useful to us | What to avoid |
|---|---|---|---|---|---|
| [simonoppowa/OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker) | GPL-3.0 | 2026-10-28 | Dart (Flutter) | Meal-slot diary model, per-meal kcal split, documented export format with versioning and idempotent import, kcal/kJ display switch | GPL-3.0 means copyleft: use for ideas only, never code. Docs are the main value, not the code |
| [rfivesix/train-libre](https://github.com/rfivesix/train-libre) (formerly rfivesix/hypertrack) | GPL-3.0 (API value; the search snippet said MIT and is wrong) | 2026-10-30 | Dart (Flutter) | Four logging paths (barcode, catalog, saved template, camera or text capture); BYOK AI provider list | Mostly a fitness app; AI and on-device model scope is far beyond our MVP; GPL-3.0 |
| [FoodTrackerPoliBa/FoodTracker](https://github.com/FoodTrackerPoliBa/FoodTracker) | GPL-3.0 | 2024-12-19 | Dart (Flutter) | Simple meal and ingredient logging flow, as a reference for a minimal UI | Academic project, no description, stale since 2024; GPL-3.0 |
| [umangsh/famnom_flutter](https://github.com/umangsh/famnom_flutter) | NOASSERTION (no SPDX licence detected) | 2022-07-19 | Dart (Flutter) | Recipes and macro goals concept only | Licence unclear and repo stale (2022). Ruled out for reuse |
| [AaronBezi/CalorieChat](https://github.com/AaronBezi/CalorieChat) | None published | 2026-02-07 | Dart (Flutter) plus Node backend | Natural-language meal logging idea only | No licence means all rights reserved. Do not reuse anything |
| [junaidjamel/cal_scanner](https://github.com/junaidjamel/cal_scanner) | None published | 2026-05-23 | Dart (Flutter) | Photo-to-nutrition concept only | No licence means all rights reserved. Do not reuse anything |

Also noted and not analysed further: openfoodfacts/openfoodfacts-dart (Apache-2.0, pushed 2026-10-29) is an API client for the Open Food Facts database. It is a possible dependency for food lookup, not a tracker. openfoodfacts/openfoodfacts-server (AGPL-3.0) is a full server, too heavy for us to adopt.

## Five design ideas (our own wording)

1. **Fixed meal slots with per-slot targets.** Model the diary as breakfast, lunch, dinner, and snack per day, allow entries to be moved between slots, and offer a few preset kcal splits (plus a custom split). Source: `simonoppowa/OpenNutriTracker` README, "Meal logging" section.

2. **A day boundary instead of midnight.** Store the boundary as minutes after midnight, so late-night entries count toward the previous day. This suits meal logging, where a 1 a.m. snack is usually part of the prior day. Source: `docs/export-format.md` in OpenNutriTracker, "Timestamps and time handling".

3. **Idempotent, all-or-nothing import.** Merge rows by stable ID, so re-importing the same file changes nothing. Reject the whole file before any write if a required file is missing or a value is out of range. Source: `docs/export-format.md`, "Import rules".

4. **Versioned rows and a documented export scope.** Put a version on each record type so older builds can ignore newer data safely. Publish which fields each format (JSON or CSV) includes and which it drops, so users know what a restore recovers. Source: `docs/export-format.md`, "Versioning" and "Known limits".

5. **Canonical storage in one unit, with display switching.** Store energy in kcal and convert for display when the user picks kJ. This avoids mixed units in the database and in exports. Source: `simonoppowa/OpenNutriTracker` README, "Units" section, and `docs/export-format.md`, "Units".

## Ruled out

- **CalorieChat and cal_scanner:** no licence published, so all rights are reserved. Ideas only, no code or assets.
- **famnom_flutter:** licence not detected (NOASSERTION) and last commit in July 2022. Ideas only.
- **openfoodfacts-server:** AGPL-3.0 full server, out of proportion for our app.
- **Hypertrack / train-libre:** fitness-first, with AI and on-device model scope we do not need in the MVP. Only the logging-path list is worth noting.

## Open items

- Confirm the licence file directly in each repo before any future reuse discussion; this review used API metadata and READMEs only.
- Hypertrack's licence was reported as MIT in the search snippet, but the current repo reports GPL-3.0. Treat GPL-3.0 as the value until a maintainer confirms otherwise.
