# Data Model: Activation Funnel

Entities this feature introduces or reshapes. No database — state lives in the extension package (bundled asset), the user's workspace (seeded spec), VS Code `globalState`, per-session memory, and the telemetry wire format.

## Sample spec (bundled asset → seeded workspace spec)

**Bundled form** — `assets/sample-spec/` in the `.vsix`, read-only, never mutated:

| Field/File | Purpose | Rules |
|---|---|---|
| `spec.md`, `plan.md`, `tasks.md` | The curated documents (from the Command Palette Quick-Open demo material) | Read-worthy, self-explanatory to a first-time reader |
| `.spec-context.json` | The recorded run that makes the viewer worth looking at | Canonical `history[]` with extension-stamped start/complete pairs so the rail shows per-phase timing; `status` mid-flight (`ready-to-implement`); `sampleSpec: true` marker; NO `telemetryInstanceId` |

**Seeded form** — `specs/<sample-dir>/` in the user workspace, an ordinary user-owned spec:

- Created by `vscode.workspace.fs.copy(bundled, target, { overwrite: false })` — a whole-directory copy, atomic per file.
- State transitions: *absent* → *seeded* (copy succeeds, viewer opens) → user-owned lifecycle from there (deletable; deleting returns the zero-spec welcome; re-seeding works).
- Repeat-safety invariants (FR-004): target exists → reopen in viewer, zero writes; no workspace folder → explanatory error, zero writes.
- The `sampleSpec: true` field survives all extension writes (unknown-field preservation is contractual in the specs living spec) and permanently excludes the directory from watcher-created `spec.created`.

## Funnel event

One rung of the activation funnel. Full wire contract in [contracts/telemetry-events.md](./contracts/telemetry-events.md); the model:

| Event | De-dupe scope | De-dupe store | Emit seam |
|---|---|---|---|
| `extension.installed` | once-ever per install identity | `globalState[GlobalStateKeys.installedEventSent]`, claimed only after a confirmed send | `activate()` |
| `panel.opened` | once per session | in-memory `Set` via `sendEventOncePerKey` | `specsTreeView.onDidChangeVisibility` + initial-visible check |
| `spec.created` | once per spec creation | form path: inherent (one submit); watcher path: absence of `telemetryInstanceId` discriminates never-counted specs | form submit; context-file `onDidCreate` |
| `phase.dispatched` | none (each dispatch counts) — existing event, `profile` property removed | — | existing three emit sites |
| `spec.completed` | once per transition *into* `completed` | `TransitionCache` status diff (seed-then-diff) | context-file watcher (single owner) |
| `sample.opened` | once per session | in-memory `Set` | `speckit.openSampleSpec` |

Shared rules (FR-014): both telemetry switches gate every emit; a de-dupe slot (persistent or in-memory) is claimed only when `sendTelemetryEvent` returned `true`; payloads are shape-only (enums, booleans, counts, minted UUIDs).

## Workflow choice

The Create Spec form's model of one offerable workflow — produced ONLY by `buildWorkflowChoices()` in `workflowManager.ts` and mirrored across the webview message boundary:

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | string | workflow definition | stable id; telemetry coerces via shared `workflowTelemetryId` |
| `displayName` | string | definition | no longer carries the install-state suffix (the card renders state separately) |
| `description` | string | definition | Companion's is the pinned proof line, verbatim |
| `installed` | boolean | `isCompanionSelectable()` — the one shared predicate | `true` for stock and validated custom workflows |
| `supportsAuto` | boolean | definition | drives the hands-off affordance (unchanged) |
| `specifyCommands` | array | definition | per-command buttons (unchanged) |

Validation rules inherited from the canonical builder (now applied to the Create Spec surface too): invalid custom definitions skipped with logged reason; duplicate and reserved names rejected; provider-incompatible workflows omitted; Companion always present regardless of install state.

**Selection state** (webview-side, per submission): `selectedWorkflow: name` + `chosenAs: 'default' | 'picked' | 'trial'`. `'default'` = untouched pre-selection; `'picked'` = user changed selection; `'trial'` = taken via the `Try Companion for this spec` affordance. Never persisted; never writes `speckit.defaultWorkflow`.

## Transition cache entry (extended)

`TransitionCache` in `transitionLogger.ts`, keyed by spec directory:

| Field | Today | After |
|---|---|---|
| `step`, `substep` | cached, diffed for external-transition logging | unchanged |
| `status` | — | cached; old ≠ `completed` && new = `completed` → the single `spec.completed` emit |

Seeding: silent on first sight (no event), at activation's initial spec scan and on watcher `onDidCreate`; evicted on `onDidDelete`. Idempotence: a re-write of `completed` finds `completed` cached → no second event; the forward-only status rule upstream makes regressions non-events by construction.

## Spec telemetry identity (continuity fix)

| State | Today | After |
|---|---|---|
| Form submit | UUID minted, sent with `spec.created`/`phase.dispatched`, then **lost** (spec dir doesn't exist yet) | same UUID also seeded into the new spec's record via the creation preamble (`telemetryInstanceId`) |
| Later events | `getSpecTelemetryContext` mints a *different* persisted id | reads the preamble-seeded id → created→dispatched→completed join per spec |
| Terminal-created spec | no id until first event | watcher-created emit mints + back-fills via existing machinery |

## Persistent markers

| Key | Store | Meaning |
|---|---|---|
| `GlobalStateKeys.installedEventSent` (new, catalogued in `constants.ts`) | `globalState` | `extension.installed` was *confirmed sent* for this install identity; wiped state = new install identity (accepted) |
