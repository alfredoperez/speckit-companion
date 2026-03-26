# Tasks: Fix Copilot CLI Command Invocation

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Update copilotCliProvider defaults and checks — `src/ai-providers/copilotCliProvider.ts`
  - **Do**: (1) In `isInstalled()`, flip order: try `gh copilot --version` first, fallback to `ghcs --version`. Update comments. (2) In `getCliPath()`, change default from `'ghcs'` to `'gh copilot'`. (3) In `ensureInstalled()`, update error message from `'GitHub Copilot CLI (ghcs) is not installed'` to `'GitHub Copilot CLI is not installed'`. (4) Update class JSDoc from "Supports ghcs" to "Supports gh copilot".
  - **Verify**: `npm run compile` passes with no errors

- [x] **T002** Update package.json config default *(depends on T001)* — `package.json`
  - **Do**: Change `speckit.copilotPath` default from `"ghcs"` to `"gh copilot"` and update description from `"Path to GitHub Copilot CLI executable (ghcs)"` to `"Path to GitHub Copilot CLI executable"`
  - **Verify**: `npm run compile` passes; extension loads without config errors

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T002 | [x] |
