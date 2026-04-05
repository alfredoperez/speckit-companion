# Implementation Plan: Update Architecture & Documentation

**Branch**: `045-update-docs` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/045-update-docs/spec.md`

## Summary

Update all documentation files (`docs/architecture.md`, `docs/how-it-works.md`, `CLAUDE.md`) to accurately reflect the current codebase structure. The primary issues are phantom directories/components that no longer exist, missing feature modules (spec-viewer, spec-editor, workflows), missing AI providers (Codex, Qwen), and incorrect tree view counts (docs say 7, reality is 3).

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
**Storage**: File-based (workspace `.claude/`, `specs/`, `.specify/` directories)
**Testing**: Jest with ts-jest, BDD style
**Target Platform**: VS Code ^1.84.0
**Project Type**: VS Code Extension (single project)
**Performance Goals**: N/A (documentation-only changes)
**Constraints**: N/A (documentation-only changes)
**Scale/Scope**: 3 documentation files to update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility & Configuration | PASS | Docs will reflect all 5 providers and configuration surface |
| II. Spec-Driven Workflow | PASS | No workflow changes, docs-only |
| III. Visual & Interactive | PASS | No UI changes |
| IV. Modular Architecture | PASS | Docs will accurately describe the modular webview structure |

No violations. All changes are documentation corrections to match existing architecture.

## Project Structure

### Documentation (this feature)

```text
specs/045-update-docs/
├── plan.md              # This file
├── research.md          # Phase 0 output - discrepancy analysis
├── data-model.md        # Phase 1 output - entity mapping
├── quickstart.md        # Phase 1 output - implementation guide
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
docs/
├── architecture.md      # Major rewrite - phantom dirs, missing components
├── how-it-works.md      # Major rewrite - providers, views, structure
└── viewer-states.md     # No changes needed (already accurate)

CLAUDE.md                # Minor update if needed (already mostly accurate)
```

**Structure Decision**: No source code changes. All modifications target existing documentation files. CLAUDE.md project structure section is already accurate from recent updates.

## Discrepancy Analysis

### docs/architecture.md — Critical Issues

| Issue | Current (Wrong) | Actual |
|-------|-----------------|--------|
| Top-level dirs | `commands/`, `constants/`, `services/`, `shared/`, `watchers/`, `providers/` | `core/`, `features/`, `ai-providers/`, `speckit/` |
| Features listed | Only `permission/` | 10 modules: agents, permission, settings, skills, spec-editor, spec-viewer, specs, steering, workflow-editor, workflows |
| Key components | References `agentsExplorerProvider.ts`, `hooksExplorerProvider.ts`, `mcpExplorerProvider.ts` | These files don't exist; actual providers: SpecExplorerProvider, SteeringExplorerProvider, OverviewProvider |
| Webview structure | Only `workflow.ts` and basic render | Full structure with spec-viewer/, spec-editor/, markdown/, render/, ui/ |
| CSS structure | Only `workflow.css`, `spec-markdown.css` | Also includes spec-viewer/ partials dir, spec-editor.css, spec-viewer.css |

### docs/how-it-works.md — Critical Issues

| Issue | Current (Wrong) | Actual |
|-------|-----------------|--------|
| AI providers | 3 (Claude, Gemini, Copilot) | 5 (+ Codex, Qwen) |
| Provider files | Missing codexCliProvider.ts, qwenCliProvider.ts | Both exist in src/ai-providers/ |
| Tree views | 7 views (explorer, steering, agents, skills, mcp, hooks, settings) | 3 views (explorer, steering, settings) |
| Mermaid diagram | Shows "Specs \| Steering \| MCP \| Agents \| Skills \| Hooks" | Should show "Specs \| Steering \| Settings" |
| Feature modules | Lists `hooks/`, `mcp/` as feature dirs | These don't exist; missing spec-editor/, spec-viewer/, workflows/ |
| Provider table | 7 providers listed with phantom views | 3 providers with accurate view IDs |
| Capabilities matrix | Only 3 providers, missing Codex/Qwen | Need all 5 providers |
| Activation flow | "Register TreeDataProviders 7 views" | Should be 3 views |
| Project structure | Missing spec-viewer/, spec-editor/, workflows/ | These are major feature modules |
| Config keys | Missing speckit.specDirectories, speckit.customWorkflows, speckit.defaultWorkflow, speckit.customCommands, speckit.qwenPath | All exist in package.json |

### CLAUDE.md — Status

Already accurate. The project structure section correctly shows `core/`, `features/`, `ai-providers/`, `speckit/`, and the webview structure with spec-viewer, spec-editor, markdown, render, ui. No changes needed.

## Complexity Tracking

No constitution violations to justify. This is a documentation-only feature with no architectural complexity.
