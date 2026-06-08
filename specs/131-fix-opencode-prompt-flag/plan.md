# Implementation Plan: Fix Wrong CLI Prompt Flag for OpenCode

**Branch**: `131-fix-opencode-prompt-flag` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/131-fix-opencode-prompt-flag/spec.md`

## Summary

When the configured AI provider is OpenCode, the extension dispatches `opencode -p "$(cat <tempfile>)"`. OpenCode does **not** treat `-p` as a prompt flag — in its CLI, `-p` is the short form of `--password` (basic-auth for attaching to a remote server). With no positional message, OpenCode prints its usage/help screen, so every prompt-dispatching SpecKit action is a no-op for OpenCode users.

The correct non-interactive invocation is OpenCode's `run` subcommand, which takes the message as a **positional** argument: `opencode run "<message>"` ([OpenCode CLI docs](https://opencode.ai/docs/cli/)). The extension already centralizes per-provider prompt-flag selection in `CliTerminalProvider.cliPromptFlag()` (default `'-p '`). The fix is a single-provider override: `OpenCodeProvider.cliPromptFlag()` returns `'run '`, producing `opencode run "$(cat <tempfile>)"`. The existing temp-file delivery, shell-substitution, and cleanup machinery are reused unchanged, so large/special-character prompts continue to pass intact, and no other provider's command string changes.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); no new dependencies
**Storage**: N/A — no persisted state; prompt continues to be delivered via an ephemeral temp file
**Testing**: Jest + ts-jest, `tests/__mocks__/vscode.ts` mock (existing harness)
**Target Platform**: VS Code extension, cross-platform shells (bash / PowerShell / cmd.exe)
**Project Type**: single (VS Code extension)
**Performance Goals**: N/A — dispatch is a one-shot terminal command
**Constraints**: Other CLI providers' dispatched command strings MUST remain byte-for-byte unchanged (FR-003 / SC-002)
**Scale/Scope**: One provider class touched; ~1 line of behavior change plus a regression test

No NEEDS CLARIFICATION remain. The sole open question — the correct OpenCode invocation — is resolved in [research.md](./research.md): the documented `run` subcommand with a positional message.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Extensibility and Configuration | **PASS** — fix uses the existing `cliPromptFlag()` per-provider override hook; provider-specific logic stays isolated in `OpenCodeProvider`. No new config surface. |
| II. Spec-Driven Workflow | **PASS** — no pipeline, lifecycle, or status change. |
| III. Visual and Interactive | **PASS (N/A)** — backend dispatch correction; no UI change, no UI regression. |
| IV. Modular Architecture | **PASS** — change lives in the existing modular `ai-providers/` structure; no new files beyond a test. |
| AI Provider Integration | **PASS** — corrects one `AIProvider` implementation via the shared override seam rather than duplicating dispatch logic. |

**Result**: No violations. Complexity Tracking below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/131-fix-opencode-prompt-flag/
├── plan.md              # This file
├── research.md          # Phase 0 — OpenCode CLI invocation decision
├── data-model.md        # Phase 1 — the AI Provider Dispatch Command entity
├── quickstart.md        # Phase 1 — manual verification steps
├── contracts/
│   └── cli-dispatch.md  # Phase 1 — before/after command + regression matrix
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/ai-providers/
├── openCodeProvider.ts        # CHANGE: override cliPromptFlag() → 'run '; fix doc comment
├── cliTerminalProvider.ts     # CHANGE: doc-comment only — drop OpenCode from the `-p ` default note
├── copilotCliProvider.ts      # UNCHANGED (regression guard: copilot -p)
├── qwenCliProvider.ts         # UNCHANGED (regression guard: qwen --yolo -p)
├── codexCliProvider.ts        # UNCHANGED (own pipe-based dispatch)
└── __tests__/
    └── openCodeDispatch.test.ts   # NEW: asserts OpenCode uses `run`, others unchanged
```

**Structure Decision**: Single-project VS Code extension. The change is confined to the existing `src/ai-providers/` module. The only behavioral edit is `OpenCodeProvider.cliPromptFlag()`; `cliTerminalProvider.ts` gets a comment correction only; a new co-located test under `src/ai-providers/__tests__/` locks in both the fix and the no-regression guarantee.

## Complexity Tracking

> No constitution violations — no entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 — Research

See [research.md](./research.md). Decision: dispatch via the `run` subcommand (`opencode run "<message>"`), the documented non-interactive form where the message is a positional argument. The `-p` flag is OpenCode's `--password`, which is why the current command shows help. Implemented as `cliPromptFlag()` → `'run '` so the existing `<cli> <flags>"$(cat <tmp>)"` assembly yields `opencode run "$(cat <tmp>)"` with zero changes to temp-file delivery.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the single **AI Provider Dispatch Command** entity: its parts (binary, permission flag, prompt flag, substitution) and the OpenCode-specific value of the prompt-flag field.
- [contracts/cli-dispatch.md](./contracts/cli-dispatch.md) — the command-string contract: OpenCode before vs. after across bash/PowerShell/cmd, plus the byte-for-byte regression matrix for Copilot, Qwen, Codex, Claude, Gemini.
- [quickstart.md](./quickstart.md) — manual verification: select OpenCode, dispatch a SpecKit action, confirm OpenCode acts on the prompt instead of printing help.
- Agent context: the plan reference between the `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers in `CLAUDE.md` is updated to point at this plan.

### Post-Design Constitution Re-Check

Re-evaluated after Phase 1: no new components, no new config, no duplicated logic — the design is the minimal use of the existing override seam. **All gates still PASS.**

## Docs Impact

- **README**: no change required. The "Supported AI Providers" matrix already lists OpenCode (binary `opencode`, line ~172) and the bash-only-providers note (line ~581) — both remain correct. The README never documented the `-p` form, so no documented behavior is contradicted by the fix.
- **CLAUDE.md**: SPECKIT plan-reference marker updated to this plan (Phase 1 agent-context step).
