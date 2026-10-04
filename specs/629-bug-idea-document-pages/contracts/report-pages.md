# Contract: Report pages

This feature exposes no API or CLI. Its interface is a UI contract: two pure builders, one nav-state field, one document type, and the labels, class names and heading ids that tests and the outline code against. Report folders are read from `.specify/bugs/` and `.specify/assessments/`. The model shapes are in [data-model.md](../data-model.md).

## Builders

Both live in `apps/vscode/src/features/reports/`, import no `fs`, take report text and return plain serialisable data.

```ts
// bugStory.ts
buildBugStory(texts: { assessment?: string; fix?: string; test?: string }, nextAction?: string): BugStory | undefined

// ideaDecision.ts
buildIdeaDecision(text: string): IdeaDecision | undefined
```

`buildBugStory` returns `undefined` when no assessment text is given, or when the reports given hold none of the sections listed under "Report sections". `nextAction` is the label of the footer's primary button. A step whose report is missing names it, and names nothing when it is absent.

`buildIdeaDecision` returns `undefined` when the verdict is not one of `go`, `needs-clarification`, `kill`, or when the document holds neither a `Verdict & Rationale` nor a `Scorecard` section.

`undefined` means the viewer shows the raw document as it does today. A builder never throws on malformed text.

## Nav state and document type

`NavState` in `apps/vscode/src/protocol/viewer.ts` gains one optional field, set on report panels only.

```ts
report?: { kind: 'bug' | 'idea'; page?: BugStory | IdeaDecision };
```

`kind` is always set on a report panel and drives the rail's label and disabled rule. `page` is present only when the builder returned a model and the current document is the one the page stands for: `story` on a bug, `decision` on an idea. With no `page`, the webview renders the document's markdown.

A bug's document list gains a first entry of type `story`. It has no file and always exists. An idea's list does not change. A request for `story` on a bug whose story cannot be built shows the assessment.

| Set | Labels, in order | Disabled when |
| --- | --- | --- |
| Bug tabs | `Story`, `Assessment`, `Fix`, `Test` | the report file does not exist; `Story` is never disabled |
| Idea rail | `Intake`, `Research`, `Problem`, `Concept`, `Decision` | the stage document does not exist |

Opening a bug from its row lands on `story`. Opening one of its reports lands on that report. An idea opened from its row lands on its latest stage document.

## Bug leads

| `bugState` | Test report | Lead |
| --- | --- | --- |
| `closed` | any | `Closed without a fix.` |
| `verified` | says verified | `Fixed and verified.` |
| `to-test` | none | `Fixed, not tested yet.` |
| `to-fix` | says failed or partial | `The fix did not hold.` |
| `to-fix` | exists, result not recognised | `Tested, result unclear.` |
| `to-fix` | none | `Assessed, not fixed yet.` |

The lead is the sentence alone. A closed bug shows only its first step. The steps are titled `What was wrong`, `What changed`, `How it was verified`, and the closing section `Risks and open questions`.

## Idea leads and closing sections

| Verdict | Lead opens with | Closing section |
| --- | --- | --- |
| `go` | `Go.` | `Handoff` |
| `needs-clarification` | `Needs clarification.` | `What is blocking` |
| `kill` | `Kill.` | `Revisit trigger` |

`Scorecard` sits between the rationale and the closing section. Ratings are `strong` (favourable), `adequate` (mixed), `weak` (unfavourable) and `unknown` (no tone). A row with any other rating shows its criterion and reason without a rating.

## Report sections

Headings are matched case-insensitively by prefix, outside code fences. A table is read by its header row, so a reordered column still lands in the right field.

| Report | Heading | Read as |
| --- | --- | --- |
| Assessment | `Symptom` | prose for `What was wrong` |
| Assessment | `Root Cause Hypothesis` | prose for `What was wrong` |
| Assessment | `Risks & Considerations` | list for `Risks and open questions` |
| Assessment | `Open Questions` | list for `Risks and open questions` |
| Fix | `Summary` | prose for `What changed` |
| Fix | `Changes` | table `File \| Change \| Notes`, one row per file |
| Fix | `Diff Highlights` | every fenced block, in order |
| Test | `Summary` | prose for `How it was verified` |
| Test | `Checks Performed` | table `Check \| Command / Action \| Result \| Notes` |
| Test | `Residual Risks` | list for `Risks and open questions` |
| Decision | `Scorecard` | table `Criterion \| Rating \| Justification` |
| Decision | `Verdict & Rationale` | lead and rationale |
| Decision | `If go` | `- **Term**: text` fields for `Handoff` |
| Decision | `If needs-clarification` | `Blocking questions` and `Revisit stage` for `What is blocking` |
| Decision | `Revisit trigger` | prose for `Revisit trigger` |

A missing section leaves its part of the page out. A list item that only says there is nothing, such as `None.`, is dropped. No empty heading, row or placeholder is rendered.

## Class names

All page classes carry the `rp-` prefix and live in `apps/vscode/webview/styles/spec-viewer/_report-pages.css`, scoped under `#markdown-content`.

| Class | On |
| --- | --- |
| `rp-lead` | the lead sentence |
| `rp-meta` | the meta line under the lead |
| `rp-line` | the timeline wrapping the steps |
| `rp-step`, `rp-step--done`, `rp-step--next` | one step, and whether its report exists |
| `rp-step__mark` | the step's marker on the timeline |
| `rp-step__when` | the step's quiet "when" line |
| `rp-rows` | changed files and checks |
| `rp-score`, `rp-score__rating` | one scorecard row, and its rating |
| `rp-tone--favourable`, `rp-tone--mixed`, `rp-tone--unfavourable` | a rating's tone |
| `rp-defs` | the definition list of closing-section fields |

## Heading ids

Each section heading is an `h2` with a fixed id, which the "On this page" outline reads. Prose fragments inside a section carry no ids.

| Page | Ids, in order |
| --- | --- |
| Bug story | `what-was-wrong`, `what-changed`, `how-it-was-verified`, `risks-and-open-questions` |
| Idea decision | `scorecard`, then one of `handoff`, `what-is-blocking`, `revisit-trigger` |
