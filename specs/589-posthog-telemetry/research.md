# Phase 0 Research: Restore Telemetry on PostHog

## R1 — Transport: direct capture API, no SDK

**Decision**: Post events straight to PostHog's single-event capture endpoint (`https://us.i.posthog.com/i/v0/e/`) using the Node runtime's global `fetch` (available since Node 18; VS Code ≥1.84 ships Node 18+). One POST per event, fire-and-forget, `.catch(() => {})`.

**Rationale**: The migration exists partly to *remove* a dependency (`@vscode/extension-telemetry`); replacing it with `posthog-node` would re-import the same class of problems — background batch/flush timers that hold the extension host or drop events at disposal, a larger supply-chain surface, and configuration we don't need at this volume (a handful of events per session). A raw POST is ~30 lines, trivially testable by mocking `fetch`, and satisfies FR-011's "no retry storm" edge case by construction.

**Alternatives considered**: `posthog-node` (batching, retries, flush lifecycle — all liabilities in an extension host, none needed at our volume); `posthog-js` (browser-oriented, wrong runtime); keeping a generic HTTP client dependency (nothing else in the extension needs one).

## R2 — Editor-wide gate: cached value + change subscription

**Decision**: The service caches a boolean initialized from `vscode.env.isTelemetryEnabled` and keeps it current with a `vscode.env.onDidChangeTelemetryEnabled` subscription (disposed with the service). `sendEvent` fires only when the cache AND the `speckit.telemetry` setting are both true.

**Rationale**: These two APIs are pinned verbatim in the spec, they are exactly what `@vscode/extension-telemetry` used internally, and the listener makes mid-session toggles take effect instantly in both directions (FR-003, acceptance scenario 3 of story 2) with no restart. The `speckit.telemetry` config read stays per-send, as today.

**Alternatives considered**: reading `vscode.env.isTelemetryEnabled` fresh on every send (functionally equivalent and simpler, but drops the pinned listener API and couples every send to a host getter); watching `telemetry.telemetryLevel` config directly (re-implements VS Code's own policy logic — `isTelemetryEnabled` already folds in machine policy and CLI flags).

## R3 — Identity: `vscode.env.machineId` as distinct id, anonymous processing

**Decision**: `distinct_id` = `vscode.env.machineId`, and every event carries `$process_person_profile: false` so PostHog stores them as anonymous events without person profiles.

**Rationale**: The old reporter attached the machine id automatically, so this restores prior behavior without collecting anything new; the id is VS Code's own anonymized identifier, not derived from the user. Anonymous processing matches the privacy contract (no person profiles to accumulate properties against) and is also the cheaper PostHog ingestion class.

**Alternatives considered**: minting a random install UUID in `globalState` (new state to manage, and a *second* identity when one already exists); no distinct id (breaks per-install grouping the spec's story 3 requires).

## R4 — Credential lifecycle

**Decision**: A `POSTHOG_PROJECT_API_KEY` constant in `src/core/telemetry.ts`, committed once the maintainer creates the PostHog project; an empty value constructs no transport (today's exact "empty connection string" behavior). US Cloud region.

**Rationale**: PostHog project API keys (`phc_…`) are write-only — they can capture events but cannot read data — the same safety property the issue confirmed for the old ingestion credential (FR-009). Keeping the empty-key no-op path means the code merges safely before the project exists and old test/dev builds stay silent.

**Alternatives considered**: env-var injection at build time (breaks the "works from a plain checkout" property and adds release machinery for a value that is safe to commit); EU region (no requirement, US is the default and closest to the maintainer).

**Open item for rollout (not a code blocker)**: create the PostHog project, paste the key, and re-verify current free-tier terms before the release that ships it — per the spec's assumption. Free tier is currently 1M events/month, orders of magnitude above extension volume.

## R5 — Common properties without touching call sites

**Decision**: The service merges `extensionVersion`, `vscodeVersion`, and `platform` into every event's properties (event-specific properties win on collision), sourced once at construction (`vscode.extensions.getExtension(...)` version, `vscode.version`, `process.platform`).

**Rationale**: Restores the reporter's automatic common facts (FR-004) while leaving every call-site payload untouched (FR-006). `extension.activated` already carries `extensionVersion`/`vscodeVersion` in its own payload; identical values make the merge collision harmless, and freezing `buildActivatedProperties` is safer than deduplicating it.

**Alternatives considered**: renaming to PostHog-style `$`-prefixed properties (breaks breakdown continuity with the recorded event vocabulary); adding the props at each call site (touches frozen surfaces).

## R6 — Tests and mocks

**Decision**: Delete `tests/__mocks__/@vscode/extension-telemetry.ts` and its `jest.config.js` mapping; assert through a mocked global `fetch` that captures posted payloads; extend `tests/__mocks__/vscode.ts` `env` with `machineId`, a settable `isTelemetryEnabled`, and an `onDidChangeTelemetryEnabled` event stub. Every existing behavior block in `src/core/__tests__/telemetry.test.ts` (dual gate, privacy coercions, funnel dedupe, engagement dedupe, correlation id) is kept and re-pointed; new blocks cover the editor-wide gate toggling live and the common-property merge.

**Rationale**: The 501-line test file encodes the privacy contract — it is the regression net for FR-005/FR-006 and must survive the transport swap intact.

**Alternatives considered**: an injectable transport interface on `TelemetryService` (more seams than the module needs; mocking `fetch` tests the real code path).

## R7 — Documentation target

**Decision**: Rewrite the "Reading these in App Insights" section of `docs/telemetry.md` as a PostHog guide — where the project lives, an activity/insights walkthrough for the event catalog, the install-prompt funnel as a native two-step funnel (`companion.installPrompt` filtered `action = shown` → `action = clicked`, broken down by `surface`), and equivalent HogQL samples for the three existing KQL queries. Delete `docs/telemetry-workbook.json` (Azure workbook, no target left; only `docs/telemetry.md` and an old CHANGELOG entry reference it — changelog history is never rewritten).

**Rationale**: FR-010 and SC-006 — the docs must teach the new backend and carry zero references to the retired one. The README §Telemetry paragraph is already backend-neutral and points at `docs/telemetry.md`, so it needs no change; likewise the `speckit.telemetry` setting description mentions only VS Code's global switch, which remains true.

**Alternatives considered**: keeping the workbook file as history (it would be the exact "stale doc pointing at the dead backend" the issue calls a defect).
