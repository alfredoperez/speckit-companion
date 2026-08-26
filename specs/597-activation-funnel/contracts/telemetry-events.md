# Contract: Funnel Telemetry Events

The wire contract for every event this feature adds, changes, or retires. Event names pinned by the spec's Verbatim Constraints are used exactly: `extension.installed`, `spec.created`, `spec.completed`, `workflow.selected`. Funnel stage order, exactly: installed → panel opened → spec created → phase dispatched → completed.

Every event below inherits the service contract (unchanged from `specs/589-posthog-telemetry/contracts/telemetry-contract.md`): both switches gate every send; common facts attached (`extensionVersion`, `vscodeVersion`, `platform`); `distinct_id = vscode.env.machineId`, `$process_person_profile: false`; fire-and-forget, no retry/queue/batch; shape-only payloads. New rule made explicit (FR-014): **no de-dupe slot — persistent or in-memory — is claimed unless `sendTelemetryEvent` returned `true`.**

## New events

### `extension.installed`

| | |
|---|---|
| Fires | in `activate()`, when `globalState[installedEventSent]` is unset |
| Once-ness | once ever per install identity; marker written only after a confirmed send; wiped globalState = new install identity (accepted); never per-session |
| Properties | common facts only |
| Distinct from | `extension.activated`, which keeps firing per session unchanged |

### `panel.opened`

| | |
|---|---|
| Fires | first time the specs tree view (`speckit.views.explorer`) becomes visible in a session — `onDidChangeVisibility` plus an initial `visible` check at creation |
| Once-ness | per session (in-memory, `sendEventOncePerKey`); repeated visibility toggles never re-fire |
| Properties | common facts only (bare engagement event, same class as `spec.opened`) |

### `sample.opened`

| | |
|---|---|
| Fires | `speckit.openSampleSpec` ran (seed or reopen) |
| Once-ness | per session |
| Properties | common facts only |
| Purpose | measures the welcome's sample rung without polluting `spec.created` |

## Changed events

### `spec.created`

| Property | Values | Change |
|---|---|---|
| `providerId` | existing enum | unchanged |
| `workflow` | `speckit` \| `companion` \| `custom` | now the **effective post-install-modal selection** — the same value seeded into the spec's record — coerced by the single shared `workflowTelemetryId` (built-ins verbatim, `default`→`speckit`, anything else → `custom`). The `command.includes('companion.')` sniff is removed. |
| `chosenAs` | `default` \| `picked` \| `trial` | NEW — how the workflow was selected in the form; `trial` = the `Try Companion for this spec` affordance |
| `specInstanceId` | UUID | now also persisted into the new spec's record via the creation preamble, so later events for the same spec carry the SAME id |
| `source` | `form` \| `watcher` | NEW — `watcher` marks a terminal-created spec first observed via the context-file watcher (FR-016) |

Watcher emission rule: `onDidCreate` of a `.spec-context.json` whose parsed content has **no `telemetryInstanceId` and no `sampleSpec` marker** → emit with `source: 'watcher'` (`workflow` from the record, coerced; no `chosenAs`), then mint + back-fill the id. A context carrying an id was form-created and already counted.

### `spec.completed`

| | |
|---|---|
| Emit seam | **single owner**: the context-file watcher's status-transition detection (`TransitionCache` old ≠ `completed` → new = `completed`). The direct emit in the sidebar command path is **removed**. |
| Covers | all three completion paths — sidebar action, viewer lifecycle action, Companion terminal step (Python-written) — exactly once per transition into `completed` |
| Once-ness | per transition; seed-then-diff means an already-completed spec first observed never fires; a re-write of `completed` never re-fires |
| Properties | `specInstanceId` (via `getSpecTelemetryContext`) |

### `phase.dispatched`

Unchanged emit sites and properties, except the legacy `profile` property (`standard`/`turbo`) is **no longer attached** anywhere; `profileTelemetryId` is removed. Funnel rung 4 reads from this event as-is.

## Retired events

### `workflow.selected`

Its only emit site is inside the unregistered `selectWorkflow` quick-pick (dead code, removed by this feature). The event is retired from `docs/telemetry.md` with a note; its name is never reused. Its coercer becomes the shared `workflowTelemetryId` export in `core/telemetry.ts`.

## Disclosure obligations (FR-015)

`docs/telemetry.md` must list, in its "What is collected" table: `extension.installed`, `panel.opened`, `sample.opened`, the new `spec.created` properties (`workflow`, `chosenAs`, `source`), the `spec.completed` all-paths semantics, the `profile` removal, and the `workflow.selected` retirement. Its "Reading these in PostHog" section gains the five-stage funnel recipe in the pinned order, and records the specify-vs-plan parity verification result (FR-019). The behavioral twin lives in `src/core/core.spec.md` (events, de-dupe rules, both-switches gating) and is updated in the same change.
