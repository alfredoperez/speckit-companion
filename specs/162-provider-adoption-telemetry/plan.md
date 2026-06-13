# Implementation Plan: Provider-Adoption Telemetry

## Summary

Add a single `TelemetryService` (in `src/core/telemetry.ts`) that wraps `@vscode/extension-telemetry`'s `TelemetryReporter`, gates every `sendEvent` on both the reporter existing and `speckit.telemetry` being true, and is disposed via `context.subscriptions`. Wire seven PII-free events at their real dispatch sites, correlating per-spec events by a random `telemetryInstanceId` persisted in each spec's `.spec-context.json` (added to the schema/types, lazily backfilled). The connection string is committed as a write-only constant; a new `speckit.telemetry` boolean setting (default `true`) provides the second gate on top of VS Code's global telemetry level.

## Technical Context

- **Language/version**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API `^1.84.0`.
- **New dependency**: `@vscode/extension-telemetry` (bundled by webpack; auto-honors `telemetry.telemetryLevel`).
- **Storage**: `.spec-context.json` per spec dir (the new `telemetryInstanceId` field), written via the existing `specContextWriter`/`updateSpecContext`.
- **Backend**: Application Insights (write-only ingestion via the committed connection string).
- **Testing**: Jest + ts-jest with the existing `tests/__mocks__/vscode.ts`; add a mock for `@vscode/extension-telemetry` and map it in `jest.config.js`.
- **Constraints (hard)**: PII-free — only enum-like values, booleans, versions, counts, a random UUID. No prompt content, file paths, spec names, or custom workflow names. Fail closed on an empty connection string.

## Approach & Structure

Order of attack, by file:

1. **`src/core/types/specContext.ts`** — add `telemetryInstanceId?: string` to the `SpecContext` interface (first-class, optional).
2. **`src/core/types/spec-context.schema.json`** — add `"telemetryInstanceId": { "type": "string" }` to `properties` (schema already `additionalProperties: true`, but make it first-class).
3. **`src/core/telemetry.ts`** (new) — the single home:
   - `export const APP_INSIGHTS_CONNECTION_STRING = '…';` (committed write-only credential, one-line comment).
   - `class TelemetryService`: constructs a `TelemetryReporter` only when the connection string is non-empty; `sendEvent(name, properties?)` fires only when reporter exists AND `speckit.telemetry` is true; `dispose()`.
   - Helper `getSpecTelemetryContext(specDir)` → reads `{ profile, telemetryInstanceId }` from `.spec-context.json`, lazily generating + persisting the id (via `updateSpecContext`) when missing.
   - Helper `buildBetaSnapshot()` → reads the seven `speckit.*` config flags.
   - A module-level singleton accessor so event sites can fire without threading the service through every signature.
4. **`package.json`** `contributes.configuration` — add `speckit.telemetry` (boolean, default `true`) in the Beta Features block, with a privacy-explaining `markdownDescription`.
5. **`src/extension.ts` `activate()`** — construct the service, `context.subscriptions.push(service)`, fire `extension.activated` once (extensionVersion from `context.extension.packageJSON.version`, `vscode.version`, speckitCliVersion `'unknown'` (no detector exposes it), specCount via `resolveSpecDirectories`, plus the beta snapshot). Fire `provider.selected` in the existing `onDidChangeConfiguration('speckit.aiProvider')` block.
6. **`src/features/specs/specCommands.ts`** — fire `phase.dispatched` in `executeWorkflowStep`; fire `spec.completed` / `spec.archived` in the `markCompleted` / `archive` command handlers (read `specInstanceId` per target dir).
7. **`src/features/spec-viewer/messageHandlers.ts`** — fire `phase.dispatched` in `executeStepInTerminal` (the viewer dispatch path).
8. **`src/features/spec-editor/specEditorProvider.ts`** — fire `spec.created` when a new spec's `.spec-context.json` is first written (generate+persist the `telemetryInstanceId` there).
9. **`src/features/workflows/workflowSelector.ts`** — fire `workflow.selected` when the picker resolves a non-default workflow (map non-`speckit` ids → `"custom"`).
10. **Tests** — `src/core/__tests__/telemetry.test.ts`: gate behavior, empty-connection-string no-op, specInstanceId generate/persist/reuse, beta-snapshot assembly. Mock the reporter; never hit the network.
11. **Docs** — README "Configuration" subsection + root `CHANGELOG.md` `[Unreleased] ### Added`.

`providerId` at each site: `getConfiguredProviderType()` from `src/ai-providers/aiProvider.ts`. `profile` + `telemetryInstanceId`: the `getSpecTelemetryContext` helper.

## Out of Scope

- No Azure resource provisioning (the issue covers that one-time setup); we only commit the connection string and emit events.
- No dashboards / KQL queries shipped in the repo.
- No new telemetry beyond the seven events; no per-keystroke or content-bearing signal.
- No change to how providers/profiles/workflows themselves work — telemetry is observational only.

## Decisions

- **No `speckitCliVersion` detector exists** (the CLI detector only checks presence, not version) — send `'unknown'` rather than add a version probe in this change.
- **`spec.created` site**: the spec editor writes the first `.spec-context.json`; that's where the id is minted and the event fires, so create-time `profile` is read from the same write.
- **Lazy backfill** lives in `getSpecTelemetryContext`, so any per-spec event (phase/completed/archived) on a pre-existing spec mints the id on first touch — no migration pass needed.
