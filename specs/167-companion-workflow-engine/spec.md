# Companion Workflow Engine — the SpecKit Companion workflow on spec-kit's engine

> Source: [#292](https://github.com/alfredoperez/speckit-companion/issues/292) · composable-workflow epic ([#295](https://github.com/alfredoperez/speckit-companion/issues/295)) · Wave 1 · W1·1 · Surface: **spec-kit extension** (`speckit-extension/`)

## Overview

Define the SpecKit Companion pipeline as a first-class spec-kit **workflow definition** that runs on spec-kit's own workflow engine (`specify workflow run`/`resume`), instead of being a loose set of `/speckit.companion.*` commands a user invokes by hand. The workflow walks `branch → specify → plan → tasks → implement → mark-complete`, right-sizes small versus large changes with a routing node (replacing the old `complexityFastPath` toggle), and always ends by marking the spec `completed`. It is purely additive: the stock `speckit` workflow and any other extensions are untouched, and we build no orchestrator of our own — the engine already provides steps, gates, conditional routing, and pause/resume.

## Functional Requirements

- **FR-001** The extension MUST ship a workflow definition at `speckit-extension/workflows/speckit-companion.workflow.yml` whose ordered nodes are `branch (setup) → specify → plan → tasks → implement → mark-complete (terminal)`, mirroring the shape of the bundled `speckit` workflow (`schema_version`, `workflow`, `requires`, `inputs`, `steps`).
- **FR-002** Each pipeline node MUST dispatch the corresponding Companion command (`speckit.companion.specify`, `speckit.companion.plan`, `speckit.companion.tasks`, `speckit.companion.implement`) — or the stock `speckit.*` command where no Companion override exists — as a `command` step, resolving the integration via the engine's `integration: "auto"` default.
- **FR-003** The workflow MUST include review **gate** steps between phases (at minimum before plan and before tasks) consistent with the bundled `speckit` workflow, so a run pauses for human approval and `on_reject` aborts.
- **FR-004** The workflow MUST contain a **routing node** (a `switch`/`if_then` step) that, after specify, branches on a complexity signal: a small change folds plan and tasks toward implement, a normal change runs the full pipeline, and an oversized change emits a visible warning and runs the full pipeline — it MUST NOT silently skip steps.
- **FR-005** The complexity thresholds (the former `complexityFastPath` 5-files / 10-tasks guardrail) MUST live inside the workflow definition as the routing node's configuration, with no separate user-facing on/off toggle.
- **FR-006** The workflow MUST end with a Companion-owned **terminal `mark-complete` step** that writes `status: completed` to `.spec-context.json` once all preceding nodes have finished; the stock `speckit` path MUST continue to force-close without this terminal step.
- **FR-007** The workflow MUST be registered so the engine discovers it: added under `provides` in `speckit-extension/extension.yml` (alongside the existing `commands`/`hooks`), including any `category`/`effect` fields the installed 0.9.5 schema requires.
- **FR-008** `speckit-extension/extension.yml`'s `requires.speckit_version` floor MUST be raised to the 0.9.x release that provides the `specify workflow run`/`resume` engine and the step types this workflow uses (`command`, `gate`, `switch`/`if_then`).
- **FR-009** A run MUST be resumable: `specify workflow resume <run_id>` continues from the exact node where the run paused, and each step MUST keep capturing into `.spec-context.json` so the Companion GUI reflects progress for both run and resume.
- **FR-010** The change MUST be additive — installing this workflow MUST leave the bundled `speckit` workflow, its commands, and any other installed extensions behaving exactly as before (no edits to stock spec-kit files).
- **FR-011** A pre-flight re-validation against the installed spec-kit (0.9.5.dev0) MUST confirm the current workflow schema, the `run`/`resume` commands, the extension-schema `category`/`effect` fields, and the hook `priority`/list form before the workflow definition is finalized; the spec MUST be reconciled to what the installed CLI actually accepts.
- **FR-012** User-facing docs MUST be updated in the same change: `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`, `speckit-extension/extension.yml` `version`, and the relevant `docs/*.md` (workflow/template-profiles/capture references), plus root `CLAUDE.md` where the dual-extension or capture model is described. Root README/CHANGELOG/`package.json` MUST NOT be touched (this is a spec-kit-extension-only change).
- **FR-013** The capture eval MUST pass for a full Companion workflow run: `.spec-context.json` records each step with real (non-backfilled) timing, the implement step journals per-task finishes, and the run terminates at `completed`.

## Success Criteria

- **SC-001** `specify workflow run speckit-companion` executes specify → plan → tasks → implement → mark-complete end to end on the installed spec-kit (0.9.5.dev0), pausing at each defined gate.
- **SC-002** `specify workflow resume <run_id>` resumes a paused run from the exact node it stopped at, in 100% of paused-run trials, with no repeated or skipped step.
- **SC-003** For a small change the routing node folds plan/tasks toward implement; for a normal change it runs all four phases; for an oversized change it prints a warning and still runs all four — verified across one fixture per branch (3/3 route correctly, 0 silent skips).
- **SC-004** Every completed Companion workflow run ends with `.spec-context.json` `status: completed` (100% of completed runs).
- **SC-005** Running the Companion workflow leaves the stock `speckit` workflow definition and all other extension files byte-for-byte unchanged (diff shows only additive files plus the extension's own README/CHANGELOG/version/docs).
- **SC-006** The capture eval (the `/eval-speckit-extension` checks) reports green for a full Companion workflow run, including real per-step timing and per-task implement journaling.
- **SC-007** All workflow YAML and extension manifest fields validate against the installed 0.9.5 schema (the CLI loads the workflow with zero validation errors).

## Assumptions

- The installed spec-kit (0.9.5.dev0) is the validation target; the `speckit_version` floor is set to the matching 0.9.x release line. The pre-flight (FR-011) governs the exact value and any schema field names.
- The "routing node" is implemented with the engine's existing `switch` (or `if_then`) step type — confirmed present in the installed CLI's step registry — not a custom step type.
- The complexity signal feeding the routing node reuses the established guardrail thresholds (≤5 files / ≤10 tasks → small; otherwise normal; over-threshold → warn-and-full), the same heuristic the retired `complexityFastPath` used, now expressed in YAML rather than a setting.
- Gates mirror the bundled `speckit` workflow's review gates (review-spec / review-plan with `on_reject: abort`); the exact gate set is reconciled to the bundled shape during pre-flight.
- The `mark-complete` terminal step is realized via an existing or thin new `speckit.companion.*` command the node dispatches (the AI never hand-writes `completed`; the terminal step's command writes it), consistent with the rule that `completed` is the final gate.
- "Selecting stock SpecKit leaves everything untouched" means the Companion workflow is a separate, additionally-registered definition; no stock workflow file is edited or overridden.
- The webview/VS Code extension surface is out of scope for this ticket — this is a `speckit-extension/`-only change; GUI consumption of the resulting `.spec-context.json` is covered by existing capture behavior.
