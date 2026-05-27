# Feature Specification: Explicit History Entry Kind Field

**Feature Branch**: `111-history-entry-kind`
**Created**: 2026-05-27
**Status**: Draft
**Input**: User description: "Replace the from.step === step self-loop in .spec-context.json history[] entries with an explicit kind: start | complete field, so the schema is self-documenting and the disambiguator doesn't read like a typo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Writes Self-Documenting History Entries (Priority: P1)

An AI agent (Claude, Copilot, Gemini, etc.) writing to `.spec-context.json` should be able to tell — from the schema alone — whether an entry records the *start* of a step or its *completion*, without needing to understand the old self-loop convention (`from.step === entry.step`).

**Why this priority**: The schema is embedded in AI prompts. A self-documenting `kind` field eliminates ambiguity, reduces the chance the AI writes malformed entries, and makes prompt instructions shorter and clearer.

**Independent Test**: Open a fresh `.spec-context.json` written by the new writer. Confirm every entry has a `kind` field set to either `"start"` or `"complete"`. Confirm start entries have a non-null `from` object and complete entries omit `from`.

**Acceptance Scenarios**:

1. **Given** a spec step that is started, **When** the writer records the event, **Then** the history entry contains `"kind": "start"` and a `from` object referencing the prior step (or `null` if it is the first step).
2. **Given** a spec step that is completed, **When** the writer records the event, **Then** the history entry contains `"kind": "complete"` and no `from` field.
3. **Given** an AI reading the JSON Schema from the prompt preamble, **When** it needs to write a completion entry, **Then** it can determine the correct shape without consulting any external documentation.

---

### User Story 2 - Legacy Files Load Without Errors (Priority: P1)

A user who has `.spec-context.json` files created by an older version of the extension (entries lack `kind`, use the self-loop convention) should continue to see correct step timing and lifecycle state without any manual migration step.

**Why this priority**: Backward compatibility is critical — breaking existing user data would be a regression.

**Independent Test**: Open the extension against a workspace containing a legacy `.spec-context.json` file (no `kind` field, self-loop entries). Confirm the viewer displays the correct current step, status, and per-step timing. Confirm the file is migrated on the next write.

**Acceptance Scenarios**:

1. **Given** a legacy `.spec-context.json` (no `kind`, self-loop present), **When** the extension reads it, **Then** the reader synthesizes `kind` for each entry so the rest of the system operates on the new shape.
2. **Given** a legacy file that has been read and then any write is triggered, **When** the writer persists the file, **Then** the resulting file uses the new shape (with `kind`), not the old self-loop.
3. **Given** a legacy file with mixed valid and invalid entries, **When** the normalizer processes it, **Then** all entries are assigned the correct `kind` and no data is lost.

---

### User Story 3 - Step Timing and Lifecycle Behavior Is Unchanged (Priority: P2)

Any feature that depends on `history[]` — step timing display, running step detection, footer button state — should behave identically before and after the schema change.

**Why this priority**: The schema change is purely structural. Any user-visible behavior change would be an unintended regression.

**Independent Test**: Run the existing viewer against both a new-shape and a legacy file. Confirm the per-step elapsed times, the "running" indicator, and the footer button rendered match the expected values in both cases.

**Acceptance Scenarios**:

1. **Given** a `.spec-context.json` written in the new shape, **When** the viewer derives per-step timing, **Then** the calculated start time, end time, and duration for each step match the values from the `at` timestamps on the `start` and `complete` entries.
2. **Given** a `.spec-context.json` with a step in progress (has a `start` entry but no `complete` entry), **When** the viewer checks the running step, **Then** the step is identified as in-progress.
3. **Given** a fully completed spec (all steps have both `start` and `complete` entries), **When** the viewer checks the footer state, **Then** the correct completion button or completed state is shown.

---

### Edge Cases

- What happens when a history entry has neither a `kind` field nor a detectable self-loop pattern? → The normalizer should treat it as a `"start"` entry (safest fallback) and log a warning.
- What happens when the writer is called with a step that matches the current step but `kind` is missing in a new file? → The writer always emits `kind`; this case cannot occur in new files.
- How does the system handle a file where the same step has two `"start"` entries and no `"complete"` entry? → Step timing derivation picks the earliest start; behavior mirrors the existing implementation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `HistoryEntry` type MUST include a `kind` field with value `"start"` or `"complete"`.
- **FR-002**: Start entries MUST include a `from` object (`{ step, substep }`) and MUST set `kind` to `"start"`.
- **FR-003**: Complete entries MUST set `kind` to `"complete"` and MUST omit the `from` field (or set it to `null`/`undefined`).
- **FR-004**: The writer MUST always emit the new shape; it MUST NOT produce the old self-loop convention on any new write.
- **FR-005**: The reader MUST normalize legacy entries that lack `kind` by inferring `kind` from the self-loop convention before passing them to any consumer.
- **FR-006**: The JSON Schema embedded in the AI prompt preamble MUST document the `kind` field, the two valid shapes (start vs. complete), and provide an example entry for each.
- **FR-007**: Step timing derivation, running step detection, and footer state logic MUST drive disambiguation from `kind`, not from `from.step === entry.step`.
- **FR-008**: All existing automated tests MUST pass after the change; new tests MUST cover the legacy-normalization path.
- **FR-009**: The schema doc (`spec-context.schema.json`) MUST be updated to reflect the new `kind` field and the conditional `from` presence rule.

### Key Entities

- **HistoryEntry**: A single event in a spec's lifecycle. Attributes: `step`, `substep`, `kind` (new), `from` (conditional on `kind`), `by`, `at`.
- **HistoryEntryKind**: An enumeration with values `"start"` and `"complete"`.
- **Legacy HistoryEntry**: An entry written before this change — lacks `kind`, uses `from.step === step` as a completion marker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every entry written by the new writer can be classified as start or complete by reading `kind` alone, with no need to inspect `from.step`.
- **SC-002**: 100% of legacy `.spec-context.json` fixtures (in `tests/fixtures/`) load without error after normalization and produce the same derived per-step timing as before the change.
- **SC-003**: All existing automated test suites pass with no regressions.
- **SC-004**: The AI prompt preamble schema example, when given to an AI, produces valid new-shape entries on the first attempt (no self-loop entries generated).
- **SC-005**: A legacy file written by an older extension version is transparently migrated to the new shape on the next write, with no user intervention required.

## Assumptions

- The `from` field on complete entries carries no semantic value in the current codebase; removing it from complete entries will not break any consumer.
- The self-loop pattern (`from.step === entry.step` for completions, `from.substep === substep` for substep completions) is the only existing completion-detection mechanism; there are no other code paths relying on undocumented conventions.
- Test fixtures under `tests/fixtures/spec-context/` are the complete set of legacy shapes that need to be updated; no other fixture directories contain `.spec-context.json` files.
- The demo specs (`specs/_00_demo-specified/`, `_01_demo-planned/`, `_02_demo-tasked/`) contain `.spec-context.json` files that should also be updated to the new shape.
