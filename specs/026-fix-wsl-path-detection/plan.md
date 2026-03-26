# Plan: Fix WSL Path Detection on Native Windows

**Spec**: specs/026-fix-wsl-path-detection/spec.md | **Date**: 2026-03-26

## Approach

Add a WSL environment check (`process.env.WSL_DISTRO_NAME`) to the `convertPathIfWSL` guard condition in all three AI providers. Extract the shared function into a utility to eliminate duplication.

## Files to Change

- `src/core/utils/pathUtils.ts` — Create shared `convertPathIfWSL` utility with proper WSL detection
- `src/ai-providers/claudeCodeProvider.ts` — Replace private method with shared utility
- `src/ai-providers/codexCliProvider.ts` — Replace private method with shared utility
- `src/ai-providers/qwenCliProvider.ts` — Replace private method with shared utility

## Phase 1 Tasks

| ID | Do | Verify |
|----|-----|--------|
| T001 | Create `convertPathIfWSL` in `src/core/utils/pathUtils.ts` with `WSL_DISTRO_NAME` check | Unit test: returns original path when env var unset |
| T002 | Replace private `convertPathIfWSL` in all 3 providers with import from `pathUtils` | `npm run compile` succeeds, grep confirms no remaining private copies |
| T003 | Add unit tests for WSL vs native Windows vs non-Windows scenarios | `npm test` passes |
