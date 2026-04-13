# Feature Specification: Spec-Context Tracking & Viewer Status Feedback

**Feature Branch**: `060-spec-context-tracking`
**Created**: 2026-04-13
**Status**: Draft
**Input**: Improve how SpecKit Companion records spec lifecycle state in `.spec-context.json` and how the viewer reflects that state, so users get accurate, consistent, real-time feedback about what is happening in a spec.

## Problem Context

Today `.spec-context.json` is inconsistently populated across workflows (SpecKit terminal, SpecKit + Companion, SDD, SDD Fast). The viewer derives step status partly from file existence, which produces false positives (e.g. `plan.md` existing from a template is treated as "planned"). The stepper, header badge, footer buttons, and pulsing/highlight indicators drift out of sync with reality. Users cannot trust what the viewer tells them.

Observed examples:

- `054-archive-button-left` — Companion-driven: has transitions, but `status` reached `completed` after only specify+plan with noisy back-and-forth transitions.
- `055-fix-bullet-rendering` — Terminal-only: context is `{ "status": "completed" }` with no lifecycle data.
- `056-fix-list-spacing` — SDD Fast: created all files in one run but context only records `specify` started.
- `058-floating-toast` — SDD: `status: "completed"` while `tasks.completedAt` is null (contradictory).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trustworthy single spec status (Priority: P1)

As a spec author, when I open a spec I see one overall status (Draft → Specifying → Planning → Tasking → Implementing → Completed → Archived) that is the same across the sidebar, header, and stepper, regardless of which step tab I am viewing.

**Why this priority**: The current per-step status in the header is the primary source of confusion — it makes the viewer feel "wrong". Fixing this is the foundation for every other improvement.

**Independent Test**: Open any spec from the sidebar. The status label shown in the sidebar list, the header badge, and the overall stepper state must match. Switching step tabs must not change the overall status display.

**Acceptance Scenarios**:

1. **Given** a spec whose current step is `plan` and whose `plan` step is in progress, **When** I switch between the Specify and Plan tabs, **Then** the header badge continues to read "Planning" (not "Specified" on the Specify tab).
2. **Given** a spec with `status: completed`, **When** I view any step, **Then** every surface reads "Completed" and no pulse animation is shown.
3. **Given** a Fast-SDD spec that produced all files in a single run, **When** the run finishes, **Then** the overall status is the agreed terminal state and the stepper shows all steps as done simultaneously rather than implying "Specifying".

---

### User Story 2 - Step progression driven by explicit events, not file existence (Priority: P1)

As a spec author, I want the stepper to advance only when a step has actually been executed by the workflow — not merely because a file exists on disk.

**Why this priority**: The "`plan.md` exists therefore planned" heuristic is the root cause of false progress indicators.

**Independent Test**: Manually create an empty `plan.md` (or leave a SpecKit template placeholder) in a spec directory without running the plan step. The stepper must not mark plan as started or completed.

**Acceptance Scenarios**:

1. **Given** a spec directory where only `spec.md` is filled and `plan.md` contains only a template scaffold, **When** the viewer loads, **Then** the Plan step shows as "Not started".
2. **Given** the `/speckit.plan` command runs to completion, **When** the run ends, **Then** `stepHistory.plan.startedAt` and `completedAt` are both set and the stepper reflects "Plan: completed".
3. **Given** `plan.md` exists but `.spec-context.json` has no `plan` entry in `stepHistory`, **When** the viewer loads, **Then** it treats the step as not started and does not back-fill from file presence.

---

### User Story 3 - Consistent context file across all workflow entry points (Priority: P1)

As a user running any supported workflow (SpecKit terminal, SpecKit + Companion, SDD, SDD Fast), I want `.spec-context.json` to be populated with the same shape and same lifecycle events so the viewer behaves identically.

**Why this priority**: The four sample specs show four different data shapes. The viewer can't render consistent UI on top of inconsistent data.

**Independent Test**: Run each of the four workflows end-to-end against a new scratch spec. Diff the resulting `.spec-context.json` files. The set of keys and the semantics of each field must match; only values (timestamps, names) differ.

**Acceptance Scenarios**:

1. **Given** a spec created via the terminal-only SpecKit CLI, **When** the viewer opens it, **Then** `.spec-context.json` contains `workflow`, `specName`, `branch`, `currentStep`, `status`, and a `stepHistory` entry for each step whose completion can be verified.
2. **Given** a Fast-SDD run that produces spec+plan+tasks in one invocation, **When** the run ends, **Then** `stepHistory` contains `startedAt` and `completedAt` for `specify`, `plan`, and `tasks`, and `status` reaches the agreed terminal state for Fast.
3. **Given** any workflow, **When** a step starts or completes, **Then** a corresponding append-only entry is added to a `transitions` array with `step`, `substep`, `from`, `by`, and `at`.

---

### User Story 4 - Substep tracking for long steps (Priority: P2)

As a user of Companion-driven workflows, I want substeps (e.g. `specify.outline`, `specify.validate-checklist`, `plan.research`, `plan.design`, `tasks.generate`, `implement.run-tests`) recorded in `stepHistory` and `transitions`, so the viewer can show fine-grained progress and so I can tell whether a step is stuck.

**Why this priority**: The user explicitly asked whether we track substeps — today we do not. This is needed for meaningful progress feedback during long-running steps.

**Independent Test**: Run a Companion-driven specify command that performs outline → draft → validate substeps. After completion, `stepHistory.specify.substeps` lists each substep with its own `startedAt`/`completedAt`, and `transitions` includes entries with non-null `substep`.

**Acceptance Scenarios**:

1. **Given** a `/speckit.specify` run emits a "validate" substep, **When** validation begins, **Then** a transition entry `{ step: "specify", substep: "validate", by: "extension", at: ... }` is appended.
2. **Given** a substep is running, **When** I view the stepper, **Then** the active step shows the substep label under it (e.g. "Specifying · validating checklist").

---

### User Story 5 - Correct visual indicators (pulse & highlight) (Priority: P2)

As a user, I want the pulsing "in-progress" indicator and the green "completed" highlight to always reflect reality.

**Why this priority**: Visual drift undermines trust in every other fix.

**Independent Test**: Walk a spec through Draft → Specifying → Planning → Tasking → Completed. At each state the pulse must be on exactly the active step, and the green highlight must be on exactly the completed steps. When `status` becomes `completed` or `archived`, no step pulses.

**Acceptance Scenarios**:

1. **Given** overall `status: completed`, **When** the viewer renders, **Then** no step tab shows the pulse animation.
2. **Given** a step is marked started but not completed, **When** the viewer renders, **Then** that step (and only that step) pulses.
3. **Given** a step has `completedAt` set, **When** the viewer renders, **Then** that step shows the green "done" highlight regardless of the currently selected tab.

---

### User Story 6 - Clear, scoped footer actions (Priority: P2)

As a user, I want the footer buttons to clearly communicate their scope (whole-spec vs current-step) and to only appear when contextually valid.

**Why this priority**: Users cannot tell today whether "Regenerate" rewrites the whole spec or just the step, and the SDD "Auto" button appears on steps where it does not apply.

**Independent Test**: Hover every footer button — each must have a tooltip that names its scope ("Affects this step" / "Affects whole spec"). Button visibility per step matches the scope rules below.

**Acceptance Scenarios**:

1. **Given** I am on any step tab, **When** I hover "Archive", **Then** the tooltip reads "Archive this spec (affects the whole spec)".
2. **Given** I am on any step tab, **When** I hover "Regenerate", **Then** the tooltip clarifies it re-runs only the current step.
3. **Given** the SDD workflow Auto button exists, **When** I view the Specify tab during spec creation, **Then** the Auto button is shown; on Plan/Tasks/Implement tabs or after Specify completes, it is hidden.
4. **Given** a step has never started, **When** I view its tab, **Then** only actions valid from that state (e.g. "Start") are shown — "Regenerate" is hidden until there is something to regenerate.

---

### User Story 7 - Reactive prompts update context at each lifecycle point (Priority: P3)

As a workflow author, I want each SpecKit Companion prompt (specify, clarify, plan, tasks, implement, analyze) to append a standard "update `.spec-context.json`" block so that every run reliably records `startedAt`, `completedAt`, and a `transitions` entry — without relying on file-system heuristics.

**Why this priority**: This is the implementation mechanism that makes Stories 2, 3, and 4 possible. It is P3 because it is a means to ends already captured above.

**Independent Test**: Grep every command prompt under `.claude/skills/speckit-*` and `.claude/skills/sdd*`. Each has a standardized pre-step and post-step context-update block that matches the agreed schema.

**Acceptance Scenarios**:

1. **Given** a prompt template for any step, **When** the step begins, **Then** the template instructs the agent to write `stepHistory.<step>.startedAt` and append a transition.
2. **Given** the step ends, **When** the agent finishes, **Then** `completedAt` is written and `currentStep` advances (or `status` becomes terminal).

---

### Edge Cases

- Spec directory contains pre-existing template `spec.md`/`plan.md`/`tasks.md` with no context file → overall status is "Draft"; no step is marked started.
- User manually edits `.spec-context.json` → viewer tolerates unknown fields and preserves them on next write.
- A step is re-run after completion (Regenerate) → `startedAt`/`completedAt` are overwritten for that step and a new transition is appended; previous transitions are retained.
- Workflow crashes mid-step → `startedAt` is set but `completedAt` is null; viewer shows the step as "in progress" until the user resumes or regenerates. Pulse stays on that step.
- A Fast-SDD run completes all steps in one invocation → all `stepHistory` entries get `startedAt` and `completedAt` written, and `status` transitions directly to the agreed terminal state.
- Terminal-only SpecKit run (no Companion) → Companion back-fills a minimal context on first viewer open, marking only what it can verify and never marking a step as "completed" from file presence alone.
- Archived spec → `status: archived` wins over all per-step states; stepper renders in a muted "historical" mode with no pulse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat `.spec-context.json` as the single source of truth for spec lifecycle status; the viewer MUST NOT infer step completion from file existence alone.
- **FR-002**: System MUST define a single canonical schema for `.spec-context.json` with these top-level fields: `workflow`, `specName`, `branch`, `selectedAt`, `currentStep`, `status`, `stepHistory`, `transitions`.
- **FR-003**: `status` MUST be a spec-wide value drawn from a defined set (e.g. `draft`, `specifying`, `specified`, `planning`, `planned`, `tasking`, `ready-to-implement`, `implementing`, `completed`, `archived`) and MUST be displayed identically across sidebar, header, and any step tab.
- **FR-004**: `stepHistory.<step>` MUST record `startedAt` and `completedAt` (ISO 8601) and MAY record a `substeps` array, each entry with `name`, `startedAt`, `completedAt`.
- **FR-005**: `transitions` MUST be an append-only array of `{ step, substep, from: {step, substep}, by, at }` entries.
- **FR-006**: Every Companion prompt (specify, clarify, plan, tasks, analyze, implement) MUST write a `startedAt` transition at the beginning and a `completedAt` transition at the end, including substep transitions where applicable.
- **FR-007**: The viewer MUST derive step badges (not-started / in-progress / completed) solely from `stepHistory`; the active pulse MUST be on exactly the step whose entry has `startedAt` set and `completedAt` null.
- **FR-008**: The viewer MUST stop the pulse and render the completed highlight when `completedAt` is set for that step, and MUST stop all pulses when `status` is `completed` or `archived`.
- **FR-009**: Footer buttons MUST be configured with explicit scope metadata (`spec` or `step`) and MUST render a tooltip that states the scope and the action.
- **FR-010**: Footer buttons MUST be visibility-gated per step and per status; the SDD "Auto" button MUST only appear during the Specify step when the workflow is in Draft/Specifying state.
- **FR-011**: When the viewer encounters a spec with no `.spec-context.json` (e.g. terminal-only run), it MUST create a minimal valid context marking only what can be verified (workflow, branch, specName, `status: draft`) without inferring step completion.
- **FR-012**: When a step is regenerated, System MUST overwrite that step's `startedAt`/`completedAt` and append (not replace) a transition record.
- **FR-013**: The viewer MUST tolerate and preserve unknown fields in `.spec-context.json` across writes.

### Key Entities

- **SpecContext**: The `.spec-context.json` document for a single spec directory. Holds workflow variant, spec identity (name, branch), current step pointer, spec-wide status, per-step history, and transition log.
- **StepHistoryEntry**: Per-step record of `startedAt`, `completedAt`, and optional `substeps` list.
- **Transition**: Append-only event describing a step or substep change, who caused it (`extension`, `user`, `cli`), and when.
- **FooterAction**: A button configuration with label, scope (`spec` | `step`), visibility rules (by step and by status), and a tooltip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of specs created through any of the four supported workflows produce a `.spec-context.json` matching the canonical schema (validated by a schema check on the four sample flows).
- **SC-002**: Zero cases where the stepper marks a step as started or completed based on file existence alone (verified by tests that pre-create template files and assert the step remains "not started").
- **SC-003**: In a walk-through of Draft → Completed, the sidebar status, header badge, and stepper state agree at every observed moment; measured by a manual QA script with 100% agreement across at least 4 transitions.
- **SC-004**: After `status: completed`, no step pulses in any view (verified across all four sample specs).
- **SC-005**: Every footer button exposes a tooltip that states its scope ("whole spec" vs "this step") on every step.
- **SC-006**: For Companion-driven runs, at least one substep transition is recorded per step whose prompt defines substeps (verified by inspecting `transitions` after a representative run).

## Assumptions

- The canonical status vocabulary will be finalized during planning; the list in FR-003 is the starting point.
- Substep names are defined per-prompt and are stable strings the viewer can display verbatim without localization.
- The viewer is the only writer of back-filled context fields; workflow prompts are the writers of lifecycle events.
- Terminal-only SpecKit runs cannot be intercepted; for those, the viewer reconciles on open and never marks steps completed without explicit evidence.

## Out of Scope

- Redesigning the viewer's visual layout beyond the specific elements called out (pulse, highlight, footer tooltips, scoped buttons).
- Migrating historical `.spec-context.json` files — existing files are read best-effort; no automatic rewrite.
- Adding new workflow steps or changing the step ordering.
