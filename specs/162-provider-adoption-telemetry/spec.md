# Provider-Adoption Telemetry

## Overview

Deliver opt-in, privacy-safe telemetry that reports how the extension is actually used — which AI provider is selected, which pipeline profile and beta flags are active, which workflow phases get dispatched, and how specs move through their lifecycle — so future investment can be prioritized from real adoption signal instead of guesses. All data is anonymous, contains no prompt content / file paths / spec names, and is gated on both the user's VS Code global telemetry setting and a dedicated extension setting.

## Functional Requirements

- **FR-001** The extension MUST send telemetry through the standard `@vscode/extension-telemetry` reporter so it automatically honors VS Code's global `telemetry.telemetryLevel`.
- **FR-002** The extension MUST expose a boolean setting `speckit.telemetry` (default `true`) that, when `false`, suppresses ALL telemetry events regardless of the global setting.
- **FR-003** A telemetry event MUST fire only when BOTH the reporter exists AND `speckit.telemetry` is true; if either is off, no event is sent.
- **FR-004** When the committed connection string is empty, the telemetry reporter MUST NOT be constructed and `sendEvent` MUST be a no-op (fail closed).
- **FR-005** The extension MUST fire `extension.activated` exactly once per activation with payload: `extensionVersion`, `vscodeVersion`, `speckitCliVersion` (or `"unknown"`), `specCount`, plus a beta snapshot: `templateProfile` (standard/turbo/off), `complexityFastPath`, `turboWorkflowPicker`, `resumeBeta`, `activityPanel`, `installPrompt`, `telemetry` (all booleans except `templateProfile`).
- **FR-006** The extension MUST fire `provider.selected` with `{ providerId }` when the `speckit.aiProvider` setting changes.
- **FR-007** The extension MUST fire `phase.dispatched` with `{ providerId, phase, profile, specInstanceId }` on each phase/step command dispatch (specify/plan/tasks/implement and any other lifecycle step) from both the sidebar command path and the spec-viewer dispatch path.
- **FR-008** The extension MUST fire `spec.created` with `{ providerId, profile, specInstanceId }` when a new spec is created.
- **FR-009** The extension MUST fire `spec.completed` with `{ specInstanceId }` when a spec is marked completed, and `spec.archived` with `{ specInstanceId }` when a spec is archived.
- **FR-010** The extension MUST fire `workflow.selected` with `{ workflow }` when a non-default workflow is chosen, where `workflow` is the built-in workflow id or the literal `"custom"` for any user-defined workflow — never the user's custom workflow name.
- **FR-011** Each spec MUST carry a random `telemetryInstanceId` (a UUID, NOT the spec name or path), generated at spec creation and persisted in that spec's `.spec-context.json`, so the same id rides every later event for that spec.
- **FR-012** For a spec that has no `telemetryInstanceId` yet (created before this feature, or created by a hook), the extension MUST lazily generate and persist one on the first telemetry event for that spec.
- **FR-013** The `telemetryInstanceId` field MUST be a first-class part of the spec-context schema and TypeScript types, and MUST survive hook rewrites of `.spec-context.json` (preserved by the existing merge-by-upsert writer).
- **FR-014** No telemetry payload MUST EVER contain prompt content, file paths, spec names, custom workflow names, or any other identifying data — only enum-like values, booleans, versions, counts, and the random UUID.
- **FR-015** The connection string MUST be committed in source as a constant (a write-only ingestion credential, safe to commit per the issue).
- **FR-016** The telemetry reporter MUST be disposed on extension deactivation (registered in `context.subscriptions`).

## Success Criteria

- **SC-001** With both telemetry switches on, triggering each of the seven event sites produces exactly one corresponding event, observable at the ingestion backend within 5 minutes.
- **SC-002** With `speckit.telemetry` set to `false`, no events are sent for any of the seven sites (0 events observed).
- **SC-003** With VS Code global telemetry off, no events are sent regardless of `speckit.telemetry` (0 events observed).
- **SC-004** With an empty connection string, no reporter is constructed and zero events are attempted (no network calls).
- **SC-005** 100% of telemetry payloads contain only the fields enumerated in the requirements — no spec name, path, prompt text, or custom workflow name appears in any payload.
- **SC-006** A spec exercised across create → dispatch → complete/archive carries one stable `telemetryInstanceId` across all of its events.
- **SC-007** A spec with no pre-existing `telemetryInstanceId` gets one generated and persisted on its first telemetry event, and reused (not regenerated) on every subsequent event.
- **SC-008** `extension.activated` fires exactly once per activation and includes all seven beta-snapshot fields.

## Assumptions

- The connection string supplied in the issue is set (non-empty) and is a write-only Application Insights ingestion credential, safe to commit.
- The seven beta-snapshot fields map to existing `speckit.*` settings; `templateProfile` reports the resolved string value (standard/turbo/off) and the rest are booleans read from config at activation.
- `providerId` is read from the current `speckit.aiProvider` setting at each event site; `profile` is the dispatching spec's resolved profile (standard/turbo) from its `.spec-context.json`.
- "Non-default workflow chosen" means the workflow picker resolves a workflow other than the implicit single-default auto-selection; built-in ids are sent verbatim, all user-defined workflows collapse to `"custom"` for privacy.
- Default `speckit.telemetry` is `true` (opt-in via VS Code's global telemetry gate, which users have already consented to); the dedicated setting lets users disable extension telemetry independently.
