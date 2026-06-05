# Implementation Plan: Fix Upgrade Agent & Stale Setting Docs

**Branch**: `122-fix-upgrade-ai-agent` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/122-fix-upgrade-ai-agent/spec.md`

## Summary

Two value-correctness defects from issue #190. (1) The "Upgrade Project" action hardcodes `specify init --here --force --ai claude-code`; `claude-code` is not a valid spec-kit agent (the CLI errors `Unknown agent 'claude-code'`), and it ignores the user's configured provider. (2) The docs and one code constant still reference a removed `speckit.workflowEditor.enabled` setting.

Technical approach: introduce one pure resolver, `resolveSpecKitAgent(provider, host)`, mapping the `speckit.aiProvider` value (and, for `ide-chat`, the detected host) to a valid CLI agent identifier, with `claude` as the unrecognized-provider fallback. Route both upgrade dispatch sites (`upgradeProject`, `upgradeAll`) through an impure wrapper `getConfiguredSpecKitAgent()` so neither can reintroduce a hardcoded value. Separately, delete the phantom setting from `docs/how-it-works.md` (two spots) and the unused `ConfigKeys.workflowEditorEnabled` constant.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); spec-kit CLI (`specify`) invoked via terminal
**Storage**: N/A — stateless, no persisted data
**Testing**: Jest + ts-jest (`tsconfig.test.json`); VS Code mocked via `tests/__mocks__/vscode.ts`
**Target Platform**: VS Code 1.84+ (and forks: Cursor, Windsurf, Antigravity)
**Project Type**: Single project (VS Code extension)
**Performance Goals**: N/A (synchronous string resolution at command-dispatch time)
**Constraints**: Extension must only ever emit a spec-kit `--ai` value from the CLI's accepted set; resolver must be total (never throws, never emits an invalid identifier)
**Scale/Scope**: 8 providers + 5 host buckets; 2 upgrade dispatch sites; 3 stale-setting references

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| I. Extensibility & Configuration | **Pass** — fix removes a hardcode and derives behavior from the `speckit.aiProvider` setting; new mapping is a single, extensible table. |
| II. Spec-Driven Workflow | **Pass** — no change to the Specify→Plan→Tasks→Implement pipeline or spec lifecycle. |
| III. Visual & Interactive | **Pass** — no UI surface change; corrects what an existing command dispatches. |
| IV. Modular Architecture | **Pass** — resolver lives in a small focused module with a pure core and a thin impure wrapper; host detection consolidated to one source. |

No violations. Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/122-fix-upgrade-ai-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── agent-resolution.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── speckit/
│   ├── detector.ts            # upgradeProject() + upgradeAll() — route through resolver
│   ├── specKitAgent.ts        # NEW: resolveSpecKitAgent() + getConfiguredSpecKitAgent()
│   ├── specKitAgent.test.ts   # NEW: pure-resolution BDD tests
│   └── detector.test.ts       # EXTEND: dispatched --ai value, no claude-code
├── ai-providers/
│   └── ideChatProvider.ts     # extract detectHostIde() to standalone export; method delegates
└── core/
    └── constants.ts           # remove ConfigKeys.workflowEditorEnabled

docs/
└── how-it-works.md            # remove both speckit.workflowEditor.enabled references
```

**Structure Decision**: Single-project VS Code extension. The new resolver is added under `src/speckit/` alongside the only consumer (`detector.ts`). Host detection (`detectHostIde`) is extracted from `IdeChatProvider` into a standalone exported function in `ideChatProvider.ts` so the resolver and the existing IDE-Chat dispatch share one detector — preventing the kind of duplicated logic that produced the original bug.

## Phase 0: Outline & Research

Complete — see [research.md](./research.md). Resolved: the CLI's authoritative agent list (`claude-code` absent, `claude` correct, Copilot the non-interactive default), the full provider→agent and host→agent tables, the two dispatch sites, and the three stale-setting references (the `ConfigKeys.workflowEditorEnabled` constant has zero other usages, so removal is inert).

## Phase 1: Design & Contracts

Complete. Artifacts:

- [data-model.md](./data-model.md) — provider / host / agent value sets, mapping rules, the removed setting.
- [contracts/agent-resolution.md](./contracts/agent-resolution.md) — `resolveSpecKitAgent` and `getConfiguredSpecKitAgent` contracts plus the BDD test contract.
- [quickstart.md](./quickstart.md) — automated + manual verification covering every SC.

Agent context: the `CLAUDE.md` SPECKIT marker block will be updated to point at this plan.

### Implementation notes for /speckit.tasks

- **Resolver module** (`src/speckit/specKitAgent.ts`): export `PROVIDER_TO_AGENT` map keyed by `AIProviders` values, `resolveSpecKitAgent(provider, host)` (pure, total, `claude` default), and `getConfiguredSpecKitAgent()` (reads `speckit.aiProvider`, detects host, calls the pure fn). Reuse `AIProviders` from `core/constants.ts`.
- **Host detection**: extract the body of `IdeChatProvider.detectHostIde()` into an exported standalone `detectHostIde(): HostIde`; have the instance method delegate. Behavior unchanged for existing IDE-Chat callers.
- **Dispatch sites**: in `detector.ts`, replace both `--ai claude-code` literals with `--ai ${getConfiguredSpecKitAgent()}` in `upgradeProject()` and `upgradeAll()`.
- **Docs**: in `docs/how-it-works.md`, drop the `speckit.workflowEditor.enabled // boolean` line from the Configuration Keys block, and remove (or repoint) the "Workflow editor not showing" troubleshooting item — the editor is no longer gated by a user setting, so the entry has no replacement toggle.
- **Constant**: delete `workflowEditorEnabled` from `ConfigKeys` in `core/constants.ts` (no other references).
- **README map**: this is a bug fix changing documented behavior; the only user-facing doc affected is `docs/how-it-works.md` (a phantom config key). No README provider-matrix or settings change is needed — no provider added, no live setting removed from the README's Configuration section. Confirm during tasks that README has no `workflowEditor.enabled` reference (grep already shows none).

## Complexity Tracking

No constitution violations — not applicable.

---

## Plan Summary

**The problem.** Two places where the extension states a value the rest of the system rejects. The "Upgrade Project" button always runs `specify init … --ai claude-code` — but `claude-code` isn't a real spec-kit agent, so the CLI errors out for everyone, and it ignores whichever AI provider the user actually picked. Separately, the docs still tell people to check a `speckit.workflowEditor.enabled` setting that was deleted long ago, sending them hunting for a toggle that no longer exists.

**The fix.** Add one small function that turns the user's configured provider into a valid spec-kit agent name (Claude→`claude`, Codex→`codex`, Gemini→`gemini`, and so on; for "IDE Chat" it picks based on the host editor — VS Code→`copilot`, Cursor→`cursor-agent`, Windsurf→`windsurf`, Antigravity→`agy`). Anything unrecognized safely falls back to `claude`. Both upgrade buttons call this one function, so neither can ever send `claude-code` again. Then delete the dead `workflowEditor.enabled` setting from the docs and the one leftover code constant so the configuration reference matches reality.

**Outcome.** Every supported provider can upgrade without an "Unknown agent" error, the upgrade scaffolds for the assistant the user chose, and the docs no longer point at a setting that isn't there.
