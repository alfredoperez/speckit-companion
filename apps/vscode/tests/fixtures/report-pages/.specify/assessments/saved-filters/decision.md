# Decision: Saved filters for the orders list

- **Slug**: saved-filters
- **Decided**: 2026-10-03
- **Verdict**: go
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | A named requester and a team of four hit it every shift, and two backlog issues ask for the same thing (intake, research). |
| Evidence strength | adequate | Repo facts and the requester are solid, but how often the filter is rebuilt is self-reported, with no analytics behind it (research). |
| Value vs. inaction | adequate | Doing nothing costs a small daily rebuild, plus a bookmark workaround that has already hidden late orders once (problem). |
| Feasibility / appetite | strong | Option B reuses `src/prefs.js` at a small appetite, with one contained unknown, relative dates (concept). |
| Strategic fit | strong | The column picker already stores a per-user preference the same way, so this follows an existing pattern. |
| Risk posture | adequate | The risks are named (a removed customer in a saved filter, rename and delete), and none of them touch people who never save a filter. |

## Verdict & Rationale

**Go.** The problem is confirmed by the people who have it, and the recommended option is small because the storage it needs already exists. No criterion is rated `weak` or `unknown`, and the only soft spot, self-reported frequency, does not change the call at this appetite.

Option C is deliberately left out. Nobody asked to share a filter, and a team scope would turn a few days of work into weeks.

## If go — Handoff to `/speckit.specify`

- **Problem**: People who work the orders list every shift rebuild the same filter by hand, and the bookmark workaround freezes its date range.
- **Chosen approach**: Option B, named private filters stored in user preferences through `src/prefs.js`, with date rules saved as relative when entered that way.
- **In scope / out of scope**: In scope: save, apply, rename and delete a named filter on the orders list, and a relative "older than N days" date rule. Out of scope: team sharing, a default filter on page load, saved filters on other lists.
- **Success metrics**: Reapplying the daily filter takes one click, a filter saved with "older than 3 days" is still correct a week later, and nothing changes for a person with no saved filters.
- **Carried-forward open questions**: Which relative date forms are needed beyond "older than N days"? Is a limit of twenty saved filters per person acceptable?
