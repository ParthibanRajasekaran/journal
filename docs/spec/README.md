# Specification package (frozen)

Five documents consolidated on 15 November 2026 define the daily-use MVP:

| File | Role |
|---|---|
| `00-review-and-handoff.md` | Scope, resolved decisions, milestone order (M0 to M5). Controls the other four. |
| `01-prd.md` | User jobs, functional requirements (JRN-xxx) and acceptance criteria. |
| `02-product-design.md` | Navigation, screens, input states, accessibility, visual tokens. |
| `03-architecture-and-implementation.md` | Schema, endpoints, offline state model, AI controls, ADR reconciliation. |
| `04-pilot-and-acceptance.md` | Seven-day pilot matrix and release blockers. |

Precedence: `00` wins over the others. Inside each file the "Consolidated decisions" block at the top overrides anything
later in that file. These files are frozen: only the owner changes them. Delivery status lives in `docs/milestones.md`,
not here.
