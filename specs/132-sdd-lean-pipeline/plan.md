# Implementation Plan: Pipeline + the sdd-lean Preset

**Branch**: `132-sdd-lean-pipeline` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/132-sdd-lean-pipeline/spec.md`

## Summary

Bring the SDD-lean document shape (no user-story section, lean plan, files/dependencies task axis) into spec-kit using its **native preset subsystem** — not a custom mechanism. The `sdd-lean` preset ships as a bundle of command overrides that `replaces:` the core `speckit.specify`/`plan`/`tasks`/`implement` commands, so once it is installed the stock commands emit the SDD-lean shape. Four `/speckit.companion.*` commands (shipped by the existing `companion` extension) provide the explicit opt-in path, sharing the same SDD-lean command body so their output matches the preset path. On/off is exposed through `.specify/sdd.config.yml` (`features.sddLean`) and a `speckit.features.sddLean` VS Code setting, default-on for Companion-managed projects.

This is primarily a **speckit-extension** change (preset + namespaced commands + install scaffolding), with one small **VS Code extension** surface (the setting and the code that maps it onto the preset). The two halves are versioned and released independently per the dual-extension rule.

## Technical Context

**Language/Version**: Markdown command/preset definitions + YAML manifests (`preset.yml`, `.specify/sdd.config.yml`); TypeScript 5.3+ (ES2022, strict) for the VS Code-side setting and toggle code; Python 3 (stdlib) only if a helper script proves necessary (none currently planned).
**Primary Dependencies**: spec-kit `specify` CLI GitHub-source build — `preset` subsystem (`add`/`enable`/`disable`/`set-priority`/`resolve`/`list`) and `extension` subsystem; the shipped `lean` preset as prior art; VS Code Extension API for `contributes.configuration`.
**Storage**: File-based. Source: `speckit-extension/presets/sdd-lean/`, `speckit-extension/commands/speckit.companion.*.md`, `speckit-extension/extension.yml`. Install targets: `.specify/presets/sdd-lean/`, agent command dirs (`.claude/commands/`, `.opencode/`, etc.), `.specify/sdd.config.yml`.
**Testing**: Mirror spec-kit's `tests/test_presets.py` style for `preset.yml` validity/resolution; Jest (existing `tests/` harness, `tsconfig.test.json`) for the VS Code setting + toggle logic; manual end-to-end via `specify preset add --dev` + a real `/speckit.specify` run.
**Target Platform**: Developer workstation (macOS/Linux/Windows) with the GitHub-source spec-kit CLI and the SpecKit Companion VS Code extension.
**Project Type**: Dual — spec-kit extension (markdown/YAML, separately versioned) + VS Code extension (TypeScript). The bulk lives under `speckit-extension/`.
**Performance Goals**: N/A (install-time + authoring-time feature; no runtime hot path).
**Constraints**: Extension isolation (the `.vsix` must not depend on `.specify/**`); preset resolution precedence must be deterministic (priority numbers, lower = higher precedence); the `disable` vs `remove` asymmetry for registered command overrides must be handled (see Research R2).
**Scale/Scope**: 1 preset, 4 preset command overrides, 4 namespaced extension commands, 1 project config file, 1 VS Code setting, install-scaffolding wiring.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. The feature is delivered as a spec-kit preset (the sanctioned extension point) and is overridable through a VS Code setting and a project config file; default behavior is opt-out, not forced. No core rewrite.
- **II. Spec-Driven Workflow** — PASS. The non-negotiable Specify → Plan → Tasks → Implement pipeline is preserved unchanged; the preset reshapes the *content* each step emits (drops user stories, switches the task axis) while keeping the sequential-phase, one-markdown-artifact-per-step model. This is exactly the "custom workflows MAY redefine commands and output files" allowance.
- **III. Visual and Interactive** — PASS (N/A). No viewer/webview change; the GUI keeps consuming the same `.spec-context.json`.
- **IV. Modular Architecture** — PASS. Preset, namespaced commands, config, and the VS Code setting are separable units; no monolith introduced.

**Result**: No violations. Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/132-sdd-lean-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output — resolves the preset-mechanism unknowns
├── data-model.md        # Phase 1 — preset.yml schema, command body, config + setting shapes
├── quickstart.md        # Phase 1 — install + verify the SDD-lean shape
├── contracts/           # Phase 1 — preset manifest, command, config, and CLI contracts
│   ├── preset-manifest.md
│   ├── namespaced-commands.md
│   ├── config-and-setting.md
│   └── cli-selection.md
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

```text
speckit-extension/                       # spec-kit extension (separately versioned)
├── extension.yml                        # ADD 4 provides.commands (speckit.companion.specify/plan/tasks/implement)
├── commands/
│   ├── speckit.companion.specify.md     # NEW — namespaced opt-in (SDD-lean shape)
│   ├── speckit.companion.plan.md        # NEW
│   ├── speckit.companion.tasks.md       # NEW
│   └── speckit.companion.implement.md   # NEW
├── presets/
│   └── sdd-lean/                        # NEW preset bundle
│       ├── preset.yml                   # provides command overrides (replaces core specify/plan/tasks/implement)
│       ├── commands/
│       │   ├── speckit.specify.md       # SDD-lean shape — no user stories
│       │   ├── speckit.plan.md          # lean plan
│       │   ├── speckit.tasks.md         # files/dependencies task axis
│       │   └── speckit.implement.md
│       └── README.md
├── README.md  CHANGELOG.md              # speckit-extension docs (NOT the root ones)
└── docs/install.md                      # ADD: install + default-select sdd-lean

package.json                             # ADD contributes.configuration "speckit.features.sddLean" (VS Code ext)
src/features/settings/                   # read the setting; map true/false → preset enable/remove
.specify/sdd.config.yml                  # default features.sddLean: true (written by install scaffolding)
```

**Structure Decision**: Dual-extension. The preset and the four namespaced commands are spec-kit extension assets under `speckit-extension/` — they get their own README/CHANGELOG and `extension.yml` version bump, released via `/publish-speckit-ext` (`speckit-ext-v*` tag), never the root README/CHANGELOG/`package.json`. The only VS Code-extension change is the `speckit.features.sddLean` setting in the root `package.json` plus the small amount of `src/` code that translates that setting into a `specify preset` action. The shared SDD-lean command body is authored once and reused by both the preset overrides and the namespaced commands (the "thin wrapper" decision).

## Complexity Tracking

> No constitution violations — table intentionally omitted.
