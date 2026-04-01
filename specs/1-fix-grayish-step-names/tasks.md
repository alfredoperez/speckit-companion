# Tasks: Fix Grayish Step Names

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-31

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Remove resourceUri from spec TreeItems — `src/features/specs/specExplorerProvider.ts` | R001, R002
  - **Do**: Remove `this.resourceUri = ...` assignment; store file URI in command arguments instead
  - **Verify**: Tree items no longer appear dimmed in projects with `.claude/` in `.gitignore`

- [x] **T002** Update command handlers to use new path source — `src/features/specs/specCommands.ts` | R002
  - **Do**: Update any code reading `item.resourceUri` to read from command arguments or the item's stored path
  - **Verify**: Clicking tree items still opens the correct file

---

## Progress

- Phase 1: T001–T002 [x]
