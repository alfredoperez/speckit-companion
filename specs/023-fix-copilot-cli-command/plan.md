# Plan: Fix Copilot CLI Command Invocation

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

Replace all `ghcs` references with `gh copilot` as the default Copilot CLI command. The `ghcs` alias is a shell *suggestion* tool, not a coding assistant — `gh copilot` is the correct entry point. The command construction pattern changes from `ghcs "prompt"` to `gh copilot "$(cat file)"`. The `isInstalled()` check flips priority to try `gh copilot` first. The configurable `copilotPath` setting is updated but still respected for custom overrides.

## Files

### Modify

| File | Change |
|------|--------|
| `src/ai-providers/copilotCliProvider.ts` | Change default from `ghcs` to `gh copilot` in `getCliPath()`, flip `isInstalled()` to check `gh copilot` first (fallback to `ghcs`), update error message text, update JSDoc comments |
| `package.json` | Change `speckit.copilotPath` default from `"ghcs"` to `"gh copilot"`, update description |

## Risks

- **Users with `ghcs` alias configured**: Mitigated by R004 — custom `copilotPath` values are preserved; only the default changes.
