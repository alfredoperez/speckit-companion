# Sidebar Completed Filter

## Overview

Make the sidebar's "Completed" group honest: it should list only specs the user has truly finished (`completed`), not specs that merely reached the end of implementation (`implemented`). Implemented specs stay in the active view so the "still needs a manual mark-complete" state is visible — which matters most for stock specs that never auto-complete.

## Functional Requirements

- **FR-001** The sidebar "Completed" group MUST list only specs whose status is `completed`.
- **FR-002** A spec whose status is `implemented` MUST NOT appear in the "Completed" group.
- **FR-003** A spec whose status is `implemented` MUST appear in the active / in-progress group, so it remains visible and can still be marked complete manually.
- **FR-004** The "Completed" group count and label MUST reflect only the `completed` specs it now contains.
- **FR-005** The active fuzzy filter and sort behavior MUST continue to apply to the regrouped specs (an `implemented` spec must be searchable and sortable within the active group).
- **FR-006** Specs with status `archived` MUST continue to be grouped under "Archived", unchanged by this change.
- **FR-007** The sidebar reference docs MUST describe the `implemented`-vs-`completed` grouping so the surfacing rule is documented where users and contributors look.

## Success Criteria

- **SC-001** With at least one `completed` and one `implemented` spec present, the "Completed" group lists exactly the `completed` specs and zero `implemented` specs.
- **SC-002** An `implemented` spec is present in the active group in the same scenario as SC-001.
- **SC-003** A spec moved from `implemented` to `completed` leaves the active group and appears under "Completed" on the next refresh.
- **SC-004** The "Completed" group header count equals the number of `completed` specs shown under it.
- **SC-005** `docs/sidebar.md` and `docs/viewer-states.md` state that `implemented` specs stay in the active view and only `completed` specs appear under "Completed".

## Assumptions

- The status used for grouping is read from each spec's `.spec-context.json` (`status` field); no new field or schema change is introduced.
- The Companion auto-complete mechanism that promotes a spec from `implemented` to `completed` is delivered separately (#308); this change only reflects the resulting status in the sidebar grouping.
- An `implemented` spec belongs in the active group rather than a new dedicated group — no third "Done but not completed" group is introduced.
- Existing tree icons, context-menu actions, and the manual mark-complete action for `implemented` specs are unaffected.

## Approach

The single behavioral change is in the sidebar's status partitioning. Today `implemented` specs are bucketed with `completed` ones; they should instead fall into the active bucket.

- In `src/features/specs/specExplorerProvider.ts`, the partition loop (~line 176) routes both `COMPLETED` and `IMPLEMENTED` into `completedSpecs`. Drop the `IMPLEMENTED` case from that branch so it falls through to `activeSpecs`. Remove the now-stale "group it with the done specs" comment.
- The fuzzy-filter, sort, group-count, and group-construction code below already operate on whatever each bucket holds, so no further code change is needed there.
- Add/adjust a unit test in `src/features/specs/__tests__/specExplorerProvider.test.ts` asserting an `implemented` spec lands in Active and a `completed` spec lands in Completed.
- Update `docs/sidebar.md` (filter/group behavior) and `docs/viewer-states.md` (implemented-vs-completed surfacing).

Dependencies: none blocking; pairs with #308 (auto-complete mechanism) but does not require it.
