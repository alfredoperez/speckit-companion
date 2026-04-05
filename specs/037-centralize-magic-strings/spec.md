# Feature Specification: Centralize Magic Strings into Constants

**Feature Branch**: `037-centralize-magic-strings`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "Centralize magic strings scattered across the src/ directory into constants."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Centralize Workflow Step Strings (Priority: P1)

A developer adding or modifying workflow logic needs to reference a workflow step value (e.g., 'specify', 'plan', 'tasks', 'implement') or its legacy config key variant ('step-specify', etc.). Instead of typing a raw string and risking a typo that silently breaks behavior, the developer imports a named constant from the central constants module. Autocomplete surfaces the correct value and any rename propagates through the compiler.

**Why this priority**: Workflow step strings are the most frequently scattered (~149 occurrences across 19 files). A single typo in a step name can silently break spec progression without obvious errors.

**Independent Test**: Change a workflow step constant's value to an intentionally wrong string; confirm the compiler still builds but all dependent features break visibly, proving the constant is the single source of truth.

**Acceptance Scenarios**:

1. **Given** a developer needs to check whether a spec is in the 'specify' phase, **When** they reference the workflow step, **Then** they use `WorkflowSteps.SPECIFY` instead of a raw `'specify'` string.
2. **Given** a developer searches the codebase for raw `'specify'`, `'plan'`, `'tasks'`, or `'implement'` strings in src/, **When** the search completes, **Then** zero results appear outside of the constants definition itself and test fixtures.
3. **Given** the legacy config key pattern `'step-specify'` is needed, **When** the developer looks up the constant, **Then** a dedicated constant provides the value without manual string concatenation.

---

### User Story 2 - Centralize Spec Status Strings (Priority: P1)

A developer working on spec lifecycle logic needs to compare or set a spec's status ('active', 'completed', 'archived', 'tasks-done'). They import a named constant rather than typing the raw string.

**Why this priority**: Status strings drive spec lifecycle transitions (~116 occurrences). An incorrect status value can corrupt spec state silently.

**Independent Test**: Grep src/ for raw status strings; confirm only the constants definition and test fixtures contain them.

**Acceptance Scenarios**:

1. **Given** code that checks `status === 'active'`, **When** centralized, **Then** it reads `status === SpecStatuses.ACTIVE`.
2. **Given** all status-bearing files are updated, **When** the project compiles, **Then** no type errors or test failures occur.

---

### User Story 3 - Centralize AI Provider Names (Priority: P2)

A developer adding provider-specific logic references provider name strings ('claude', 'gemini', 'copilot', 'codex', 'qwen'). They use a central `AIProviders` constant object that backs the existing `AIProviderType` union type.

**Why this priority**: Provider strings (~37 occurrences) are used in branching logic where a typo leads to an unmatched case and broken provider support.

**Independent Test**: Grep src/ for raw provider name strings; confirm only the constants definition remains.

**Acceptance Scenarios**:

1. **Given** a developer adds a new AI provider, **When** they add it to the `AIProviders` constant, **Then** the `AIProviderType` union automatically includes the new value.
2. **Given** existing code uses `'claude'` as a raw string, **When** centralized, **Then** it references `AIProviders.CLAUDE`.

---

### User Story 4 - Centralize Global State Keys (Priority: P2)

A developer working on extension state (version skip, update checks, init suggestion dismissal) uses named constants instead of raw `'speckit.skipVersion'` strings.

**Why this priority**: Only ~4 occurrences but these control update behavior; a typo means the extension silently ignores saved state.

**Independent Test**: Grep src/ for the three raw global state key strings; confirm zero matches outside constants.

**Acceptance Scenarios**:

1. **Given** `updateChecker.ts` references `'speckit.skipVersion'`, **When** centralized, **Then** it uses a named constant from `ConfigKeys.globalState`.
2. **Given** all global state key usages are updated, **When** the project compiles and tests run, **Then** no regressions occur.

---

### User Story 5 - Consolidate Tree Context Values (Priority: P2)

A developer working on tree views finds all tree context value strings in one place (`TreeItemContext` in constants.ts) instead of split across `constants.ts` and `treeContextValues.ts`.

**Why this priority**: The split across two files causes confusion about which file is authoritative (~15 values in the separate file).

**Independent Test**: Confirm `treeContextValues.ts` is deleted or re-exports from constants.ts; grep for its old imports and find zero.

**Acceptance Scenarios**:

1. **Given** `treeContextValues.ts` defines `TreeContext.STEERING_DOCUMENT`, **When** consolidated, **Then** the value lives in `TreeItemContext` in constants.ts.
2. **Given** all imports of `treeContextValues.ts` are updated, **When** the project compiles, **Then** no import errors occur.

---

### User Story 6 - Consistent Document Type References (Priority: P3)

Existing `CoreDocumentTypes`/`CORE_DOCUMENTS` from `spec-viewer/types.ts` are used consistently instead of raw `'spec'`, `'plan'`, `'tasks'` strings scattered across other modules.

**Why this priority**: ~50 occurrences of raw document type strings exist outside spec-viewer. These duplicate the already-defined constants.

**Independent Test**: Grep src/ for raw `'spec'`, `'plan'`, `'tasks'` used as document type identifiers; confirm they reference the existing type constants.

**Acceptance Scenarios**:

1. **Given** a file outside spec-viewer uses `'spec'` as a document type, **When** updated, **Then** it imports and uses `CORE_DOCUMENTS.SPEC` or equivalent.
2. **Given** all document type references are updated, **When** the project compiles and tests pass, **Then** no regressions occur.

---

### Edge Cases

- What happens when a constant value is referenced in string interpolation (e.g., template literals)? Constants must work seamlessly in template strings.
- What happens when a constant is used in a `switch` statement? TypeScript must still narrow types correctly with `as const` assertions.
- How are constants used in `package.json` `contributes` sections handled? Those remain raw strings (JSON doesn't support imports) and are out of scope.
- What about test files that use these same magic strings? Test files should use the constants too, except for intentional raw-string test fixtures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a `WorkflowSteps` constant object in `constants.ts` containing all workflow step identifiers ('specify', 'plan', 'tasks', 'implement') and their legacy config key variants ('step-specify', 'step-plan', 'step-tasks', 'step-implement').
- **FR-002**: System MUST define a `SpecStatuses` constant object in `constants.ts` containing all spec lifecycle status values ('active', 'tasks-done', 'completed', 'archived').
- **FR-003**: System MUST define an `AIProviders` constant object in `constants.ts` containing all provider identifiers ('claude', 'gemini', 'copilot', 'codex', 'qwen') that backs the `AIProviderType` union type.
- **FR-004**: System MUST add a `globalState` sub-object to `ConfigKeys` in `constants.ts` containing keys for version skip tracking, update check timestamps, and init suggestion dismissal.
- **FR-005**: System MUST consolidate all tree context values from `treeContextValues.ts` into the `TreeItemContext` constant in `constants.ts`, eliminating the separate file or converting it to a re-export.
- **FR-006**: System MUST replace all raw string usages of the above values in src/ with their corresponding constant references.
- **FR-007**: System MUST ensure existing `CoreDocumentTypes`/`CORE_DOCUMENTS` from `spec-viewer/types.ts` are imported and used consistently across src/ instead of raw 'spec', 'plan', 'tasks' document type strings.
- **FR-008**: System MUST preserve all existing behavior — this is a pure refactor with no functional changes.
- **FR-009**: System MUST pass `npm run compile` and `npm test` with zero new errors or test failures after all changes.

### Key Entities

- **WorkflowSteps**: Represents the four phases of the spec-driven development workflow and their config key variants.
- **SpecStatuses**: Represents the lifecycle states a spec can be in.
- **AIProviders**: Represents the supported AI CLI tool providers, backing the AIProviderType union.
- **ConfigKeys.globalState**: Represents extension-level persistent state keys stored via the extension host's global state API.
- **TreeItemContext**: Consolidated tree view context values used for menu contributions and tree item identification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero raw magic strings for workflow steps, spec statuses, AI providers, global state keys, and tree context values remain in src/ outside of the constant definitions themselves and test fixtures.
- **SC-002**: All existing automated tests pass with no modifications to test assertions (only import changes allowed).
- **SC-003**: The project compiles successfully with zero errors.
- **SC-004**: The total number of files defining these constant values is reduced from ~4 scattered locations to 1-2 centralized modules.
- **SC-005**: Any developer adding a new workflow step, status, or provider only needs to update the constant definition in one place.

## Assumptions

- Raw strings in `package.json` (command IDs, menu contributions, configuration keys) are out of scope since JSON files cannot import constants.
- URL strings, extension identifiers, and file/directory name gaps are explicitly out of scope per the feature description.
- Test files will be updated to use constants where they reference these values, except for intentional raw-string test data.
- The `AIProviderType` union type will be derived from the `AIProviders` constant object to maintain a single source of truth.
- The existing `SpecStatus` type in `spec-viewer/types.ts` includes 'tasks-done' in addition to the three statuses mentioned; all four values will be included in `SpecStatuses`.

## Scope Boundaries

**In scope**:
- WorkflowSteps, SpecStatuses, AIProviders, GlobalStateKeys constant groups
- Tree context value consolidation
- Consistent use of existing DocumentTypeNames/CoreDocumentTypes
- Replacing all raw string usages in src/ with constants

**Out of scope**:
- URL strings and endpoint constants
- Extension identifiers
- File/directory name gaps in the existing FileNames/Directories constants
- Strings in package.json (not importable)
- Webview-side code (browser context, separate build)
