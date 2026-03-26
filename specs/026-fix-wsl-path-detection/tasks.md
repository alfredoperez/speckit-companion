# Tasks: Fix WSL Path Detection on Native Windows

## Phase 1 — Core

- [x] **T001** · Create shared `convertPathIfWSL` utility
  - **Do**: Create `src/core/utils/pathUtils.ts` with a `convertPathIfWSL(filePath: string): string` function that checks both `process.platform === 'win32'` and `process.env.WSL_DISTRO_NAME` before converting
  - **Verify**: `npm run compile` succeeds

- [x] **T002** · Replace private methods in all 3 providers
  - **Do**: In `claudeCodeProvider.ts`, `codexCliProvider.ts`, and `qwenCliProvider.ts`, remove the private `convertPathIfWSL` method and import from `pathUtils`
  - **Verify**: `npm run compile` succeeds; `grep -r "private convertPathIfWSL" src/` returns no results

- [x] **T003** · Add unit tests
  - **Do**: Create `tests/core/utils/pathUtils.test.ts` covering: WSL env (converts), native Windows (no convert), non-Windows (no convert)
  - **Verify**: `npm test` passes
