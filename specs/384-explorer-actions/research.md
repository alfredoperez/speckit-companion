# Research: Spec Explorer actions

**Feature**: 384-explorer-actions · Decisions behind [plan.md](./plan.md).

## D1 — Actions dispatch to the AI, never execute locally

- **Decision**: the drift/coverage/adopt actions build the `/speckit.companion.{drift,coverage,adopt}` command text (capability name appended for the per-node actions) and send it through `getAIProvider().executeSlashCommand(...)` — the same provider-agnostic path `specCommands.ts` uses for resume and lifecycle dispatch.
- **Rationale**: one-way dispatch is the product's architecture; the AI session runs the Python scripts where they're installed. Reusing the shipped path inherits every provider quirk already handled (terminal vs chat prefill).
- **Alternatives considered**: running the workspace Python scripts via `child_process` and showing output in a panel — rejected: violates the extension-isolation rule (the `.vsix` must not depend on workspace `.specify/**`) and duplicates the AI-session behavior with a second execution engine.

## D2 — Row health computed natively in TS, mirroring the Python

- **Decision**: extend `livingSpecsModel.ts` with `readCapabilityHealth`: coverage = parse requirement ids (`FR-\d+`/`NFR-\d+`) from the capability's `.spec.md` and count which appear on test-naming lines of the `.coverage.md` sibling (the `check-coverage.py` rule); drift = one async `git` call (`git log -1 --format=%H -- <spec>` then `git diff --name-only <commit>..HEAD`) filtered by the capability's `match`/`exclude` globs (the `drift.py` rule), minus its own spec/tier files and exempt globs.
- **Rationale**: `livingSpecsModel.ts` already exists precisely as the TS mirror of the resolver so the GUI needs no Python; health follows the same precedent. Counting and glob-matching reuse the module's `globMatches`.
- **Alternatives considered**: shelling to `drift.py --json` — rejected (isolation rule); computing drift purely from mtimes — rejected: false positives on checkout/build, and diverges from the CLI's definition.

## D3 — Async, time-bounded, failure-silent health

- **Decision**: `getChildren` for capability nodes awaits health with a hard timeout (~1.5s for the git call); any failure or timeout yields `undefined` health and the row renders exactly as today. A view-title refresh action re-fires the provider's `onDidChangeTreeData`.
- **Rationale**: FR-008's "never slow or break the tree" is the contract; VS Code tree providers accept promises so async needs no re-architecture.
- **Alternatives considered**: background polling/file-watchers — rejected for v1: adds churn for a signal the refresh button covers.

## D4 — Menu gating via existing context values

- **Decision**: `view/item/context` entries gate on `view == speckit.views.livingSpecs && viewItem == living-specs-capability` (drift/coverage); the view itself is already gated on `speckit.companion.installed`, which the title-menu adopt inherits. `living-specs-capability-missing` nodes get no per-node actions.
- **Rationale**: the provider already emits these `contextValue`s; the view-level `when` already encodes "companion installed", so no new context keys are needed.
- **Alternatives considered**: a new `speckit.livingSpecs.enabled` context key — rejected: redundant with what the tree already renders (off-state shows only the info node, which carries no capability contextValue).

## D5 — Command naming

- **Decision**: `speckit.livingSpecs.drift` / `.coverage` / `.adopt` / `.refresh`, registered in a new `livingSpecsCommands.ts`.
- **Rationale**: matches the `speckit.{feature}.{action}` registration convention; a dedicated module keeps `specCommands.ts` (spec lifecycle) from absorbing living-specs concerns.
