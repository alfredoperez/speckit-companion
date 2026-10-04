# Data Model: Document pages for bugs and ideas

Two page models are built on the extension host by pure functions and travel to the webview inside the initial nav state. Nothing here is persisted: every model is derived from the report files each time the panel renders, which is how the pages stay current when a file changes (FR-015).

Two rules apply to every field below. A field that is free text from a report is a markdown string, rendered by the fragment renderer and never interpreted. A field that is state-like is a member of a recognised list or it is absent, and the webview never sees the raw value (FR-012).

## BugStory

What the Story tab shows for one bug. Built by `buildBugStory(texts, nextAction)` from up to three report texts (assessment, fix, test) and the label of the footer's next button. Returns `undefined` when the reports hold none of the sections the page uses, and the panel then shows the raw report (FR-013).

| Field | Type | Source and rule |
| --- | --- | --- |
| `lead` | `BugLead` | One of six states, see State transitions. The webview maps it to the lead sentence. The sentence is Companion's wording and is never read from a report. |
| `meta` | `BugMeta` | The facts for the one line under the lead. |
| `steps` | `[BugStep, BugStep, BugStep]` | Always three, in order: `wrong`, `changed`, `verified`. |
| `risks` | `string[]` | Markdown items. Assessment risks and open questions plus the test report's residual risks. Fix follow-ups are not included. Empty means the section is not shown (FR-007). |
| `nextAction` | `string?` | The label of the footer button that produces the next report, such as Test fix. Absent when the footer offers none. |

**BugMeta**: every field is optional and is left out when its report does not state a recognised value (FR-003).

| Field | Type | Rule |
| --- | --- | --- |
| `reported` | `string?` | Kept only when it parses as a date. |
| `source` | `string?` | Free text, shown escaped. Dropped when it is a `[NEEDS CLARIFICATION` placeholder. |
| `verdict` | `BugVerdict?` | Member of `BUG_VERDICTS`. |
| `severity` | `BugSeverity?` | Member of `BUG_SEVERITIES`. |
| `fixStatus` | `BugFixStatus?` | Member of `BUG_FIX_STATUSES`. |

The header badge already names the outcome, so the builder leaves out of `meta` the one value the badge shows.

**BugStep**

| Field | Type | Rule |
| --- | --- | --- |
| `id` | `'wrong' \| 'changed' \| 'verified'` | Maps to What was wrong, What changed, How it was verified. |
| `state` | `'done' \| 'next'` | `done` when the step's report exists, `next` when it does not (FR-004). A fix report whose status is not applied leaves `changed` as `next` while its content is still shown. |
| `when` | `string?` | The step report's date, for the quiet "when" line. Kept only when it parses as a date. |
| `body` | `string?` | Markdown prose from the report section. Absent when the section is missing. |
| `files` | `ChangedFile[]?` | `changed` step only. |
| `diffs` | `DiffBlock[]?` | `changed` step only. |
| `checks` | `CheckRow[]?` | `verified` step only. |

A `next` step with no content shows one sentence saying the report does not exist and names `nextAction` when there is one (FR-005). That sentence is Companion's wording and is not a field.

**Row shapes inside a step**: a changed-file row per file the fix report lists (FR-006), a diff block per fenced diff in document order, and a check row per check the test report lists.

| Shape | Field | Type | Rule |
| --- | --- | --- | --- |
| `ChangedFile` | `path` | `string` | Required. Rendered as text and wraps or truncates, never widening the page. |
| `ChangedFile` | `change`, `note` | `string?` | Markdown. |
| `DiffBlock` | `language` | `string?` | The fence's info string. |
| `DiffBlock` | `code` | `string` | Raw text, escaped at render. Never markdown. |
| `CheckRow` | `name` | `string` | Markdown. Required. |
| `CheckRow` | `result` | `BugCheckResult?` | Member of `BUG_CHECK_RESULTS`, otherwise absent and not shown. |
| `CheckRow` | `note` | `string?` | Markdown. |

**Validation across the model**: a row with no required field is dropped, a list that ends up empty is absent, and a string that appears in two places is kept once, in the earlier place (FR-017). A field holding an unfilled template option list is treated as unrecognised.

### State transitions

`lead` is derived, not stored. It comes from the existing `bugState` plus whether a test report exists and what it says. `BugState` itself does not change, because it drives pane grouping and the footer.

| `bugState` | Test report | `lead` | Sentence |
| --- | --- | --- | --- |
| `closed` | any | `closed` | Closed without a fix. |
| `verified` | says verified | `verified` | Fixed and verified. |
| `to-test` | none | `fixed-untested` | Fixed, not tested yet. |
| `to-fix` | says failed or partial | `test-failed` | The fix did not hold. |
| `to-fix` | exists, result not recognised | `test-unclear` | Tested, result unclear. |
| `to-fix` | none | `assessed` | Assessed, not fixed yet. |

A bug moves along `assessed` to `fixed-untested` to `verified` as reports are written. A failed or partial test moves it to `test-failed`, and a new fix and test move it on again. `closed` is reached only by an invalid assessment verdict, and a closed bug shows only the first step.

## IdeaDecision

What the Decision stage shows for one decided idea. Built by `buildIdeaDecision(text)` from the decision document alone. Returns `undefined` when the verdict is not recognised or the document has none of the expected sections, and the raw decision document is shown with the rail.

| Field | Type | Source and rule |
| --- | --- | --- |
| `verdict` | `IdeaVerdict` | Required. Member of `IDEA_VERDICTS`. The webview maps it to Go., Needs clarification. or Kill. |
| `lead` | `string?` | Markdown. The first sentence of the rationale, after a leading bold verdict sentence is stripped so the verdict is said once. |
| `rationale` | `string?` | Markdown. The rest of the rationale, without the lead sentence. |
| `scorecard` | `ScoreRow[]` | Empty means the Scorecard section is not shown. |
| `closing` | `IdeaClosing?` | The section that fits the verdict. Absent when its source is missing. |

**ScoreRow**: one per criterion (FR-010).

| Field | Type | Rule |
| --- | --- | --- |
| `criterion` | `string` | Markdown. Required. |
| `rating` | `IdeaRating?` | Member of `IDEA_RATINGS`, otherwise absent and not shown. |
| `tone` | `'favourable' \| 'mixed' \| 'unfavourable'?` | Looked up from `rating`, never guessed from the text. The rating word is always shown beside the colour, so tone does not rely on colour alone. |
| `reason` | `string?` | Markdown. |

**IdeaClosing**: a union keyed by `verdict`, so a page can only carry the section its verdict allows.

| Verdict | Heading | Fields |
| --- | --- | --- |
| `go` | Handoff | `fields: { term: string; text: string }[]`, both markdown, in document order. |
| `needs-clarification` | What is blocking | `questions: string[]` in markdown, and `revisit?: IdeaStage`, a member of `IDEA_STAGES`. |
| `kill` | Revisit trigger | `trigger: string` in markdown. |

An idea has no state machine of its own here. It is either still being assessed, in which case no `IdeaDecision` is built and it opens on its latest stage document, or decided, in which case the Decision stage is this page.

## NavState.report

The carrier that takes a page model from the host to the webview. Added to `NavState` in `apps/vscode/src/protocol/viewer.ts` and filled by `readReportPanel`. Present on bug and idea panels only.

| Field | Type | Rule |
| --- | --- | --- |
| `kind` | `'bug' \| 'idea'` | Required. Tells the webview which page component and which rail labels to use. |
| `page` | `BugStory \| IdeaDecision \| undefined` | A `BugStory` when `kind` is `bug`, an `IdeaDecision` when `kind` is `idea`. Present only when the current document is the one the page stands for (Story for a bug, Decision for an idea) and the model could be built. |

With `page` present the webview mounts the page inside `#markdown-content` in place of the rendered markdown. With `page` absent it renders the document as it does today. There is no update message: a report panel replaces its HTML on every tab switch and file change, so the initial nav state is always current.

## The `story` document entry

A new first entry in a bug's document list, added by `reportDocuments`. It makes Story a tab without a new message type, because the rail already draws one entry per document and switches with `switchDocument`.

Its `type` is `story` and its label is Story. It is the only entry with no file path, and it always exists.

Relationships and rules: a bug's documents are Story, Assessment, Fix, Test in that order (FR-008). A report entry whose file does not exist is disabled, and with Story first the rail's "first entry is always clickable" rule no longer leaves a missing Assessment clickable. Opening a bug from its row lands on `story`, and opening a report row lands on that report. An idea's document list does not change: it stays the five stages in order, a stage with no document is disabled, and Decision renders the decision page (FR-011).

## New value lists

| List | Members | Lives in | Used by |
| --- | --- | --- | --- |
| `IDEA_RATINGS` | `strong`, `adequate`, `weak`, `unknown`, each with a tone | `features/ideas/ideaValues.ts` | `ScoreRow.rating` and `ScoreRow.tone` |
| `BUG_CHECK_RESULTS` | `pass`, `fail`, `not-run` | `features/bugs/bugValues.ts` | `CheckRow.result` |

Both are read through the existing `knownValue`, the same way as the lists that already exist and move to these fs-free files unchanged: `BUG_VERDICTS`, `BUG_SEVERITIES`, `BUG_FIX_STATUSES`, `BUG_TEST_RESULTS`, `IDEA_VERDICTS` and `IDEA_STAGES`. The tone for each rating is `strong` favourable, `adequate` mixed, `weak` unfavourable. The sources name three tones for four ratings and do not say which `unknown` takes, so it carries no tone until the plan says otherwise.
