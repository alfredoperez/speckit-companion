# Quickstart: Verifying Command Mode Selection

**Feature**: `134-command-mode-selection` · **Date**: 2026-06-09

Manual verification that the mode reframe is non-destructive and produces the right shape. Maps directly to the spec's acceptance scenarios and success criteria.

## Prerequisites

- The SpecKit Companion extension built and installed locally (`/install-local`).
- A workspace initialized with the companion spec-kit extension (so `/speckit.companion.*` commands are present).

## 1. Lean mode never fails to create a spec (US1 · SC-001)

1. Set `speckit.companion.templateProfile` to `lean`.
2. Create a new spec from the sidebar on each supported provider in turn.
3. **Expect**: the spec is created; the dispatched command is `/speckit.companion.specify`; no "Unknown command: /speckit-specify" appears in any terminal/chat.

## 2. Switching modes never deletes either command set (US2 · SC-002)

1. Note the seven `/speckit.*` command files and the four `/speckit.companion.*` command files on disk.
2. Toggle the setting `standard → lean → standard` a few times.
3. **Expect**: after every switch, both the stock `/speckit.*` set and the `/speckit.companion.*` set are still present. No `specify preset remove` of the standard family ran.

## 3. One option maps to the right shape; old menu is gone (US3 · SC-003, SC-005)

1. Set the option to `lean`, create/run a spec → **expect** the lean shape (no user-story section, files/deps tasks, smaller spec folder; commands dispatch as `/speckit.companion.*`).
2. Set the option to `standard`, create/run a spec → **expect** the standard shape (stock `/speckit.*`).
3. Right-click a spec in the sidebar → **expect** no "Template Profile → Standard / Lean" submenu (it is retired).

## 4. Both sets survive reload and fresh checkout (US4 · SC-004)

1. With both sets present, reload the editor window → **expect** both sets still present, a spec can be created with no manual repair.
2. Check out the repo into a clean clone, open it → **expect** the activation ensure re-materializes the standard family; both sets present; spec creation works.

## 5. In-flight safety (Edge Case)

1. With the default `lean`, create a spec (pinned `profile: "lean"`).
2. Change the default to `standard`.
3. Continue that spec through plan → tasks → implement → **expect** it keeps dispatching `/speckit.companion.*` (its pinned shape); the default change did not reshape it.

## 6. Recovery of a stranded project (Edge Case · FR-009)

1. Simulate the old-swap stranded state: remove the stock `/speckit.*` command files and ensure no companion preset is installed.
2. Reload / re-activate the extension.
3. **Expect**: the add-only ensure re-emits the stock `/speckit.*` family; creating a spec succeeds with no "Unknown command" and no manual repair step.

## Pass criteria (success-criteria mapping)

| Step | Spec criterion |
|---|---|
| 1 | SC-001 — zero "Unknown command" across providers and modes |
| 2 | SC-002 — 100% of both sets remain after any number of switches |
| 3 | SC-003, SC-005 — single surface, old menu absent, shape matches mode |
| 4 | SC-004 — both sets present after reload and fresh checkout |
| 5 | In-flight spec not stranded/corrupted by a default change |
| 6 | FR-009 — stranded project recovers to both-sets-present |
