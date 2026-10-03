# Decision: Shared todo lists

- **Slug**: shared-lists
- **Decided**: 2026-10-03
- **Verdict**: kill
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | weak | The problem is plausible but unconfirmed: no requester, no trigger, no user data (intake, problem). |
| Evidence strength | weak | Repo facts are solid, but demand and market evidence is absent; overall confidence is low (research). |
| Value vs. inaction | weak | Doing nothing keeps the app a private single-user list, which matches its stated purpose. The cost is real only if a requester exists (problem). |
| Feasibility / appetite | adequate | Option B (file or link hand-off) fits the constitution at medium appetite, but merge rules are unscoped (concept). |
| Strategic fit | weak | Cross-device sharing needs a network, which constitution Principle III forbids. Principle I rules out a sync library. |
| Risk posture | adequate | Risks are well identified (data loss on concurrent edits, `Date.now()` id collisions, URL privacy). Mitigation exists only for Option B, which is not chosen. |

## Verdict & Rationale

**Kill, for now.** The decisive reason is that no one is on record as needing this. Evidence strength is `weak`, so a `go` is not allowed. Waiting on answers would not help either: the unknowns are demand, not design, and the concept already recommends Option A (do nothing). The real-sharing option (live backend, Option C) also requires a MAJOR amendment to Principle III, and Option B would be the largest feature in a 42-line app for an unproven need. No `unknown` scores remain; the open questions are carried in the earlier artifacts.

## Revisit trigger

Reopen from `/speckit-assess-intake` if a real requester appears and confirms (a) the need is not satisfied by chat or another app, and (b) a manual hand-off is acceptable. Start from Option B. Consider Option C only if the owner chooses to amend Principle III.
