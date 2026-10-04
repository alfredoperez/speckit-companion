# Research: Document pages for bugs and ideas

## Where the page model is built

**Decision**: On the extension host, inside `readReportPanel`, by pure functions in `features/reports/`. It travels to the webview as `NavState.report`.
**Rationale**: A report panel replaces its whole HTML on every tab switch and file change and sends no content message. Whatever is in the initial nav state is current, so the page updates with the files for free. Pure functions with no `fs` import can be called from Storybook with fixture text.
**Alternatives considered**: Parsing in the webview from raw markdown. Rejected: the webview receives one document's text, and a bug story needs three.

## Where the page is mounted

**Decision**: Inside `#markdown-content`, in place of the rendered markdown, when the nav state carries a page for the current document.
**Rationale**: The reading column, narrow-mode placement and the outline are all keyed to that element. The Overview pane is mounted as a sibling and gets neither a column nor an outline. The page calls `applyHighlighting` and `buildToc` after it renders, the same two calls the markdown path makes.
**Alternatives considered**: A sibling pane like the Overview. Rejected: no outline, which the spec requires.

## How Story appears among the tabs

**Decision**: A bug's document list gains a first entry of type `story` with no file, always present. An idea gains none: its Decision stage renders the decision page.
**Rationale**: The rail already draws one entry per document and switches with `switchDocument`, which the read-only message allow-list already permits. No new message type. With Story first, the rail's "first entry is always clickable" rule no longer leaves a missing Assessment clickable.
**Alternatives considered**: A client-side toggle. Rejected: every switch reloads the webview, so client state is lost.

## Which document opens

**Decision**: A bug or idea row opens the default document: Story for a bug, the latest stage for an idea. A report row opens that report.
**Rationale**: Today the pane passes the first report's path for the item row. The row command gains a landing flag so the provider can tell "open this bug" from "open this report".
**Alternatives considered**: Always land on Story. Rejected: clicking Fix in the sidebar should show the fix.

## The bug's state for the lead

**Decision**: Six leads, derived from `bugState` plus whether a test report exists and what it says. `closed` gives "Closed without a fix.". `verified` gives "Fixed and verified.". `to-test` gives "Fixed, not tested yet.". `to-fix` with a failed or partial test gives "The fix did not hold.", with an unrecognised test result gives "Tested, result unclear.", and otherwise gives "Assessed, not fixed yet.".
**Rationale**: `bugState` has four values and folds four situations into `to-fix`. The pane already refuses to say a fix stands when the result is unclear, and the page has to match.
**Alternatives considered**: Extending `BugState`. Rejected: it drives pane grouping and footer buttons, which are out of scope.

## Prose fragments

**Decision**: A small fragment renderer in the webview: paragraphs and list items through `parseInline`, fenced code as the viewer's `pre.code-block` markup with the text escaped.
**Rationale**: `renderMarkdown` assigns heading ids and wraps every line in comment controls, so calling it per section would add stray outline entries and duplicate ids.
**Alternatives considered**: `renderMarkdown` per fragment, as the prototype did. Rejected for the reason above.

## Recognised values that have no list yet

**Decision**: Add `IDEA_RATINGS` (`strong`, `adequate`, `weak`, `unknown`) with a tone each, and `BUG_CHECK_RESULTS` (`pass`, `fail`, `not-run`). Dates are shown only when they parse as a date. Source is free text, shown escaped, and dropped when it is a `[NEEDS CLARIFICATION` placeholder.
**Rationale**: The decide command's template names exactly those four ratings. The spec requires every state-like value to come from a list.
**Alternatives considered**: The prototype's regex tone table. Rejected: it guesses a tone for any word.

## What the lead says after the state

**Decision**: The bug lead is the state sentence alone. The idea lead is the verdict plus the first sentence of the rationale, with a leading bold verdict sentence stripped first.
**Rationale**: The prototype followed the bug's state with the first sentence of the fix summary, which then appeared again under What changed. Real rationales open with `**Go.**` or `**Kill, for now.**`, which would say the verdict twice.
**Alternatives considered**: Keeping the prototype's tail and trimming the summary. Rejected: two places to keep in step.

## What the prototype shows that ships, and what does not

**Decision**: Ships: the lead, the meta line, the timeline with a quiet "when" line per step, changed files as rows, all diff blocks, the scorecard rows, the definition list. Does not ship: the confidence aside, the scorecard tally line, the "reviewed" list in the idea meta line.
**Rationale**: Each dropped item restates something the page already shows, or is regex-extracted from prose and breaks on real reports.
**Alternatives considered**: Porting the prototype whole. Rejected: it was written for one state of one fixture.
