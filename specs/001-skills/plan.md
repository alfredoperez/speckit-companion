# Implementation Plan: Claude Code Skills Explorer

**Branch**: `001-skills` | **Date**: 2025-12-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-skills/spec.md`

## Summary

Add a new Skills section to the SpecKit Companion sidebar that displays Claude Code Skills grouped by type (Plugin, User, Project). Skills are detected from `~/.claude/skills/` (user), `.claude/skills/` (project), and installed plugins. The feature is only visible when Claude Code is selected as the AI provider, following the existing pattern established by the Agents tree view.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), js-yaml ^4.1.0
**Storage**: File system (skills stored as SKILL.md files with YAML frontmatter)
**Testing**: Jest 29.x with ts-jest (manual testing via Extension Development Host F5)
**Target Platform**: VS Code ^1.84.0 (Windows, macOS, Linux)
**Project Type**: Single project (VS Code Extension)
**Performance Goals**: Skills list should load within 1 second, visual feedback < 1s per Constitution III
**Constraints**: Workspace-scoped file operations per Constitution V, provider-agnostic architecture per Constitution II
**Scale/Scope**: Typically < 50 skills across all sources (user, project, plugins)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code Quality First | TypeScript strict mode enabled in tsconfig.json, no `any` types (use proper interfaces like `SkillInfo`), ESLint compliance | PASS |
| II. Provider-Agnostic | Skills view only shown when Claude Code selected (via `when` clause), uses `getConfiguredProviderType()` pattern from agents | PASS |
| III. TreeView-First UX | Tree view as primary UI, click to open SKILL.md, hover for tooltip, refresh action in view title | PASS |
| IV. SpecKit Protocol | Feature in `specs/001-skills/` with spec.md, plan.md, etc. Manager pattern in `src/features/skills/` | PASS |
| V. Defensive File Ops | Read-only operations (scanning directories, parsing YAML), no file writes needed | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/001-skills/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (N/A - no API)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── skills/                          # NEW: Skills feature module
│       ├── index.ts                     # Re-exports for clean imports
│       ├── skillManager.ts              # Business logic for skill detection/parsing
│       └── skillsExplorerProvider.ts    # TreeDataProvider for Skills view
├── ai-providers/
│   └── aiProvider.ts                    # Add skillsDir to ProviderPaths (Claude only)
├── core/
│   ├── constants.ts                     # Add Views.skills constant
│   └── fileWatchers.ts                  # Add skills file watcher setup
├── extension.ts                         # Register Skills view and commands
└── package.json                         # Add skills view, commands, menus
```

**Structure Decision**: VS Code Extension single-project structure. New feature follows existing Manager + Provider pattern (like `features/agents/`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all Constitution principles are satisfied.

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design artifacts completed.*

| Principle | Verification | Status |
|-----------|--------------|--------|
| I. Code Quality First | `SkillInfo` interface defined with proper types; `SkillItem` class with typed properties; no `any` usage in data model | PASS |
| II. Provider-Agnostic | View uses `when: "config.speckit.aiProvider == 'claude'"` clause; `skillsDir` added only for Claude in ProviderPaths | PASS |
| III. TreeView-First UX | TreeDataProvider pattern; click opens SKILL.md; tooltip shows description; refresh in view/title menu | PASS |
| IV. SpecKit Protocol | `skillManager.ts` follows Manager pattern; `skillsExplorerProvider.ts` follows Provider pattern | PASS |
| V. Defensive File Ops | All operations are read-only (fs.readDirectory, fs.readFile); handles missing directories gracefully | PASS |

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/001-skills/research.md` | Complete |
| Data Model | `specs/001-skills/data-model.md` | Complete |
| Quickstart | `specs/001-skills/quickstart.md` | Complete |
| Contracts | N/A (no external API) | N/A |

## Next Steps

Run `/speckit.tasks` to generate `tasks.md` with implementation tasks.
