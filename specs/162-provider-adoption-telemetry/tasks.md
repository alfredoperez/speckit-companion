# Tasks: Provider-Adoption Telemetry

Dependency-ordered. `[P]` = touches a different file with no incomplete dependency.

## Setup

- [x] **T001** Add `@vscode/extension-telemetry` to `dependencies` in `package.json` and run `npm install` (updates `package-lock.json`).
- [x] **T002** Add the `speckit.telemetry` boolean setting (default `true`, privacy-explaining `markdownDescription`) to `contributes.configuration` in `package.json`.

## Foundational

- [x] **T003** Add `telemetryInstanceId?: string` to the `SpecContext` interface in `src/core/types/specContext.ts`.
- [x] **T004** [P] Add `"telemetryInstanceId": { "type": "string" }` to `properties` in `src/core/types/spec-context.schema.json`.
- [x] **T005** Create `src/core/telemetry.ts`: the committed `APP_INSIGHTS_CONNECTION_STRING` constant, `TelemetryService` (constructs reporter only when connection string non-empty; `sendEvent` gated on reporter-exists AND `speckit.telemetry`; `dispose()`), `getSpecTelemetryContext(specDir)` helper (reads profile + telemetryInstanceId, lazily generates+persists id), `buildBetaSnapshot()` helper, and a singleton accessor.

## Core / Integration — event sites

- [x] **T006** In `src/extension.ts` `activate()`: construct the service, push to `context.subscriptions`, fire `extension.activated` once (versions, specCount, beta snapshot).
- [x] **T007** In `src/extension.ts` `onDidChangeConfiguration` block: fire `provider.selected` with `{ providerId }` when `speckit.aiProvider` changes.
- [x] **T008** In `src/features/specs/specCommands.ts` `executeWorkflowStep`: fire `phase.dispatched` with `{ providerId, phase, profile, specInstanceId }`.
- [x] **T009** In `src/features/specs/specCommands.ts` `markCompleted` / `archive` handlers: fire `spec.completed` / `spec.archived` with `{ specInstanceId }` per target dir.
- [x] **T010** In `src/features/spec-viewer/messageHandlers.ts` `executeStepInTerminal`: fire `phase.dispatched` (viewer dispatch path).
- [x] **T011** In `src/features/spec-editor/specEditorProvider.ts`: at first spec-context write, mint+persist `telemetryInstanceId` and fire `spec.created` with `{ providerId, profile, specInstanceId }`.
- [x] **T012** In `src/features/workflows/workflowSelector.ts`: fire `workflow.selected` with `{ workflow }` for a non-default pick (built-in id verbatim, user-defined → `"custom"`).

## Polish — tests + docs

- [x] **T013** Add `tests/__mocks__/@vscode/extension-telemetry.ts` mock and map it in `jest.config.js` `moduleNameMapper`.
- [x] **T014** Add `src/core/__tests__/telemetry.test.ts`: gate (fires when on, no-op when `speckit.telemetry` false, no-op when connection string empty), specInstanceId generate/persist/reuse, beta-snapshot assembly.
- [x] **T015** [P] Add a `speckit.telemetry` subsection to README "Configuration" (JSON example, what's collected table, dual-gate, per-spec-id-is-not-the-name note).
- [x] **T016** [P] Add a user-facing `[Unreleased] ### Added` entry to root `CHANGELOG.md`.
- [x] **T017** Run `npm run compile && npm test`; fix any failures so the suite is green.

## Dependencies

- T001 blocks T005 (library import) and T006 (service construction).
- T003 blocks T005, T011 (the new field).
- T005 blocks every event-site task (T006–T012) and the tests (T013–T014).
- T002 blocks T005's gate behavior at runtime and the README (T015).
- T017 depends on everything.

## Parallel

- T004 (schema JSON) can run alongside T003.
- T015 and T016 (docs) can run alongside each other and after the event sites land.
- Event-site tasks T007–T012 touch different files and can proceed in parallel once T005 exists, except T008/T009 share `specCommands.ts` (serialize those two).
