# Tasks: Optional SpecKit Commands

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Define built-in optional-command table + helpers — `src/features/spec-viewer/optionalCommands.ts` | R005, R006
  - **Do**: Create a new module exporting `OPTIONAL_SPECKIT_COMMANDS`, a declarative array of `{ command, label, tab, tooltip }` entries: `{ command: Commands.clarify, label: 'Clarify', tab: CORE_DOCUMENTS.SPEC, tooltip: 'Ask clarifying questions to refine the spec' }`, `{ command: Commands.checklist, label: 'Checklist', tab: CORE_DOCUMENTS.PLAN, tooltip: 'Generate a quality checklist for the plan' }`, `{ command: Commands.analyze, label: 'Analyze', tab: CORE_DOCUMENTS.TASKS, tooltip: 'Cross-check spec, plan, and tasks for consistency' }`. Export `optionalCommandButtonsForTab(docType: string, seen: Set<string>): EnhancementButton[]` (returns buttons for entries whose `tab === docType` and whose `command` is not in `seen`, adding each emitted command to `seen`) and `isOptionalCommand(command: string): boolean`.
  - **Verify**: `npm run compile` passes; module has no VS Code-API side effects (pure).
  - **Leverage**: `src/core/constants.ts` (`Commands`, `CORE_DOCUMENTS`), `src/features/spec-viewer/types.ts` (`EnhancementButton`).

- [x] **T002** [P] Render built-in buttons per tab *(depends on T001)* — `src/features/spec-viewer/specViewerProvider.ts` | R001, R002, R003, R006, R007
  - **Do**: In `resolveEnhancementButtons`, after the `customCommands` loop and the workflow-commands merge, append `...optionalCommandButtonsForTab(docType, seenCommands)` to `buttons`. Pass the existing `seenCommands` set so user/workflow commands with the same id win (dedup).
  - **Verify**: `npm run compile` passes; opening a spec on the spec tab shows Clarify, plan tab shows Checklist, tasks tab shows Analyze.
  - **Leverage**: existing `seenCommands` dedup pattern in `resolveEnhancementButtons`.

- [x] **T003** [P] Dispatch built-in buttons via registered command *(depends on T001)* — `src/features/spec-viewer/messageHandlers.ts` | R004, R007
  - **Do**: In `handleClarify`, after the `customCommands` loop and the workflow-commands loop (before the final "No custom command configured" log), add: `if (buttonCommand && isOptionalCommand(buttonCommand)) { const targetPath = instance.state.changeRoot || specDirectory; await vscode.commands.executeCommand(buttonCommand, targetPath); return; }`.
  - **Verify**: `npm run compile` passes; clicking Clarify/Checklist/Analyze runs the matching command in the AI CLI terminal.
  - **Leverage**: registered phase commands in `src/features/specs/specCommands.ts` (signature `(specDir?, refinementContext?)`).

- [x] **T004** [P] Unit-test the helpers *(depends on T001)* — `src/features/spec-viewer/__tests__/optionalCommands.test.ts` | R005, R006, R007
  - **Do**: BDD tests: each tab (`spec`/`plan`/`tasks`) yields exactly its one button with the correct label/command/tooltip; a non-matching tab yields `[]`; a command already in `seen` is skipped; `isOptionalCommand` is true for the three ids and false otherwise.
  - **Verify**: `npm test` passes.
  - **Leverage**: existing extension-side Jest specs under `src/features/spec-viewer/__tests__/`.

- [x] **T005** [P] Test built-in dispatch + override precedence *(depends on T003)* — `src/features/spec-viewer/__tests__/messageHandlers.test.ts` | R004, R007
  - **Do**: Add cases: a `clarify` message with `command: 'speckit.clarify'` calls `vscode.commands.executeCommand('speckit.clarify', <targetPath>)`; a user `customCommands` entry with the same id still runs the raw-prompt path (executeCommand not called for it).
  - **Verify**: `npm test` passes.
  - **Leverage**: existing `messageHandlers.test.ts` mocks (`tests/__mocks__/vscode.ts`).

- [x] **T006** [P] Document the buttons in README *(depends on T002, T003)* — `README.md` | R001, R002, R003
  - **Do**: In the "Reading Specs" subsection, document the per-tab optional command buttons (Clarify on spec, Checklist on plan, Analyze on tasks) and that they require no configuration.
  - **Verify**: section reads correctly; matches the implemented tab placement.

- [x] **T007** [P] Update footer button matrix *(depends on T002, T003)* — `docs/viewer-states.md` | R006
  - **Do**: Add the optional-command buttons to the footer button matrix, showing which button appears on which step tab.
  - **Verify**: matrix matches T002 behavior.

- [x] **T008** [P] Add CHANGELOG entry *(depends on T002, T003)* — `CHANGELOG.md` | R005
  - **Do**: Add an entry under New Features describing the optional SpecKit command buttons (Clarify/Checklist/Analyze) in the spec viewer.
  - **Verify**: entry present at the top, consistent with existing CHANGELOG style.

## Phase 2: Review Feedback

- [x] **T009** Hide optional buttons once the spec is ready to mark complete — `webview/src/spec-viewer/components/FooterActions.tsx` | R006
  - **Do**: The enhancement-button row is gated on `isActive`, which only excludes `tasks-done`/`completed`/`archived`. The viewer state machine can report `status === 'implemented'` (the "ready to mark complete" gate, when **Mark Completed** shows) where `isActive` is still true, so the optional Clarify/Checklist/Analyze buttons leak through. Tighten `isActive` to also exclude `implemented` so the enhancement row disappears once tasks are complete and the spec is at the closure gate. Applies to both the primary (`vs.footer`) and legacy render paths since both gate enhancements on `isActive`.
  - **Verify**: `npm run compile` passes; on an `implemented` spec no optional buttons render; they still show while the spec is active / before implementing (`ready-to-implement`).

- [x] **T010** Make Regenerate the leftmost footer button — `webview/src/spec-viewer/components/FooterActions.tsx` | —
  - **Do**: In the primary path's `actions-left` region, render `leftActions` (Regenerate) **before** the enhancement buttons so Regenerate is the leftmost control. Update the routing comment to reflect "Regenerate first, then enhancement buttons."
  - **Verify**: `npm run compile` passes; Regenerate appears left of Clarify/Checklist/Analyze in the footer.
