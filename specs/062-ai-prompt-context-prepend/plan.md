# Plan: AI Prompt Context Prepend

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Introduce a single `promptBuilder(command, step, specDir)` helper in `src/ai-providers/promptBuilder.ts` that wraps a raw AI command with a marker-delimited, canonical-substep-aware preamble and route every `executeInTerminal` caller in `specCommands.ts` through it. Gate the wrapper with a new `speckit.aiContextInstructions` VS Code setting (default `true`) so advanced users can opt out, and keep the preamble body identical across providers by building the text once from `CANONICAL_SUBSTEPS` in `src/core/types/specContext.ts`.

## Technical Context

**Stack**: TypeScript 5.3+ (ES2022 strict), VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5, Jest (ts-jest).
**Key Dependencies**: Reuses `CANONICAL_SUBSTEPS` from `src/core/types/specContext.ts`; reads config via `vscode.workspace.getConfiguration('speckit')`.
**Constraints**: Preamble must be < ~1,500 chars / ~300 tokens; no per-provider forking; must not leak absolute path prefixes outside the workspace.

## Files

### Create

- `src/ai-providers/promptBuilder.ts` — pure helper: `buildPrompt({ command, step, specDir })` returns preamble + command, or raw command if opt-out.
- `src/ai-providers/__tests__/promptBuilder.test.ts` — golden-string tests per step + opt-out + unknown-step fallback.

### Modify

- `src/features/specs/specCommands.ts` — route every `executeInTerminal(prompt)` call for SpecKit steps through `buildPrompt`.
- `package.json` — add `speckit.aiContextInstructions` boolean config (default `true`) under `contributes.configuration`.
- `README.md` — document the new setting alongside other configuration options.
- `CLAUDE.md` — brief note in Active Technologies / Recent Changes (auto-generated section).

## Testing Strategy

- **Unit**: `promptBuilder.test.ts` — golden strings for `specify`, `plan`, `tasks`, `implement`; opt-out returns raw command byte-identical to input; unknown step returns raw command.
- **Integration**: Existing `specCommands.test.ts` — assert dispatched prompt contains the marker comment when default config applies.
- **Edge cases**: Empty `specDir`, unknown step name, config explicitly set to `false`.

## Risks

- Token cost: +200–300 tokens per dispatch — accept per spec; revisit after launch if budget complaints surface.
- AI non-compliance: Best-effort; spec 061 remains the hard guarantee for step-boundary writes.
- Path leakage: Only workspace-relative `specDir` is embedded; unit test asserts no absolute path substrings.
