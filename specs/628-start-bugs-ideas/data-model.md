# Data Model: Start and continue a bug or an idea from Companion

Nothing here is stored by Companion. Every entity is either a message between a webview and the extension, or a value derived from Spec Kit's files each time a page is built.

## Create request

What a create screen sends. Message: `submit { text, extra, slug }`, on a screen opened with `init { kind, assistantName, existingSlugs }`.

| Field | Type | Rules |
|---|---|---|
| `kind` | `'bug'` or `'idea'` | Set by the command that opened the screen (`speckit.bugs.create`, `speckit.ideas.create`). Never sent by the webview on submit. |
| `text` | string | Required. The symptom or the idea. Sending is blocked while it is empty (FR-005). |
| `extra` | string | Optional. A link or pasted error for a bug, the audience for an idea. |
| `slug` | string | Required. See Slug. |

Rules: `text` and `extra` are written to a file under the extension's storage and never placed in the prompt (FR-012). The prompt is `/<command spelled for the assistant> slug=<slug>` plus one sentence naming that file. The command is `speckit.bug.assess` for a bug and `speckit.assess.intake` for an idea. When a dispatch fails the screen stays open with what was typed and shows `error { message }`.

## Slug

The folder name of the new item, and the only typed value that rides in the prompt.

- `slugFromText(text)`: lowercase, runs of anything outside `a-z0-9` become `-`, trimmed, at most four words and 40 characters. Used while the developer has not edited the slug field.
- `normaliseSlug(value)`: the same cleaning with no word cap. Used on what the developer types, and again by the extension on what it receives.
- MUST NOT be empty after normalising (FR-004). A value such as `../x` or `/` normalises to something safe or to nothing.
- MUST NOT be in `existingSlugs` for the same kind. The webview says so before sending. The extension checks the folder again on receipt.

## Report action

One button on a bug or idea page. Shape: `{ id, label, primary }`, carried in `NavState.reportActions`.

| Field | Type | Rules |
|---|---|---|
| `id` | string | One of `bug.assess`, `bug.fix`, `bug.test`, `idea.intake`, `idea.research`, `idea.define`, `idea.shape`, `idea.decide`, `idea.createSpec`. |
| `label` | string | The button text from the table below. |
| `primary` | boolean | True for the Main button. At most one action per page is primary. |

Action to command: `bug.assess` → `speckit.bug.assess`, `bug.fix` → `speckit.bug.fix`, `bug.test` → `speckit.bug.test`, `idea.intake` → `speckit.assess.intake`, `idea.research` → `speckit.assess.research`, `idea.define` → `speckit.assess.define`, `idea.shape` → `speckit.assess.shape`, `idea.decide` → `speckit.assess.decide`. `idea.createSpec` opens Create Spec.

Label to id where the label is not the stage name: Fix again is `bug.fix`, Test again is `bug.test`, Assess again is `bug.assess`, Continue assessment is `idea.research`, Reopen from intake is `idea.intake`. Assess again and Reopen from intake add one sentence pointing at the existing folder.

## Report action click

Message: `{ type: 'reportAction', id }`. It is the only message a read-only report panel may send (FR-011).

Rules: it carries no command and no slug. On receipt the extension reads the item again, checks the id is among the actions that state offers, takes the slug from the folder, and looks the command up. An id the current state does not offer is dropped, so a stale page is harmless. The prompt is `/<command spelled for the assistant> slug=<slug>`.

## Next step: buttons by state

The actions for an item are a pure function of its kind and its state as read from the files (`bugActions`, `ideaActions`). A deleted folder gives no actions.

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

## State transitions

Companion writes no state. A transition happens when the assistant writes or removes a report, and the page's HTML is rebuilt from the files, so the buttons follow without reopening it (FR-010). A step run by hand shows up the same.

- Bug: to fix, then a fix report moves it to to test, then a test report moves it to verified. A failed or partial test moves it back to to fix, now with a test report.
- Idea: assessing at intake, research, problem, concept, then decided with a verdict of go, needs-clarification or kill.

## Create Spec prefill

`speckit.openSpecEditor` takes an optional string, delivered as `init.prefill`.

Rules: for `idea.createSpec` the string is the idea's title, the first paragraph of the decision's rationale, and the path of the assessment folder. It fills an empty editor. If the editor already holds text, Companion asks before replacing it. Nothing is created until the developer sends it (FR-009).

## Relationships

- A create request produces one bug or idea folder named by its slug, once the assistant has written the assessment.
- A bug or idea has zero or more report actions, and at most one is primary.
- A report action click resolves to one report action, and through it to one Spec Kit command or to Create Spec.
- The link between an idea and the spec made from it is not recorded.
