# Implementation Plan: One Beta Gate for the SpecKit Companion Workflow

**Branch**: `170-single-beta-gate` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/170-single-beta-gate/spec.md`

## Summary

Collapse the two confusing opt-ins for the enhanced SpecKit Companion experience into a single honest beta setting. Today the Create-Spec workflow picker is *always* shown (so choosing "Companion" silently does nothing when the companion piece isn't installed), while a separate `companion.resumeBeta` toggle gates the resume button. This change adds one `speckit.companion.workflowBeta` setting (default off) that gates the whole surface, removes `companion.resumeBeta` and migrates its value into the new setting, and shows the picker only when the new setting is on AND the companion spec-kit extension is installed. Resume enablement and telemetry read the new setting. Activation must survive any historical stored value (the provider-rename lesson).

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); webview is Preact bundled via Webpack 5
**Storage**: VS Code `settings.json` (configuration) + on-disk presence of `.specify/extensions/companion/`
**Testing**: Jest (ts-jest), BDD `describe`/`it`; VS Code mock at `tests/__mocks__/vscode.ts`
**Target Platform**: VS Code ≥ 1.84.0 (desktop)
**Project Type**: single (VS Code extension + bundled webview)
**Performance Goals**: N/A — activation-time migration + synchronous config/disk reads
**Constraints**: Migration MUST NOT fail activation for any stored value (FR-005); extension ships only `src/` + bundled webview (no `.claude/**` / `.specify/**` runtime dependency)
**Scale/Scope**: ~6 source files + package.json schema + README/docs/CHANGELOG; one new + one extended migration, one workflow-list gate, telemetry field rename

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. The change is purely about configuration surface; it reduces two settings to one and keeps custom workflows and `defaultWorkflow` overridable. No provider logic touched.
- **II. Spec-Driven Workflow** — PASS. The Specify→Plan→Tasks→Implement pipeline and the Companion workflow steps are unchanged; only the *gate* that reveals the Companion option moves. Existing Companion specs keep their steps (resolution path untouched).
- **III. Visual and Interactive** — PASS. The user-facing change is a clearer single toggle and an honest picker (no hollow option); it improves the visual surface.
- **IV. Modular Architecture for Complex Features** — PASS. Edits land in existing focused modules (settings migration, workflow manager, extension wiring, telemetry); no new monolith. No webview-architecture change (the picker collapses via the existing length>1 rule).

**Result**: No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/170-single-beta-gate/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — settings + derived gates + transitions
├── quickstart.md        # Phase 1 — build & manual validation
├── contracts/
│   └── settings-and-gates.md   # Config schema + gate function contracts
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
package.json
  └─ contributes.configuration         # + speckit.companion.workflowBeta; − speckit.companion.resumeBeta

src/
├── core/
│   ├── constants.ts                    # ConfigKeys.resumeBeta → speckit.companion.workflowBeta
│   ├── settingsMigration.ts            # + migrateResumeBetaToWorkflowBeta()
│   ├── settingsMigration.test.ts       # + migration cases (all historical values, scope, idempotent)
│   ├── telemetry.ts                    # BetaSnapshot.resumeBeta → workflowBeta
│   └── __tests__/telemetry.test.ts     # update snapshot field
├── extension.ts                        # call new migration; resume context key reads new setting (activate + onDidChangeConfiguration)
└── features/
    └── workflows/
        └── workflowManager.ts          # gate COMPANION_WORKFLOW into the SELECTION list only when beta+installed

README.md                               # Beta Features config section (FR-010)
CHANGELOG.md                            # user-facing entry
docs/sidebar.md, docs/how-it-works.md,  # references to the old resume toggle / picker gating
docs/template-profiles.md, docs/capture-and-timing.md
```

**Structure Decision**: Single-project VS Code extension. All work is in existing `src/` modules plus the `package.json` configuration schema and docs. No new modules, no `speckit-extension/` changes (this is the VS Code extension half — root README/CHANGELOG, `v*` release lane).

## Complexity Tracking

No constitution violations — section intentionally empty.

## Phase 0 — Research

See [research.md](./research.md). Six decisions, all grounded in existing code:
1. New key `speckit.companion.workflowBeta` (boolean, default off, Beta Features group).
2. Migration moves the old opt-in then drops the old key, reusing `coerceLegacyBoolean` + per-scope `inspect()`; wrapped in try/catch so activation never fails.
3. Gate `COMPANION_WORKFLOW` into the selection list (`getWorkflows`) only when beta+installed; resolution path (`getAllWorkflows`) keeps it always.
4. Resume context key `speckit.resumeBeta` repointed at the new setting (name kept).
5. Telemetry snapshot field renamed to `workflowBeta`.
6. Docs: root README + affected `docs/*.md` + CHANGELOG.

No open NEEDS CLARIFICATION.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — settings, derived gates (`pickerShown`, `resumeEnabled`, `companionInstalled`), state transitions per user story, and migration validation rules.
- [contracts/settings-and-gates.md](./contracts/settings-and-gates.md) — the configuration schema delta, the migration function's value-mapping table and guarantees, the workflow-list inclusion table (selection vs. resolution), and the resume/telemetry/install-prompt contracts.
- [quickstart.md](./quickstart.md) — build commands and the three manual validation scenarios (A: installed, B: missing, C: migration matrix).
- Agent context: the `CLAUDE.md` plan reference between the SPECKIT markers is updated to point here.

## Phase 2 — Next

`/speckit.tasks` will turn the contracts into a dependency-ordered task list. Not produced by this command.
