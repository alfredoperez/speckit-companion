# Plan: Fix Refine Button Not Launching Terminal

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

Replace `vscode.commands.executeCommand()` in `handleSubmitRefinements` with `getAIProvider().executeInTerminal()`, matching the pattern used by `executeStepInTerminal`. The refinement context string will be appended to the slash command prompt so the AI CLI receives it.

## Files

### Modify

| File | Change |
|------|--------|
| `src/features/spec-viewer/messageHandlers.ts` | In `handleSubmitRefinements`: use `executeStepInTerminal`-style call with `getAIProvider().executeInTerminal()` instead of `vscode.commands.executeCommand()`, appending refinement context to the prompt |
