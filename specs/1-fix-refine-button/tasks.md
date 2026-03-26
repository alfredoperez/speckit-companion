# Tasks: Fix Refine Button Not Launching Terminal

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Fix handleSubmitRefinements to use executeInTerminal — `src/features/spec-viewer/messageHandlers.ts`
  - **Do**: In `handleSubmitRefinements`, replace `vscode.commands.executeCommand(command, specDirectory, context)` with a call that builds a prompt string (`/${step.command} ${targetPath}`) with the refinement context appended, then calls `getAIProvider().executeInTerminal(prompt, label)` — same pattern as `executeStepInTerminal`
  - **Verify**: Compile passes (`npm run compile`), clicking "Refine" button in spec-viewer opens an AI terminal with the refinement context

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001 | [x] |
