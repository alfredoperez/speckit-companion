# Contract: create screens and report actions

What the feature exposes to the rest of the extension, to its webviews and to tests. Identifiers and labels are exact.

## Commands and view title actions

| Command | Title | Icon | Where |
|---|---|---|---|
| `speckit.bugs.create` | `New Bug` | `$(plus)` | `view/title` on the Bugs pane, `navigation@2` |
| `speckit.ideas.create` | `New Idea` | `$(plus)` | `view/title` on the Ideas pane, `navigation@2` |

Both are hidden from the palette when their view is not relevant, the same way Refresh is. Each command first checks that the process's Spec Kit extension folder exists. If it is missing, the command shows a message with an Install button that runs the existing install command, opens nothing and sends nothing. Otherwise it opens the create screen titled `New Bug` or `New Idea`.

## Create screen messages

Types live in `apps/vscode/src/protocol/processCreate.ts`. One provider serves both kinds.

Webview to extension:

| Message | Fields | Meaning |
|---|---|---|
| `ready` | none | The webview has loaded and wants `init`. |
| `submit` | `text`, `extra`, `slug` | `text` is the symptom or the idea. `extra` is the link or pasted error for a bug, the audience for an idea, and may be empty. |
| `cancel` | none | Close the screen and send nothing. |

Extension to webview:

| Message | Fields | Meaning |
|---|---|---|
| `init` | `kind`, `assistantName`, `existingSlugs` | `kind` is `'bug'` or `'idea'`. `existingSlugs` are the folder names of that kind. |
| `submissionStarted` | none | The dispatch has begun. |
| `submissionComplete` | none | The dispatch was sent. The screen closes. |
| `error` | `message` | The dispatch failed. The screen stays open with the typed text. |

The submit button reads `Assess bug` or `Assess idea`. It is disabled while `text` is empty, while the slug is empty, and while the slug is in `existingSlugs`.

## Slug rules

- `slugFromText(text)`: lowercase, every run of characters outside `a-z0-9` becomes `-`, leading and trailing `-` are trimmed, at most four words and 40 characters.
- `normaliseSlug(value)`: the same cleaning with no word cap.
- The slug field follows `slugFromText` of the first field until the developer edits it. After that it holds `normaliseSlug` of what they type.
- The extension runs `normaliseSlug` again on the `slug` it receives. It replies `error` and sends nothing when the result is empty or when a folder of that kind with that name exists.
- A value such as `../x` or `/` normalises to a safe slug or to nothing. A slug only ever holds `a-z`, `0-9` and `-`.

## Prompt shapes

Both go through `executeInTerminal`. The command is spelled for the configured assistant by the existing formatter.

- A step: `/<command spelled for the assistant> slug=<slug>`
- A create: `/<command spelled for the assistant> slug=<slug>` followed by one sentence naming the file that holds the text.
- Asking again (`Assess again`, `Reopen from intake`): the step shape followed by one sentence pointing at the existing folder.

For a create, `text` and `extra` are written to a file under the extension's storage. The prompt holds only the command, `slug=<slug>` and that file's path. Typed text is never placed in the prompt. A create uses `speckit.bug.assess` for a bug and `speckit.assess.intake` for an idea. The wording of the extra sentence is not part of the contract. Tests assert on the command, on `slug=<slug>` and on the path.

## Report actions

A report action is `{ id, label, primary }`. The extension computes the list from the item's files and puts it in `NavState.reportActions`. The functions are `bugActions`, `ideaActions` and `commandForAction` in `apps/vscode/src/features/processes/processActions.ts`.

| Action id | Result |
|---|---|
| `bug.assess` | `speckit.bug.assess` |
| `bug.fix` | `speckit.bug.fix` |
| `bug.test` | `speckit.bug.test` |
| `idea.intake` | `speckit.assess.intake` |
| `idea.research` | `speckit.assess.research` |
| `idea.define` | `speckit.assess.define` |
| `idea.shape` | `speckit.assess.shape` |
| `idea.decide` | `speckit.assess.decide` |
| `idea.createSpec` | Opens Create Spec with a prefill. Sends nothing to the assistant. |

Buttons by state. The main button has `primary: true`, a secondary one has `primary: false`.

| Item | State | Main | Secondary |
|---|---|---|---|
| Bug | to fix, no fix report | `Fix bug` (`bug.fix`) | |
| Bug | to fix, fix not applied | `Fix bug` (`bug.fix`) | |
| Bug | to fix, has a test report | `Fix bug` (`bug.fix`) | `Test again` (`bug.test`) |
| Bug | to test | `Test fix` (`bug.test`) | `Fix again` (`bug.fix`) |
| Bug | verified | | `Test again` (`bug.test`) |
| Bug | closed | | `Assess again` (`bug.assess`) |
| Idea | assessing, at intake | `Research` (`idea.research`) | |
| Idea | assessing, at research | `Define the problem` (`idea.define`) | |
| Idea | assessing, at problem | `Shape a concept` (`idea.shape`) | |
| Idea | assessing, at concept | `Decide` (`idea.decide`) | |
| Idea | decided, go | `Create spec from this idea` (`idea.createSpec`) | |
| Idea | decided, needs-clarification | `Continue assessment` (`idea.research`) | |
| Idea | decided, kill | | `Reopen from intake` (`idea.intake`) |
| Idea | decided, no known verdict | `Decide` (`idea.decide`) | |

A deleted bug or idea folder gives an empty list, so the page shows no buttons.

## The `reportAction` viewer message

The webview posts `{ type: 'reportAction', id }`. It carries no command and no slug. It is the one message a read-only report panel may send, and the read-only allow-list in `messageHandlers.ts` gains it. Editing and commenting stay blocked.

On receipt the extension:

1. Reads the item again from its files and recomputes its actions.
2. Ignores the message when `id` is not among the actions that state offers.
3. Takes the slug from the item's folder name.
4. For `idea.createSpec`, runs `speckit.openSpecEditor` with the prefill and stops.
5. Otherwise looks the command up in the action table and dispatches the step prompt.

Each click sends once. The page does not guard against the assistant running two steps. Buttons follow the files: the panel's HTML is rebuilt when its files change, and `reportActions` is computed in that build.

## Create Spec prefill

`speckit.openSpecEditor` takes one optional string argument, the description. The extension passes it to the webview as `init.prefill`, typed in `apps/vscode/src/protocol/spec-editor.ts`. It fills an empty editor. If the editor already holds text, Companion asks before replacing it. For an idea, the description is the idea's title, the first paragraph of the decision's rationale and the path of the assessment folder. Nothing is created until the developer sends the form.
