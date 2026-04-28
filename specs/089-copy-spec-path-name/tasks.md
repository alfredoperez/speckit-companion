# Tasks: Copy Spec Path / Name

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-27

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Register `speckit.specs.copyPath` and `speckit.specs.copyName` handlers — `src/features/specs/specCommands.ts` | R002, R003, R004, NFR001, NFR002
  - **Do**: Inside `registerSpecKitCommands`, add two `vscode.commands.registerCommand` blocks immediately after the existing `speckit.specs.reveal` handler (~line 233). Each handler resolves the slug via `const slug = (item.specPath?.replace(/^specs\//, '')) ?? item.label;` and the relative path via `const relativePath = item.specPath || \`specs/${item.label}\`;`. The path handler calls `vscode.env.clipboard.writeText(relativePath)` then `NotificationUtils.showAutoDismissNotification(\`Copied "${relativePath}"\`)`. The name handler calls `vscode.env.clipboard.writeText(slug)` then `NotificationUtils.showAutoDismissNotification(\`Copied "${slug}"\`)`. Bail early if `item` is undefined.
  - **Verify**: `npm run compile` passes with no TS errors.
  - **Leverage**: `src/features/specs/specCommands.ts:193-233` (`speckit.specs.reveal` / `speckit.specs.revealInExplorer`) — same item-shape, same fallback pattern, same notification helper at line 184.

- [x] **T002** Declare commands and wire context-menu entries — `package.json` | R001, R005, R006, R007
  - **Do**:
    1. In `contributes.commands` (around line 117), add two entries: `{ "command": "speckit.specs.copyPath", "title": "Copy Path", "category": "SpecKit" }` and `{ "command": "speckit.specs.copyName", "title": "Copy Name", "category": "SpecKit" }`.
    2. In `contributes.menus["view/item/context"]` (around line 494), append two new entries with `"when": "view == speckit.views.explorer && viewItem =~ /^spec-(active|tasks-done|completed|archived)$/"` and `"group": "9_clipboard@1"` / `"9_clipboard@2"`.
    3. In `contributes.menus["commandPalette"]` (around line 571), add two entries with `"when": "false"` so they don't surface there.
  - **Verify**: `npm run compile` passes; manually inspect `package.json` JSON validity.
  - **Leverage**: existing `speckit.delete` and `speckit.specs.revealInExplorer` declarations in `package.json:494-553` for menu shape; `speckit.openSpecSource` at line 629 for the `when: false` palette pattern.

- [x] **T003** [P] *(depends on T001)* Add Jest tests for both handlers — `src/features/specs/specCommands.test.ts` | R002, R003, R004, NFR001
  - **Do**: Add two new `describe` blocks (`'speckit.specs.copyPath command handler'` and `'speckit.specs.copyName command handler'`) modeled on the existing `'speckit.specs.revealInExplorer command handler'` block (~line 445). For each handler, cover (a) item with `specPath = 'specs/089-copy-spec-path-name'` → asserts `vscode.env.clipboard.writeText` called with `'specs/089-copy-spec-path-name'` (path) or `'089-copy-spec-path-name'` (name), (b) fallback when only `label` is set, and (c) notification is shown via `NotificationUtils.showAutoDismissNotification`. If `tests/__mocks__/vscode.ts` lacks `env.clipboard.writeText`, add a `jest.fn()` for it.
  - **Verify**: `npm test -- --testPathPattern=specCommands` passes including the new cases.
  - **Leverage**: `src/features/specs/specCommands.test.ts:445-520` (revealInExplorer test block).

- [x] **T004** [P] *(depends on T001, T002)* Document new actions in sidebar reference — `docs/sidebar.md` | R001
  - **Do**: Add **Copy Path** and **Copy Name** rows to the right-click menu reference table for spec items. Note they appear in a `9_clipboard` group below the modification and reveal entries.
  - **Verify**: `docs/sidebar.md` renders cleanly (no broken table rows); links open.

- [x] **T005** [P] *(depends on T001, T002)* Update README sidebar summary — `README.md` | R001
  - **Do**: Extend the "Sidebar at a Glance" section to mention the two new context-menu entries (Copy Path / Copy Name) on spec items, in one or two lines that link out to `docs/sidebar.md` for the full table.
  - **Verify**: README renders cleanly; the per-release checklist note about "New sidebar action / right-click menu item" is satisfied.
