# Decision: Bulk archive for old orders

- **Slug**: bulk-archive
- **Decided**: 2026-10-03
- **Verdict**: needs-clarification
- **Artifacts reviewed**: intake.md, research.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | A slow orders list is plausible and a backlog note mentions it, but nobody has said whether they want old orders hidden or just a faster page (intake, research). |
| Evidence strength | weak | Nothing was measured. The list is unpaginated, which is a likelier cause of the slowness than the lack of a bulk archive (research). |
| Value vs. inaction | unknown | The cost of waiting depends on how fast the list grows and how slow it is today, and neither number exists. |
| Feasibility / appetite | adequate | Single-order archive already sets `archived_at`, so a bulk version is a small step, but no concept was shaped and there is no restore path. |
| Strategic fit | adequate | Bulk actions fit an admin tool. No written principle or retention rule speaks for or against it. |
| Risk posture | weak | A bulk action with no restore can hide thousands of orders in one click, and archived orders silently drop out of the monthly CSV export. |

## Verdict & Rationale

**Needs clarification.** The idea names a solution, bulk archive, for a symptom, a slow list, that the research traces to a different likely cause. Evidence strength is `weak` and value against inaction is `unknown`, so a `go` is not allowed.

A `kill` would be premature too. The slowness is real enough to appear in the backlog, and two answers would settle whether this idea, pagination, or both is the right response.

## If needs-clarification

- **Blocking questions**: [NEEDS CLARIFICATION: Is the orders list slow because of the number of rows rendered or because of the query, measured on the real data?] [NEEDS CLARIFICATION: Does the requester want old orders out of view, or only a faster page?] [NEEDS CLARIFICATION: Must archived orders stay in the monthly export?]
- **Revisit stage**: research
