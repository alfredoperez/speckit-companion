# Implementation Plan: Complexity Fast-Path

**Branch**: `137-complexity-fast-path` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/137-complexity-fast-path/spec.md`

## Summary

Auto-detect small changes and right-size the ceremony. A **classify step** added to the turbo specify command body reads size signals from the feature description (projected files, projected tasks, scope phrases) against the existing tiny-change ceiling (5 files / 10 tasks). When a change classifies *simple* and the fast-path is enabled, the specify run produces a single combined spec/plan/tasks artifact and writes the lifecycle so plan and tasks read as satisfied-by-fast-path, landing the developer at implement in one run. *Normal* changes — and anything past the threshold (with a guardrail warning) — keep the full specify → plan → tasks → implement pipeline. A new opt-in config knob (`speckit.companion.complexityFastPath`, default off — beta) is set in the editor (VS Code settings) and mirrored to the machine-local `.specify/companion.yml` the command body reads; the editor setting is the single source of truth. Per the project's presets-vs-commands decision, all complexity logic lives in this project's own `/speckit.companion.*` command bodies; core spec-kit commands are untouched.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict) for the VS Code extension; Python 3 for `write-context.py`; Markdown command bodies (AI prompts) for the spec-kit (`companion`) extension.
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); spec-kit CLI preset/command/hook mechanism (`.specify/extensions.yml`).
**Storage**: File-based — `.spec-context.json` per spec; `.specify/companion.yml` (gitignored project-level mirror); VS Code `settings.json` (editor-level).
**Testing**: Jest (config-resolution unit tests, extension side); `eval-speckit-extension` (end-to-end command-body behavior + capture verification, spec-kit side).
**Target Platform**: VS Code extension host (Node) + AI CLI terminal that runs the dispatched `/speckit.companion.*` commands.
**Project Type**: single — two co-located, independently-versioned extensions (VS Code extension in `src/`; spec-kit extension in `speckit-extension/`).
**Performance Goals**: N/A — interactive pipeline; no throughput target.
**Constraints**: Extension isolation (CLAUDE.md) — fast-path behavior must ride in shipped command bodies + extension-built prompt text, never by editing `.claude/**` or `.specify/**` at runtime. Classification is best-effort heuristic and MUST err toward *normal* on weak/conflicting signals so a change is never under-planned by accident.
**Scale/Scope**: One new config knob; the classify step + minimal-mode branch added to the turbo specify body; lifecycle entries (plan + tasks) folded via `write-context.py`; one doc (`docs/template-profiles.md`) + both READMEs/changelogs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. The fast-path is overridable through a VS Code setting (and the project-level mirror), satisfying "default behaviors MUST be overridable through VS Code settings." No provider logic touched.
- **II. Spec-Driven Workflow** — PASS. The non-negotiable Specify → Plan → Tasks → Implement pipeline is preserved: the fast-path **folds** plan and tasks into the specify run rather than dropping them, the combined artifact still carries plan- and task-level content (sequential-phase artifact model intact), and FR-010 records the folded steps as satisfied so the lifecycle never shows them missing or stuck. *Normal* changes run the full pipeline unchanged.
- **III. Visual and Interactive** — PASS (lifecycle-transition guard). Pipeline-step compression is heuristic, but the lifecycle **Active → Completed → Archived** transitions remain explicit user actions: the fast-path lands the spec at the implement step, it does not auto-complete or auto-archive. The heuristic is also opt-in (off by default) and errs toward *normal*.
- **IV. Modular Architecture** — PASS. Logic is split across clear seams: config resolution (extension `src/`), classify + branch + lifecycle (turbo command body + `write-context.py`).

No violations → Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/137-complexity-fast-path/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── config-setting.md
│   ├── classification.md
│   └── lifecycle-fold.md
├── spec.md              # Feature spec (input)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/                                         # VS Code extension (shipped in .vsix)
├── core/
│   └── constants.ts                         # ConfigKeys: add complexityFastPath key
└── features/
    └── settings/
        └── companionPresetReconciler.ts     # read/resolve + mirror the flag into .specify/companion.yml
        └── companionPresetReconciler.test.ts# resolution + mirror unit tests (Jest)

package.json                                 # contributes.configuration: new boolean setting (default false)

speckit-extension/                           # spec-kit extension (shipped as speckit-ext-v* archive)
├── extension.yml                            # version bump
├── CHANGELOG.md                             # spec-kit-side release note
├── README.md                                # spec-kit-side feature note
├── commands/
│   └── speckit.companion.specify.md         # classify step + minimal-mode (fast-path) branch
├── presets/
│   └── companion-turbo/commands/speckit.specify.md  # parity with the per-spec opt-in body
└── scripts/
    └── write-context.py                     # fold plan+tasks lifecycle entries (substep="fast-path")

docs/template-profiles.md                    # document the classify step + fast-path branch
CHANGELOG.md / README.md                     # VS Code-side: new setting + behavior
```

**Structure Decision**: Single repository, two independently-versioned extensions. The **config knob** (VS Code setting + `companion.yml` mirror + resolution) lands in the VS Code extension (`src/`, `package.json`); the **classify + fast-path branch + lifecycle fold** lands in the spec-kit extension (turbo command body + `write-context.py`). The command body reads the resolved flag and threshold from `.specify/companion.yml` (the extension mirrors the resolved editor/project value there, the same pattern `templateProfile` already uses), so the AI prompt never reads VS Code settings directly. Because the change spans both extensions, it carries **two** changelog/version updates (root `package.json` + `speckit-extension/extension.yml`).

## Complexity Tracking

> No constitution violations — table intentionally empty.
