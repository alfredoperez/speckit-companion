# Feature Specification: Transition Logging

**Feature Branch**: `052-transition-logging`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Add transition logging when the extension writes to .spec-context.json, and use the transition log to display workflow history."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extension logs transitions on context writes (Priority: P1)

When the extension updates the workflow step or substep in `.spec-context.json`, a transition record is appended to a `transitions` array in the same file. This captures the previous step/substep, the new step/substep, the actor ("extension"), and a timestamp.

**Why this priority**: Without transition logging, there is no audit trail of how a spec moved through the workflow. This is the foundational data that all other stories depend on.

**Independent Test**: Navigate a spec through multiple workflow steps (specify -> plan -> tasks) and verify `.spec-context.json` contains a `transitions` array with one entry per step change, each recording the correct `from`, `step`, `substep`, `by`, and `at` fields.

**Acceptance Scenarios**:

1. **Given** a spec at step "specify" with no transitions array, **When** the extension advances the step to "plan", **Then** a `transitions` array is created containing one entry with `step: "plan"`, `substep: null`, `from: { step: "specify", substep: null }`, `by: "extension"`, and `at` set to the current ISO timestamp.
2. **Given** a spec with an existing transitions array (including entries written by SDD with `by: "sdd"`), **When** the extension updates the step, **Then** the new entry is appended and all existing entries are preserved.
3. **Given** a spec at step "plan" with `substep: null`, **When** the extension writes an update that does not change `step` or `substep`, **Then** no new transition entry is appended.
4. **Given** no `.spec-context.json` exists yet, **When** the extension creates it for the first time, **Then** a transition entry is appended with `from: null`.

---

### User Story 2 - Detect and log external (SDD) transitions via file watcher (Priority: P2)

When an external tool (e.g., SDD) modifies `.spec-context.json` and changes the step or substep, the extension detects this change and logs a message to the output channel so the user knows the workflow advanced outside the extension.

**Why this priority**: The extension must observe SDD-driven transitions without modifying SDD. This enables awareness of external workflow changes and feeds data into the history view.

**Independent Test**: Manually edit `.spec-context.json` to change `currentStep` and add a transition entry with `by: "sdd"`. Verify the output channel shows: `[SpecKit] Transition detected: specify -> plan (by: sdd)`.

**Acceptance Scenarios**:

1. **Given** a spec at step "specify" cached in memory, **When** `.spec-context.json` is modified externally to step "plan" and the latest transition entry has `by: "sdd"`, **Then** the output channel logs `[SpecKit] Transition detected: specify -> plan (by: sdd)`.
2. **Given** a spec at step "plan" cached in memory, **When** `.spec-context.json` is modified by the extension itself (latest transition has `by: "extension"`), **Then** no output channel message is logged.
3. **Given** no prior cached state for a spec directory, **When** the watcher fires for the first time, **Then** the current step/substep is cached without logging a transition.

---

### User Story 3 - View workflow history timeline in spec viewer (Priority: P3)

A "History" section in the spec viewer webview displays the full transition timeline, showing each transition as a step change with timestamp and source tag, color-coded by source and with backtracking highlighted.

**Why this priority**: This gives users a visual audit trail of how a spec progressed through the workflow, including who drove each transition. It builds on the data from P1 and the detection from P2.

**Independent Test**: Open a spec that has multiple transitions (from both extension and SDD) in the spec viewer. Verify the History section renders each transition with correct step labels, timestamps, source tags (blue for "sdd", green for "extension"), and that any backward movement (e.g., tasks -> plan) is highlighted in orange.

**Acceptance Scenarios**:

1. **Given** a spec with three transitions in `.spec-context.json`, **When** the spec viewer is opened, **Then** a "History" section displays all three transitions in chronological order, each showing `from step -> to step` with timestamp and source tag.
2. **Given** transitions with mixed sources, **When** the History section renders, **Then** entries with `by: "sdd"` have blue color-coding and entries with `by: "extension"` have green color-coding.
3. **Given** a transition where the step moves to an earlier position in the workflow (e.g., from "tasks" back to "plan"), **When** the History section renders, **Then** that entry is highlighted in orange to indicate backtracking.
4. **Given** a spec with no transitions array, **When** the spec viewer is opened, **Then** the History section is either hidden or shows an empty state message.

---

### Edge Cases

- What happens when `.spec-context.json` is malformed or the transitions array contains invalid entries? The extension should preserve existing entries and skip rendering invalid ones.
- What happens when multiple rapid step changes occur? Each change should produce its own transition entry; debouncing should not collapse transitions.
- What happens when `substep` changes but `step` remains the same? A transition entry should still be created since the substep changed.
- What happens when `.spec-context.json` is deleted and recreated? The in-memory cache should reset, and the new file should start fresh with `from: null`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read the current `currentStep` and `substep` values from `.spec-context.json` BEFORE merging any updates, to populate the `from` field of the transition entry.
- **FR-002**: System MUST append a transition entry to the `transitions` array whenever `currentStep` or `substep` changes, with fields: `step`, `substep`, `from` (containing previous `step` and `substep`), `by` (always "extension" for extension-written transitions), and `at` (ISO 8601 timestamp).
- **FR-003**: System MUST set `from` to `null` when creating `.spec-context.json` for the first time (no previous state exists).
- **FR-004**: System MUST NOT append a transition entry when the new `step` and `substep` values are identical to the current values.
- **FR-005**: System MUST preserve all existing transition entries (append-only), including entries written by external tools with `by: "sdd"`.
- **FR-006**: System MUST maintain an in-memory cache of last-known `step`/`substep` per spec directory for the file watcher to compare against.
- **FR-007**: System MUST log to the output channel when an external transition is detected (latest transition entry not written by "extension"), formatted as: `[SpecKit] Transition detected: {fromStep} -> {toStep} (by: {source})`.
- **FR-008**: System MUST NOT log to the output channel when the extension itself wrote the latest transition.
- **FR-009**: System MUST render a "History" section in the spec viewer that displays all transition entries from `.spec-context.json`.
- **FR-010**: System MUST color-code transition entries by source: blue for "sdd", green for "extension".
- **FR-011**: System MUST highlight transitions that represent backtracking (step moving to an earlier position in the workflow) in orange.
- **FR-012**: System MUST NOT modify tree view icon logic, workflow step definitions/ordering, or any SDD-managed fields in `.spec-context.json`.

### Key Entities

- **Transition Entry**: Represents a single workflow step change. Contains `step` (target step), `substep` (target substep or null), `from` (object with previous step/substep, or null for initial), `by` (source: "extension" or "sdd"), and `at` (ISO 8601 timestamp).
- **Transition Cache**: In-memory map keyed by spec directory path, storing the last-known `step` and `substep` for detecting external changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every workflow step change made by the extension produces exactly one transition entry in `.spec-context.json` with correct `from`, `step`, `substep`, `by`, and `at` fields.
- **SC-002**: External step changes (by SDD or manual edits) are detected and logged to the output channel within the file watcher debounce window.
- **SC-003**: The spec viewer History section displays all transition entries for a spec, with correct color-coding and backtracking highlights.
- **SC-004**: Existing transition entries written by external tools are never overwritten or lost during extension writes.

## Assumptions

- The workflow step ordering for backtracking detection uses the same step order already defined in the workflow configuration (specify -> plan -> tasks -> implement -> done).
- `substep` values are optional and default to `null` when not present in the context.
- The output channel referenced is the existing SpecKit output channel used elsewhere in the extension.
- The History section is placed below the existing spec viewer content, not replacing any current sections.
- SDD writes its own transition entries with `by: "sdd"` — the extension only needs to read and display them, not write them.
