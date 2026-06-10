# Sidebar: trim the redundant step-state status text appended to the spec name

## Overview

Each spec row in the sidebar shows its name plus a status suffix (e.g. `13-rename-financial-to-fire  implement — Implement · T004 · just now`). The per-document step icons (Specification / Plan / Tasks) already convey step state, so the step-name phrase in that suffix is redundant clutter. This change reduces the row `description` to only the information the icons do not already carry — the active task and the last-active time — so rows read cleaner at a glance, while the icons remain the primary step-state signal.

## Functional Requirements

- **FR-001**: The spec/feature row `description` MUST NOT include the current-step word (`specify`/`plan`/`implement`/…) on its own, because the per-document step icons already convey which step is active.
- **FR-002**: The spec/feature row `description` MUST NOT include the step-name phrase of the last-transition label (`Implement`, `Implement completed`, `Implement started`) for step-boundary transitions, because that step state is what the icons already show.
- **FR-003**: The spec/feature row `description` MUST keep the last-active relative time (`just now`, `22h ago`) — it is not conveyed by any icon.
- **FR-004**: When the last transition is a per-task implement finish, the row `description` MUST keep the active task id (`T004`) in a compact form, because the task is not conveyed by any icon.
- **FR-005**: The kept fields MUST be rendered compactly with a single, consistent separator (e.g. `· T004 · 22h ago`, or `· just now` when no task), with no leading `<step> — ` prefix.
- **FR-006**: When there is no last-transition history and no other kept field, the row MUST NOT set a step-derived `description` (no empty `—` artifact).
- **FR-007**: The hover tooltip MAY retain the fuller last-transition label (step + relative time) — only the inline `description` is trimmed; the tooltip is not an at-a-glance surface and remains a deliberate, fuller detail view.
- **FR-008**: The trim decision MUST be documented in a code comment at the description-builder so it reads as deliberate, not accidental.
- **FR-009**: The per-document step icons and all other tree nodes (group nodes, spec-document rows, duplicate-name parent-dir override) MUST be unchanged by this trim.

## Success Criteria

- **SC-001**: For a spec mid-implement on task `T004` active `just now`, the row description reads `· T004 · just now` (no `implement`, no `Implement` word) instead of `implement — Implement · T004 · just now`.
- **SC-002**: For a spec whose last transition is a step start/complete (e.g. plan started 22h ago), the row description reads `· 22h ago` (no `Plan started` / `plan` word).
- **SC-003**: For a spec with no history, no step-derived description is set.
- **SC-004**: The duplicate-name parent-dir override and the spec-document `not created` description are byte-identical to before.
- **SC-005**: `npm run compile` is clean and `npm test` is green, with unit coverage asserting the trimmed description for at least the per-task and step-boundary cases.
- **SC-006**: No `src/` or `webview/` module gains a runtime import from `.claude/**` or `.specify/**`.

## Assumptions

- The redundant content is the step-name phrase: the standalone `currentStep` word and the `<Step>`/`<Step> started`/`<Step> completed` prefix of the last-transition label. The icon-absent content worth keeping is the active task id and the relative time.
- The active task id is surfaced by exposing it as a discrete field on the `LastTransition` view (derived from the per-task history entry) rather than string-parsing the existing combined `label`, keeping the description builder declarative and unit-testable.
- The compact separator is `· ` (middle dot), already used inside the existing label, with a single leading `· ` so the row reads `13-rename… · T004 · just now`.
- The tooltip keeps its existing fuller `Last: <label> (<relative>)` line — only the inline `description` is trimmed.
- The change touches the description builder in `specExplorerProvider.ts` and adds one field to `lastTransition.ts`; both are pure of `.claude/`/`.specify/` runtime deps.

## Approach

- **`src/features/specs/lastTransition.ts`**: add an optional `task?: string` field to the `LastTransition` interface and populate it from the per-task history entry (`isPerTaskEntry(entry) ? entry.task : undefined`). Keep `label` (used by the tooltip) unchanged.
- **`src/features/specs/specExplorerProvider.ts`**: in the `isSpecLifecycleItem` branch, stop pushing `currentStep` into `descParts` and stop pushing the step-name-bearing `lastTransition.label`. Instead build a compact suffix from the kept fields only: optional `task`, then `relative`, joined with ` · ` and a single leading `· `. Document the trim decision in a comment. Leave the tooltip's `Last: …` line as-is.
- Tests: extend `lastTransition.test.ts` to assert the new `task` field for a per-task entry and its absence for a step entry; extend `specExplorerProvider.test.ts` (or add a focused test) to assert the trimmed `description` for the per-task and step-boundary cases and the no-history (undefined) case.

## Implementation Tasks

- [x] **T001** Add optional `task?: string` to the `LastTransition` interface and populate it from the per-task history entry in `deriveLastTransition` + `src/features/specs/lastTransition.ts`
- [x] **T002** Rebuild the spec-row `description` in the `isSpecLifecycleItem` branch to drop `currentStep` and the step-name label, keeping only a compact `· <task> · <relative>` suffix, with a deliberate-trim comment + `src/features/specs/specExplorerProvider.ts`
- [x] **T003** [P] Extend `lastTransition.test.ts` to cover the new `task` field (present for per-task entry, absent for step entry) + `src/features/specs/__tests__/lastTransition.test.ts`
- [x] **T004** [P] Add/extend provider tests asserting the trimmed description for per-task, step-boundary, and no-history cases + `src/features/specs/__tests__/specExplorerProvider.test.ts`
- [x] **T005** Run `npm run compile` and `npm test`; fix any regressions to icons / other tree nodes + (verification)
