# Tasks: Restore Telemetry on PostHog

**Input**: Design documents from `specs/589-posthog-telemetry/` — [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/telemetry-contract.md](./contracts/telemetry-contract.md)

**Tests**: Included — the existing 501-line telemetry suite encodes the privacy contract (research R6) and is the regression net for the frozen event catalog; each story extends it.

**Shape note**: Almost the entire change lives inside `src/core/telemetry.ts` and its test file, so the story phases are *sequential* waves on those two files — the parallelism here is honest but narrow. The documentation story (US5) is the one genuinely independent track.

## Phase 1: Setup

**Wave 1 — single task:**

- [x] **T001** Extend the VS Code mock's `env` with `machineId`, a settable `isTelemetryEnabled`, and an `onDidChangeTelemetryEnabled` event stub (fireable from tests), so every later test wave can drive the identity and gate APIs · tests/__mocks__/vscode.ts

## Phase 2: Foundational

No foundational tasks. This feature swaps a transport inside one existing module behind a frozen public API — User Story 1 *is* the foundation the later stories layer onto, so work proceeds straight into the story phases.

## Phase 3: User Story 1 — Usage data flows again (P1) 🎯 MVP

**Goal**: Events post to PostHog's capture endpoint and appear in its dashboard; the dead Azure transport, its credential, and its dependency are gone; failures stay silent.

**Independent Test**: With a real project key pasted into the constant, install a build in a clean environment, trigger events (activate, open a spec), and see each in the PostHog dashboard within minutes. With the committed empty key, the extension behaves exactly as today (nothing sent, nothing logged).

### Implementation

**Wave 1 — the transport swap (single task, blocks everything):**

- [x] **T002** [US1] Swap the transport in `TelemetryService`: delete the `@vscode/extension-telemetry` import, reporter construction/disposal, and `APP_INSIGHTS_CONNECTION_STRING`; add the `POSTHOG_PROJECT_API_KEY` constant (empty string ⇒ no transport constructed, `sendEvent` returns `false` as today); `sendEvent` posts one capture payload — `api_key`, `event`, `distinct_id: vscode.env.machineId`, `properties` including `$process_person_profile: false` — to `POST https://us.i.posthog.com/i/v0/e/` via global `fetch`, fire-and-forget with `.catch(() => {})`, no queue/retries; the public surface in the contract stays byte-for-byte unchanged · src/core/telemetry.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T003** [P] [US1] Re-point the telemetry suite from the reporter mock to a mocked global `fetch` that captures posted payloads; every existing behavior block (extension gate, privacy coercions, funnel dedupe, engagement dedupe, correlation id) stays and passes; add wire-shape assertions (endpoint URL, `api_key`, `distinct_id` = mock `machineId`, `$process_person_profile: false`) and silent-failure assertions (rejected fetch and non-2xx surface nothing) · src/core/__tests__/telemetry.test.ts
- [x] **T004** [P] [US1] Remove the retired dependency end-to-end: drop `@vscode/extension-telemetry` from `package.json`, regenerate `package-lock.json` via npm, delete the `moduleNameMapper` entry in `jest.config.js`, and delete the mock file · package.json, package-lock.json, jest.config.js, tests/__mocks__/@vscode/extension-telemetry.ts
- [x] **T005** [P] [US1] Verify the activation wiring needs no change: `TelemetryService` construction, `initTelemetry`, and disposal registration in the extension entry point still line up with the swapped service (read-and-confirm; no edit expected) · src/extension.ts

**Checkpoint**: Delivery restored (pending only the maintainer pasting the real key), old backend fully excised, suite green against the new transport. US1 is independently testable.

## Phase 4: User Story 2 — Both telemetry switches keep their promise (P1)

**Goal**: The editor-wide telemetry gate lost with the old library is re-implemented; either switch closing stops all events instantly, no restart.

**Independent Test**: Toggle each switch in turn — no events leave while either is off; events resume when both are on again, mid-session.

### Implementation

**Wave 1 — single task (same file as T002, must follow it):**

- [x] **T006** [US2] Re-implement the editor-wide gate inside `TelemetryService`: cache a boolean initialized from `vscode.env.isTelemetryEnabled`, keep it current via a `vscode.env.onDidChangeTelemetryEnabled` subscription disposed in `dispose()`; `sendEvent` fires only when the cached editor-wide gate AND the `speckit.telemetry` setting (still read per send) are both true · src/core/telemetry.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task:**

- [x] **T007** [US2] Dual-gate tests: extension switch off ⇒ no fetch; editor-wide off with extension switch on ⇒ no fetch; firing the mock `onDidChangeTelemetryEnabled` mid-session disables and re-enables sending without reconstructing the service; subscription is disposed with the service · src/core/__tests__/telemetry.test.ts

**Checkpoint**: Both published switch promises hold live (FR-002/FR-003, SC-002/SC-003). US2 independently testable via the toggles.

## Phase 5: User Story 3 — Results break down the way they did before (P2)

**Goal**: Every event carries extension version, editor version, and platform, grouped per anonymous install — the breakdowns the old reporter attached automatically.

**Independent Test**: Inspect any captured payload and confirm the three facts plus the anonymous install identity are present and correctly valued.

### Implementation

**Wave 1 — single task (same file, follows T006):**

- [x] **T008** [US3] Attach the common properties in `TelemetryService`: merge `extensionVersion` (extension manifest), `vscodeVersion` (`vscode.version`), and `platform` (`process.platform`) — sourced once at construction — into every event's properties, with event-specific keys winning on collision; call-site payloads (including `buildActivatedProperties`) stay frozen · src/core/telemetry.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task:**

- [x] **T009** [US3] Common-property tests: every captured payload carries the three common facts; the `extension.activated` collision resolves to the event's own values; the five bare engagement events carry the common facts and nothing else (privacy contract line) · src/core/__tests__/telemetry.test.ts

**Checkpoint**: FR-004/SC-004 satisfied; dashboards can slice by version, editor, platform, and distinct anonymous installs. US3 independently testable from any one payload.

## Phase 6: User Story 4 — The install-prompt funnel reads as a conversion rate (P2)

**Goal**: The shown → clicked funnel is expressible natively in PostHog because the pinned identifiers survive the migration exactly.

**Independent Test**: Trigger a prompt-shown and prompt-clicked event and read the conversion rate in the dashboard's funnel view (funnel construction itself is documented in Phase 7).

### Implementation

**Wave 1 — single task:**

- [x] **T010** [US4] Funnel-contract tests through the new transport: `reportInstallPromptShown`/`reportInstallPromptClicked` post `companion.installPrompt` with `action` exactly `shown`/`clicked`; `surface` values outside the closed allow-list (`createSpec`, `activity`, `sidebarBadge`, `pinnedRow`, `welcome`, `terminal`, `activation`) are coerced; names and shapes byte-for-byte per the contract · src/core/__tests__/telemetry.test.ts

**Checkpoint**: The two funnel steps arrive named exactly as PostHog's native funnel definition expects (FR-007 wire side); US4 completes when Phase 7 documents the dashboard funnel.

## Phase 7: User Story 5 — Documentation points at the living backend (P3)

**Goal**: The telemetry docs teach PostHog and carry zero references to the retired backend.

**Independent Test**: Follow the documented query instructions end-to-end against PostHog; grep the shipped docs for the retired backend and find nothing.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T011** [P] [US5] Rewrite the query section of the telemetry doc as a PostHog guide: where the project lives, an activity/insights walkthrough of the frozen event catalog, the install-prompt funnel as a native two-step funnel (`companion.installPrompt` where `action = shown` → `action = clicked`, breakdown by `surface`) closing US4's read-without-a-query requirement, and HogQL equivalents of the three existing KQL samples; remove every App Insights reference · docs/telemetry.md
- [x] **T012** [P] [US5] Delete the Azure workbook — it has no target backend anymore (the old CHANGELOG mention stays; history is never rewritten) · docs/telemetry-workbook.json

**Checkpoint**: FR-010/SC-006 for the docs; a contributor can answer a usage question from the docs alone. US5 independently testable by following the guide.

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [x] **T013** [P] Sweep the shipped extension and docs for retired-backend leftovers: grep for App Insights / `applicationinsights` / `APP_INSIGHTS` / the old connection string across `src/`, `docs/`, `package.json`, `README.md`; fix any stragglers (SC-006, FR-008 final check) · repo-wide sweep
- [x] **T014** [P] Add the user-facing changelog entry under `## [Unreleased]` per docs/doc-sync.md — telemetry backend migrated, both switch guarantees kept, privacy contract unchanged (release-note voice, no internal symbol names) · CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task:**

- [x] **T015** Validate against the spec's Success Criteria: run the full test and lint suites; confirm SC-002/SC-003 (gate tests), SC-004 (common-facts tests), SC-005 (funnel documented + contract test), SC-006 (sweep clean), SC-007 (privacy blocks green); SC-001 remains a rollout check once the maintainer creates the PostHog project and pastes the key (research R4 open item) · full suite run

## Dependencies & Execution Order

**Phase order**: Setup (Phase 1) → US1 (Phase 3, the foundation) → US2 (Phase 4) → US3 (Phase 5) → US4 (Phase 6) → US5 (Phase 7) → Polish (Phase 8). Phase 2 is intentionally empty.

- **Phase 1**: one wave — T001 alone; blocks every test wave that follows.
- **Phase 3 (US1)**: Wave 1 (T002) blocks Wave 2 (T003 ∥ T004 ∥ T005 — three different file sets).
- **Phase 4 (US2)**: T006 (same file as T002, follows Phase 3) → T007.
- **Phase 5 (US3)**: T008 (same file, follows T006) → T009.
- **Phase 6 (US4)**: T010 alone, after Phase 5's test wave (same test file).
- **Phase 7 (US5)**: T011 ∥ T012 — independent of each other and of the code phases; this wave can run any time after planning decisions are fixed, in parallel with Phases 3–6.
- **Phase 8**: T013 ∥ T014, then T015 last — validation runs once, after everything else has landed.

**Parallel opportunities**: The genuinely parallel work is Phase 3 Wave 2 (T003/T004/T005), the US5 docs wave (T011/T012 — can overlap the entire code track), and Polish Wave 1 (T013/T014). Everything on `src/core/telemetry.ts` and its test file is a single sequential spine by design — one module, frozen API, ordered layers.
