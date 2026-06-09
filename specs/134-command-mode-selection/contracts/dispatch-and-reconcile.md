# Contracts: Command Mode Selection

**Feature**: `134-command-mode-selection` · **Date**: 2026-06-09

This is a VS Code extension feature; its "interfaces" are not HTTP endpoints but three internal contracts that other code and the host AI depend on. Each contract below states inputs, outputs, and the invariants a test must assert.

## Contract A — Mode → command resolution (`resolveProfileCommand`)

**Location**: `src/features/specs/profileDispatch.ts`

**Signature**: `resolveProfileCommand(command: string, specDirectory: string): string`

**Behavior**:

| Input `command` | Spec `profile` | Output |
|---|---|---|
| `speckit.specify` (or `plan`/`tasks`/`implement`) | `lean` | `speckit.companion.specify` (matching twin) |
| `speckit.specify` (or twin-eligible) | `standard`, absent, or invalid | `speckit.specify` (unchanged) |
| any command without a `/speckit.companion.*` twin | any | unchanged |
| any command | context unreadable/corrupt | unchanged (no throw) |

**Invariants tests must assert**:

- A `lean` spec resolves all four pipeline commands to their `/speckit.companion.*` twins (FR-004).
- A `standard`/absent spec resolves every command to the stock name (FR-008).
- The output is always a command name that exists on disk for every supported provider — i.e. resolution never yields a name with no backing file (FR-005). No "Unknown command" is reachable through this path.
- The function never throws and never performs I/O beyond reading the spec context.

## Contract B — The single mode option (`speckit.companion.templateProfile`)

**Location**: `package.json` `contributes.configuration`; mirror `.specify/companion.yml`; read via `readTemplateProfile()`.

**Shape**: `"standard" | "lean" | "off"`, default `"standard"`, window scope.

**Behavior contract** (changed from preset-swap to routing):

- Setting the value records the project default and (for `standard`/`lean`) seeds new specs' pinned `profile`. It MUST NOT, as a side effect, add/remove/swap any preset that deletes a command set (FR-002, FR-003).
- `off` routes to stock and asserts no `companion-standard` ensure; it is the explicit upstream escape hatch (Decision 4), outside the standard↔lean non-destructive guarantee.
- The description text MUST NOT reference the retired right-click menu or the mutually-exclusive preset reconcile.

**Invariants tests must assert**:

- Changing the value does not emit any `specify preset remove` for the standard family.
- A spec created while the default is `lean` is pinned `profile: "lean"`; changing the default to `standard` afterward leaves that spec's `profile` unchanged (in-flight safety).

## Contract C — Activation ensure-standard (recovery + steady state)

**Location**: `src/extension.ts` activation; `src/features/settings/companionPresetReconciler.ts` (repurposed to add-only ensure).

**Behavior**:

- On activation, idempotently ensure the standard command family is present: if the stock pipeline command files are absent, run the add-only ensure (`specify preset add --dev .specify/extensions/companion/presets/companion-standard`) to re-emit them. Never run a remove of the standard family.
- A one-time migration MAY remove a leftover `companion-lean` / legacy `sdd-lean` install, but the mode option issues no removes thereafter.
- All CLI failures are logged, not thrown — activation must never break (existing reconciler guarantee, preserved).

**Invariants tests must assert**:

- The ensure operation is add/enable-only for the standard family; the decision function emits no `remove` for `companion-standard` regardless of input state (FR-002).
- Re-running the ensure when the family is already present is a no-op (idempotent; FR-006).
- Given a "stranded" starting state (no stock command files, no companion presets), the ensure emits the bundled-path add that re-materializes them (FR-009).

## Host-AI command contract (unchanged, restated)

The host AI must always be able to resolve the dispatched command. After this feature:

- Standard specs dispatch `/speckit.specify | plan | tasks | implement` — present via `specify init` + the always-on `companion-standard` carrier.
- Lean specs dispatch `/speckit.companion.specify | plan | tasks | implement` — present via the companion extension's `provides.commands`.

Neither family is gated on a mutually-exclusive preset; both are always resolvable on every supported provider (SC-001).
