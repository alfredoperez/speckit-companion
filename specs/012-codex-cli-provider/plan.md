# Implementation Plan: Codex CLI Provider

**Branch**: `012-codex-cli-provider` | **Date**: 2026-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-codex-cli-provider/spec.md`

## Summary

Add OpenAI Codex CLI as a new AI provider option in SpecKit Companion, implementing the `IAIProvider` interface to enable prompt execution, slash commands, and provider-specific file management. The implementation follows the existing provider pattern used by Claude Code, Gemini CLI, and Copilot CLI providers.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: File-based in `.codex/` directory structure
**Testing**: Manual testing via VS Code Extension Development Host (F5)
**Target Platform**: VS Code Extension (macOS, Linux; Windows/WSL experimental)
**Project Type**: VS Code Extension (single project)
**Performance Goals**: Terminal command execution within 800ms delay
**Constraints**: Must integrate with existing provider factory pattern
**Scale/Scope**: Single new provider implementation (~250 lines of code)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Extensibility and Configuration | ✅ PASS | Adds new provider via existing factory pattern; provider-specific logic in dedicated class; follows IAIProvider interface |
| II. Spec-Driven Workflow | ✅ PASS | Enables Spec→Plan→Tasks workflow through Codex CLI; all existing SpecKit commands work with new provider |
| III. Visual and Interactive | ✅ PASS | Integrates with existing VS Code UI (provider selection QuickPick, terminal views, tree views for agents/steering) |
| IV. Modular Architecture | ✅ PASS | Single provider file following established pattern; no webview complexity; provider-specific paths in central config |

**Gate Result**: ✅ PASS - No violations. Implementation follows established patterns.

## Project Structure

### Documentation (this feature)

```text
specs/012-codex-cli-provider/
├── plan.md              # This file
├── research.md          # Phase 0: Codex CLI research
├── data-model.md        # Phase 1: Provider paths and types
├── quickstart.md        # Phase 1: Integration steps
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── ai-providers/
│   ├── aiProvider.ts           # [MODIFY] Add 'codex' to AIProviderType, add PROVIDER_PATHS entry
│   ├── aiProviderFactory.ts    # [MODIFY] Add case for 'codex' provider instantiation
│   ├── codexCliProvider.ts     # [NEW] Codex CLI provider implementation
│   └── index.ts                # [MODIFY] Export new provider
└── extension.ts                # No changes needed (uses factory pattern)

package.json                    # [MODIFY] Add 'codex' to aiProvider enum
```

**Structure Decision**: Follows existing VS Code extension structure. Single new provider file added to `src/ai-providers/` directory, with minimal modifications to existing files for registration.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations - all constitution principles satisfied.*

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Design Verification |
|-----------|--------|---------------------|
| I. Extensibility and Configuration | ✅ PASS | `CodexCliProvider` class follows `IAIProvider` interface; paths configurable via `PROVIDER_PATHS`; provider-specific logic isolated |
| II. Spec-Driven Workflow | ✅ PASS | All SpecKit commands (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`) work via `executeSlashCommand()` |
| III. Visual and Interactive | ✅ PASS | Terminal execution in ViewColumn.Two; steering/skills visible in tree views; QuickPick for selection |
| IV. Modular Architecture | ✅ PASS | Single 250-line provider file; no need for submodules at this complexity level |

**Post-Design Gate Result**: ✅ PASS - Design adheres to all constitution principles.

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | [research.md](./research.md) | Codex CLI command structure, flags, configuration |
| Data Model | [data-model.md](./data-model.md) | Type definitions, paths configuration, class structure |
| Quickstart | [quickstart.md](./quickstart.md) | Step-by-step implementation guide |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list from this plan.
