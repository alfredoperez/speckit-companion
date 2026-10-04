# Implementation Plan: Start and continue a bug or an idea from Companion

**Branch**: `628-start-bugs-ideas` | **Spec**: [start-bugs-ideas.spec.md](./start-bugs-ideas.spec.md)

**Scale note**: About 20 files in three groups that do not overlap: a new small create screen, footer buttons in the viewer's read-only report panel, and a prefill option on Create Spec. Watch the one place user text meets a terminal, and the one message a read-only panel is now allowed to send.

## Summary

A small second webview, opened as New Bug or New Idea, collects the text and a slug and hands them to the assistant: the text goes into a file, and the prompt holds only the command, the slug and that file's path. A bug or idea page gets a footer whose buttons are computed on the extension side from the files; a click sends an id, and the extension re-reads the item, checks the id is one it offered, and dispatches the matching Spec Kit command with the folder's own slug. Create Spec learns to open with a description filled in, for a go idea.

## Project Structure

```text
apps/vscode/src/
├── protocol/processCreate.ts                     # NEW: create screen messages, slugFromText, normaliseSlug
├── features/processes/processActions.ts          # NEW: bugActions, ideaActions, commandForAction (pure)
├── features/process-create/                      # NEW
│   ├── processCreateProvider.ts                  #   one provider, kind 'bug' | 'idea'
│   └── processCreateCommands.ts                  #   speckit.bugs.create, speckit.ideas.create
├── features/spec-viewer/
│   ├── specViewerProvider.ts                     # report panels compute and send their actions
│   ├── html/generator.ts                         # reportActions on first paint
│   └── messageHandlers.ts                        # reportAction handler; the read-only allow-list gains it
├── protocol/viewer.ts                            # NavState.reportActions, reportAction message
├── features/spec-editor/{specEditorProvider,specEditorCommands}.ts   # optional prefill
├── protocol/spec-editor.ts                       # init.prefill
├── core/constants.ts, extension.ts
apps/vscode/webview/
├── src/process-create/{index.ts,ProcessCreateMock.tsx,__stories__,__tests__}   # NEW, reuses spec-editor.css classes
├── src/spec-viewer/components/footer/ReportFooter.tsx                          # NEW
├── src/spec-viewer/components/FooterActions.tsx
└── src/spec-editor/index.ts                      # apply a prefill
webpack.config.js, package.json
README.md, CHANGELOG.md, apps/website/src/content/docs/docs/{navigate/the-sidebar,processes/fix-a-bug,processes/assess-an-idea}.mdx
```

**Structure Decision**: The create screen is its own small webview and provider, not a mode of Create Spec, whose submit path is 190 lines of workflow, image and telemetry logic that does not apply. It reuses that screen's stylesheet and class names so the two look alike.

## Identifiers

- Commands: `speckit.bugs.create` ("New Bug", `$(plus)`), `speckit.ideas.create` ("New Idea", `$(plus)`), each a `view/title` action at `navigation@2` on its pane, hidden from the palette when the view is not relevant in the same way Refresh is.
- Create screen messages (webview to extension): `ready`, `submit { text, extra, slug }`, `cancel`. Extension to webview: `init { kind, assistantName, existingSlugs }`, `submissionStarted`, `submissionComplete`, `error { message }`.
- `slugFromText(text)`: lowercase, runs of anything outside `a-z0-9` become `-`, trimmed, at most four words and 40 characters. `normaliseSlug(value)`: the same cleaning with no word cap. Both live in `protocol/processCreate.ts` and the extension re-normalises what it receives.
- Report actions: `{ id, label, primary }` with ids `bug.assess`, `bug.fix`, `bug.test`, `idea.intake`, `idea.research`, `idea.define`, `idea.shape`, `idea.decide`, `idea.createSpec`. `NavState.reportActions`; viewer message `{ type: 'reportAction', id }`.
- Action to command: `bug.assess` → `speckit.bug.assess`, `bug.fix` → `speckit.bug.fix`, `bug.test` → `speckit.bug.test`, `idea.intake` → `speckit.assess.intake`, `idea.research` → `speckit.assess.research`, `idea.define` → `speckit.assess.define`, `idea.shape` → `speckit.assess.shape`, `idea.decide` → `speckit.assess.decide`. `idea.createSpec` opens Create Spec.
- Prompt for a step: `/<command spelled for the assistant> slug=<slug>`. For a create: the same plus one sentence naming the file that holds the text.
- Create Spec prefill: `speckit.openSpecEditor` takes an optional string; `init.prefill`.

## Buttons by state

| Item | State | Main | Secondary |
|---|---|---|---|
| Bug | to fix, no fix report | Fix bug | |
| Bug | to fix, fix not applied | Fix bug | |
| Bug | to fix, has a test report | Fix bug | Test again |
| Bug | to test | Test fix | Fix again |
| Bug | verified | | Test again |
| Bug | closed | | Assess again |
| Idea | assessing, at intake | Research | |
| Idea | assessing, at research | Define the problem | |
| Idea | assessing, at problem | Shape a concept | |
| Idea | assessing, at concept | Decide | |
| Idea | decided, go | Create spec from this idea | |
| Idea | decided, needs-clarification | Continue assessment | |
| Idea | decided, kill | | Reopen from intake |
| Idea | decided, no known verdict | Decide | |

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. Commands are spelled per assistant through the existing formatter. |
| II. Spec-Driven Workflow | PASS. Companion starts Spec Kit's own commands and records nothing of its own. |
| III. Visual and Interactive | PASS. A create screen and footer buttons replace typed commands. |
| IV. Modular Architecture for Complex Features | PASS. Button rules are one pure module; the create screen is its own feature folder. |
