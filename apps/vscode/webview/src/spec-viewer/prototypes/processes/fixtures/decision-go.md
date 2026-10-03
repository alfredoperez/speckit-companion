<!-- Hand-written for the Processes prototype from the template in Spec Kit's speckit.assess.decide command. Not a real run. -->
# Decision: Due dates on todos

- **Slug**: due-dates
- **Decided**: 2026-10-03
- **Verdict**: go
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Two requesters on record say they lose track of time-bound items in a flat list (intake, problem). |
| Evidence strength | adequate | Both requests are first-hand, and every comparable todo app ships a due date (research). |
| Value vs. inaction | adequate | Doing nothing keeps people writing the date into the todo text, which cannot be sorted. |
| Feasibility / appetite | strong | Option A (one optional date field, sort by date) fits a small appetite and touches three files (concept). |
| Strategic fit | strong | Client-only and dependency-free, so constitution Principles I and III hold. |
| Risk posture | adequate | The stored item shape changes. Older items have no date and must keep loading. |

## Verdict & Rationale

**Go.** The problem has named requesters, evidence strength is `adequate`, and the concept recommends Option A at a small appetite. Nothing in the constitution stands in the way. The one risk, older stored items without a date, is understood and has a plain mitigation: treat a missing date as "no due date".

## If go: Handoff to /speckit-specify

- **Problem**: People cannot tell which todos are due soon, so time-bound items get lost in the list.
- **Chosen approach**: Option A, an optional due date per todo with overdue items marked and the list sortable by date.
- **In scope / out of scope**: In scope: one date field, an overdue mark, sort by date. Out of scope: reminders, notifications, recurring todos.
- **Success metrics**: A user can add a due date in one step, and overdue items are visible without scrolling.
- **Carried-forward open questions**: Should a todo with no date sort first or last?
