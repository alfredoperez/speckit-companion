# Feature Specification: Context-Driven Badges and Dates

**Feature Branch**: `044-context-driven-badges`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "Use spec-context.json to control the badge and date display in the spec viewer. Changes should be provoked from the SpecKit Companion extension. If spec-context.json fields are missing, gracefully omit the badge/date."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Badge Reflects Current Step from spec-context.json (Priority: P1)

A user opens a spec in the viewer. The badge in the top metadata bar displays the current workflow step (e.g., "SPECIFYING", "PLANNING", "IMPLEMENTING") based on the `currentStep` field in `.spec-context.json`. When the user advances the step via the SpecKit Companion (e.g., clicking a lifecycle button or running a command), the badge updates to reflect the new step.

**Why this priority**: The badge is the primary visual indicator of spec progress. Deriving it from spec-context.json ensures a single source of truth and consistency across the extension.

**Independent Test**: Open a spec that has a `.spec-context.json` with `currentStep: "plan"`, verify the badge shows "PLANNING". Use the extension to advance to "tasks", verify badge updates to "IMPLEMENTING".

**Acceptance Scenarios**:

1. **Given** a spec directory with `.spec-context.json` containing `currentStep: "specify"`, **When** the user opens the spec viewer, **Then** the badge displays "SPECIFYING"
2. **Given** a spec is open in the viewer, **When** the user advances the step via a SpecKit Companion command, **Then** the badge updates to reflect the new `currentStep` value
3. **Given** a spec directory with `.spec-context.json` containing `status: "completed"`, **When** the user opens the spec viewer, **Then** the badge displays "COMPLETED"
4. **Given** a spec directory with `.spec-context.json` containing `status: "archived"`, **When** the user opens the spec viewer, **Then** the badge displays "ARCHIVED"

---

### User Story 2 - Date Display Derived from spec-context.json (Priority: P1)

A user opens a spec in the viewer. The "Created" date shown in the metadata header is derived from `stepHistory.specify.startedAt` in `.spec-context.json`. The "Last Updated" date is derived from the most recent timestamp across all `stepHistory` entries (or from the `updated` field if present). This replaces parsing dates from markdown frontmatter.

**Why this priority**: Dates hardcoded in markdown can drift from actual workflow timestamps. Using spec-context.json as the source of truth ensures dates reflect real activity.

**Independent Test**: Create a spec with `.spec-context.json` containing `stepHistory.specify.startedAt: "2026-04-01T10:00:00Z"` and `stepHistory.plan.startedAt: "2026-04-03T14:00:00Z"`. Open the viewer and verify "Created: Apr 1, 2026" and "Last Updated: Apr 3, 2026" appear.

**Acceptance Scenarios**:

1. **Given** a spec with `stepHistory.specify.startedAt` in `.spec-context.json`, **When** the viewer renders, **Then** the "Created" date reflects that timestamp
2. **Given** a spec with multiple `stepHistory` entries, **When** the viewer renders, **Then** the "Last Updated" date shows the most recent timestamp across all step entries
3. **Given** a spec where `.spec-context.json` has an `updated` field, **When** the viewer renders, **Then** the "Last Updated" date uses the `updated` field value

---

### User Story 3 - Graceful Fallback When spec-context.json is Missing or Incomplete (Priority: P1)

A user opens a spec that has no `.spec-context.json` file or one that is missing the `currentStep`, `status`, or `stepHistory` fields. The viewer gracefully omits the badge and/or date rather than showing errors, broken UI, or hardcoded defaults.

**Why this priority**: Not all specs will have a spec-context.json (e.g., manually created specs or specs from older versions). The viewer must degrade gracefully.

**Independent Test**: Open a spec directory that has only `spec.md` and no `.spec-context.json`. Verify the badge area and date fields are hidden (not shown as empty or "undefined").

**Acceptance Scenarios**:

1. **Given** a spec directory with no `.spec-context.json`, **When** the viewer renders, **Then** no badge is displayed and no date fields appear in the metadata
2. **Given** a `.spec-context.json` missing `currentStep` and `status`, **When** the viewer renders, **Then** no badge is displayed
3. **Given** a `.spec-context.json` missing `stepHistory`, **When** the viewer renders, **Then** no date fields appear in the metadata
4. **Given** a `.spec-context.json` with only some `stepHistory` entries, **When** the viewer renders, **Then** only available dates are shown (e.g., "Created" shows but "Last Updated" is omitted if only one entry exists)

---

### User Story 4 - Extension Actions Update spec-context.json (Priority: P2)

When a user performs lifecycle actions through the SpecKit Companion (complete, archive, reactivate, step advance), the extension updates `.spec-context.json` with the new status, step, and timestamps. The badge and dates in the viewer update accordingly without requiring a page reload.

**Why this priority**: This ensures the companion is the single source of truth for workflow state and that the viewer stays in sync.

**Independent Test**: Open a spec, click "Complete" in the viewer footer. Verify `.spec-context.json` now has `status: "completed"` and the badge shows "COMPLETED".

**Acceptance Scenarios**:

1. **Given** an active spec open in the viewer, **When** the user clicks "Complete", **Then** `.spec-context.json` is updated with `status: "completed"` and `stepHistory` records the completion timestamp, and the badge updates to "COMPLETED"
2. **Given** a completed spec, **When** the user clicks "Reactivate", **Then** `.spec-context.json` is updated with `status: "active"` and the badge reverts to the current step label
3. **Given** a spec at the "plan" step, **When** the user advances to "tasks", **Then** `.spec-context.json` is updated with `currentStep: "tasks"` and `stepHistory.tasks.startedAt` is set

---

### Edge Cases

- What happens when `.spec-context.json` contains malformed JSON? The viewer treats it as missing and omits badge/dates.
- What happens when `stepHistory` timestamps are in an unexpected format? Use best-effort parsing; omit the date if unparseable.
- What happens when `.spec-context.json` is deleted while the viewer is open? On next refresh or message, detect absence and remove badge/dates.
- What happens when multiple VS Code windows edit the same spec? The last write wins; viewer refreshes pick up the latest state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The spec viewer badge MUST be derived from the `currentStep` and `status` fields in `.spec-context.json`
- **FR-002**: The spec viewer "Created" date MUST be derived from `stepHistory.specify.startedAt` in `.spec-context.json`
- **FR-003**: The spec viewer "Last Updated" date MUST be derived from the most recent timestamp in `stepHistory` entries or the `updated` field in `.spec-context.json`
- **FR-004**: When `.spec-context.json` is absent or missing relevant fields, the viewer MUST omit the corresponding badge and/or date elements entirely (no empty placeholders, no fallback text)
- **FR-005**: When the user performs lifecycle actions (complete, archive, reactivate, step advance) through the SpecKit Companion, the extension MUST update `.spec-context.json` with the new state and timestamps
- **FR-006**: The viewer MUST update the badge and dates dynamically when `.spec-context.json` changes due to extension actions, without requiring a manual page reload
- **FR-007**: The viewer MUST handle malformed `.spec-context.json` gracefully by treating it as absent
- **FR-008**: The markdown frontmatter date fields ("Created", "Last Updated", "Date") MUST no longer be used as a source for date display when `.spec-context.json` is present

### Key Entities

- **FeatureWorkflowContext (`.spec-context.json`)**: The single source of truth for workflow state. Contains `currentStep`, `status`, `stepHistory` (timestamps per step), and optional `updated` field.
- **Badge**: A visual label in the spec viewer metadata bar indicating the current workflow step or status.
- **Date Fields**: "Created" and "Last Updated" displayed in the spec viewer metadata, derived from step timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of badge text in the spec viewer is derived from `.spec-context.json` fields — no hardcoded or markdown-derived badge values remain
- **SC-002**: Opening a spec without `.spec-context.json` shows no badge and no date fields, with no visual artifacts or error messages
- **SC-003**: All lifecycle actions (complete, archive, reactivate, step advance) update `.spec-context.json` and the viewer reflects changes within the same session without reload
- **SC-004**: Dates shown in the viewer match the timestamps recorded in `.spec-context.json` step history

## Assumptions

- The `specContextManager.ts` already provides `readSpecContext()`, `updateSpecContext()`, `setSpecStatus()`, and `updateStepProgress()` functions that handle reading/writing `.spec-context.json`. These will be leveraged rather than reimplemented.
- The `computeBadgeText()` function in `phaseCalculation.ts` already partially derives badge text from context fields. This feature extends that to be the sole source.
- The existing `preprocessors.ts` date handling (parsing "Created"/"Last Updated" from markdown) will be replaced by context-driven dates when context is available, and omitted when it is not.
- The webview already receives `navState` via message passing, which can be extended to include date information from spec-context.json.
