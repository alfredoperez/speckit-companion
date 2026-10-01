# Research: Bug reports in the sidebar and viewer (read-only)

## Report format comes from the installed extension, not the issue text

**Decision**: parse the formats the `bug` extension v1.0.0 actually writes: `# Bug Assessment|Fix|Verification: <title>`, then `- **Label**: value` bullets, with no front matter. Verdict and Severity in `assessment.md`, Status in `fix.md`, Result in `test.md`.
**Rationale**: read from `.specify/extensions/bug/commands/speckit.bug.*.md` after `specify extension add bug`, and confirmed by running the three commands headlessly on a planted bug. Those real files are the test fixtures.
**Alternatives considered**: front matter (the issue's open question); the extension writes none.

## Bugs sit in a group inside the Specs view

**Decision**: a **Bugs** group after Active, Completed and Archived, shown only when at least one bug report is found.
**Rationale**: the Specs view is where work items live and already groups them; a fourth group needs no container change. Bugs have no number and no lifecycle, so inside the lifecycle groups they would break the Number and Workflow Step sorts and pick up lifecycle menus.
**Alternatives considered**: a separate Bugs view (changes the container's view list, needs its own welcome and visibility setting, too much for a read-only slice); bug rows mixed into Active (sort and menus break).

## The filter applies to bugs, the sort does not

**Decision**: the Specs filter narrows bugs by slug or title with the same fuzzy match; bugs are always ordered by slug.
**Rationale**: VS Code shows the "No specs match" welcome only when the tree is empty, so a filter that ignored bugs would hide the clear-filter offer behind a Bugs group. Sort modes are about spec numbers and steps, which bugs do not have.
**Alternatives considered**: ignore the filter (breaks the empty-filter offer); apply the sort (no meaningful key).

## A workspace with bugs and no specs shows the Bugs group

**Decision**: the root returns the Bugs group when there are bugs and no specs; with neither it stays empty so the welcome shows as today.
**Rationale**: the bug extension needs `specify init`, so this workspace is set up; hiding its reports to keep a "create your first spec" welcome would make them unreachable.
**Alternatives considered**: keep the early empty return (bugs invisible until a spec exists).

## A separate read-only bug mode in the viewer, not living mode

**Decision**: a `bug` flag on the panel state, routed like `living` in every update and refresh path. The three reports become the panel's documents, shown by the normal rail, whose `StepTab` already disables an entry whose file does not exist.
**Rationale**: living mode hides the rail (its tiers open from the tree), swaps in a living footer and runs the living markdown preprocessors, all wrong here. The plain spec path writes a backfill `.spec-context.json` on first open, which FR-007 forbids. A third branch beside `living` is the smallest path that writes nothing.
**Alternatives considered**: reuse `living` with a family switch (every living consumer needs a check); reuse the spec path with custom documents (writes the run record).

## Read-only is enforced on both sides

**Decision**: the extension accepts only read messages from a bug panel (ready, switch document, rail click, refresh, open file, open source, webview error) and drops the rest with a log line. The page carries `data-read-only`, which `isReadOnly()` and the line-action CSS honour, and the checkbox toggle checks `isReadOnly()` too.
**Rationale**: `toggleCheckbox`, `editLine` and `removeLine` save the file on disk, and comments and refinement assume a run record. An allow-list on the extension side is one checkable gate; the webview side only stops offering what would be dropped.
**Alternatives considered**: guard each write handler (easy to miss one, a new handler is open by default); pretend the bug is archived (it would read as an archived spec in CSS and badges).

## The header shows the parsed title

**Decision**: the header title is the bug's parsed title and the badge is its outcome (or `BUG` when none), so the hidden first H1 loses nothing.
**Rationale**: with a header title set the page hides the document's own H1; the header must carry it.

## A watcher on `.specify/bugs/**`

**Decision**: one watcher registered next to the living-specs watcher, debounced, refreshing the Specs tree on any change and the open bug panel on change and create; a deleted folder marks the open panel gone.
**Rationale**: no current watcher covers `.specify/bugs`; the spec-directory globs come from `speckit.specDirectories` and the `.specify/**` watcher only refreshes Steering.

## Identifiers

**Decision**: tree context values `bug-group`, `bug-report`, `bug-report-doc` and `bug-report-doc-missing`; ids `bug-group` and `bug:<slug>` (stable, unaffected by Expand All); a click runs `speckit.viewSpecDocument` with `[<absolute report path>, { bug: true }]`; document types `assessment`, `fix`, `test` labelled Assessment, Fix, Test; panel title `Bug: <title>`; stories under the title `VS Code Extension/Spec Viewer/Bug report` (`All reports`, `Assessment only`) and a `B6 · Bug reports` story under `VS Code Extension/Sidebar`.
**Rationale**: none of these values starts with `spec-`, so no existing `viewItem` regex in the manifest matches a bug row, and bug rows never reach the lifecycle multi-select keys. Reusing `viewSpecDocument` with an option mirrors `{ living: true }` and needs no new contributed command.

## No telemetry event

**Decision**: opening a bug sends no event in this slice.
**Rationale**: adding an event means a new catalog entry and funnel decision; that belongs with the dispatch slice that makes bugs actionable.
