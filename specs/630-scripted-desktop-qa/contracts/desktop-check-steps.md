# Contract: the new steps in `tooling/scripts/desktop-check.mjs`

**Feature**: 630 Scripted desktop QA | **File**: `tooling/scripts/desktop-check.mjs`

Every step below is one `await step(id, what, run, { needs: 'fixtures', check: true })` call, so it lands in `results.<theme>.json` as `{ name, what, ok, note, shot }` and the grader can name it. A step's note is what it returns; a step fails by throwing, and the first line of the error becomes the note. Each step takes its own screenshot. No step switches the theme: a run keeps the theme it was started with.

## One window, and the order

There is one window: the one the script already opens on its throwaway project with `speckit.aiProvider: claude`. Every new step runs in it. The script opens no window with workspace trust on, no stock project and no two-roots workspace; those checks are on the Claude Desktop handoff. `provider-picker` is unchanged: a capture-only step in a window of its own, run under `--shots` alone and never graded.

The new steps run after every existing step from `sidebar-panes` through the screenshot steps, and before `specs-pane`, `first-spec` and the `doc-*` loop. Their order is the order of the tables below: narrow panel, builder, the Links and empty-record steps, the matrix rows N1 to N15, then the dispatch and the provider-changed popup last. `specs-pane`, `first-spec` and the `doc-*` loop read the project as the matrix left it, which is fine: they assert only that the pane lists rows and that the first spec and its tabs render.

Just before `narrow-panel-spec`, `addDemoSpecs(project)` adds the fixtures the new steps need: the four repo demo specs `_00_demo-specified`, `_01_demo-planned`, `_02_demo-tasked`, `_03_demo-living`, plus `_04_demo-related-docs` (from `_02` with research.md, data-model.md and a checklist), `_05_demo-archived` (from `_03` with status archived), `_06_empty-record` (from `_01` with its record emptied) and `_07_links-demo` (from `_02` with a Links section in its spec, a far heading, and `src/App.tsx` to link to). Earlier steps and docs pictures therefore see the project they always did. Nothing is added under `--sandbox`, `--shots` or `--record`. The project is rebuilt per run, so no reset step exists.

The throwaway profile sets `terminal.integrated.confirmOnKill` and `terminal.integrated.confirmOnExit` to `never`, so closing a terminal a step opened never raises a dialog.

## Narrow panel and builder

The viewer and the builder are narrowed by dragging the side bar out until the editor column is about the stated width. The editor is never split.

| Id | Fixture it reads | The one assertion |
|---|---|---|
| `narrow-panel-spec` | `_02_demo-tasked`, Specification | With the Bugs and Ideas panes collapsed and the editor about 430px wide, the header, the rail and the footer sit inside the column: none runs past the window's edge, none that cannot scroll is wider than its box, no button is cut by its container, and the page does not scroll sideways. The note gives the column width, and names any strip that scrolls sideways by design (the rail) without failing. |
| `narrow-panel-tasks` | `_02_demo-tasked`, Tasks | The same assertion on Tasks. The step then puts the side bar back to its starting width, so the next step gets a full-width editor. |
| `builder-phase-menu` | the project's workflow as the Workflow Builder loads it | Open Workflow Builder shows the board, and clicking a phase's add button opens a menu with at least one entry; Escape closes it. The note counts the entries. Nothing is saved. |
| `builder-add-step` | the builder as left by the previous step | Add step opens the new-step form, and Cancel closes it with the same number of steps on the board as before. The step adds nothing. |
| `builder-narrow` | the builder | With the editor about 330px wide, the builder body stacks in one column, the step heads are sticky, and the board does not scroll sideways. The note gives the width. |
| `builder-move-to-phase` | a free node on the board at that width | Clicking a node that offers Move to phase… opens a list that sits fully inside the panel; picking a phase moves the node and the status line reads `<node> moved to <phase> in <step>`. A phase that refuses the node is followed by the next one. The step then restores the side bar and closes the builder without saving. |

## The Links section and the empty record

| Id | Fixture it reads | The one assertion |
|---|---|---|
| `nav-links` | `_07_links-demo`, Specification, its Links section | Approach opens Plan with the Approach heading rendered; Tasks opens Tasks; Far heading scrolls that heading into view; Other spec opens `_01_demo-planned` in the SpecKit viewer; Source file opens App.tsx in an editor beside the viewer, and a second click reuses that editor instead of adding a split or a second tab. The Web link is read, not clicked: the step asserts its href is the site URL, so no browser leaves the window. |
| `nav-empty-record` | `_06_empty-record` | Opening it lands on a document, and the editor tab title ends in `- Specification`, never `Overview`. |

## The navigation matrix

One step per recipe row, in the recipe's order.

| Id | Fixture it reads | The one assertion (the recipe's expected state) |
|---|---|---|
| `nav-n1` | the Active, Completed and Archived groups | `_05_demo-archived` is only under Archived, `_03_demo-living` is under Completed, and `_00`, `_01`, `_02`, `_04` are under Active. |
| `nav-n2` | `_00` to `_05`, then `_06_empty-record` | Clicking each spec name opens that spec (the header name matches the row) on its Overview; the empty record lands on a document, not on an Overview it cannot show. |
| `nav-n3` | `_02_demo-tasked` expanded in the sidebar | Clicking Specification, Plan, Tasks in turn switches the same viewer tab to that document; the tab count stays one. |
| `nav-n4` | `_04_demo-related-docs`: Research, Data Model, Requirements | Each related doc opens inside `_04`'s one tab, and the rail highlights it. |
| `nav-n5` | `_01_demo-planned` Plan, `_02_demo-tasked` Tasks, then `_01`'s name | Two editor tabs, one per spec, and the last click lands on `_01`'s Overview, not its Plan. |
| `nav-n6` | `_00`, `_01`, `_02`, `_04` clicked within about two seconds | The focused tab ends on `_04` and shows `_04`'s content, with no content from a previous spec under `_04`'s header. |
| `nav-n7` | `_02_demo-tasked`, every enabled rail entry and back to Overview | Only the document changes; the status badge and the footer step read the same before and after. |
| `nav-n8` | `_00_demo-specified`, which has no plan.md | The Plan rail entry is disabled or absent; clicking it changes no document and opens no tab. The note quotes its tooltip. |
| `nav-n9` | `_01_demo-planned/plan.md` with Plan showing | Appending a line to the file on disk re-renders the viewer in place with that line, in the same tab and on the same document. |
| `nav-n10` | `_02_demo-tasked/tasks.md` copied to `_01_demo-planned/tasks.md` with `_01` Specification showing | The rail gains Tasks and the sidebar shows it under `_01` without a manual refresh. |
| `nav-n11` | `_04_demo-related-docs/research.md` deleted while it is showing | The viewer says the document was moved or deleted and shows no stale content. |
| `nav-n12` | `_02_demo-tasked` renamed to `_02_demo-renamed` on disk with `_02` open | The old tab says the spec moved, and clicking the sidebar row opens the renamed spec, not a stale panel. |
| `nav-n13` | `_04_demo-related-docs`, `"status": "completed"` written to its `.spec-context.json` | The spec moves to Completed in the sidebar, the open tab's badge reads Completed, and clicking it again reuses the same tab. |
| `nav-n14` | `_01_demo-planned` Plan: close the viewer tab, click the same sidebar document | The viewer opens fresh on Plan. |
| `nav-n15` | the Specs view title bar's sort and filter buttons, then `_01_demo-planned` | After a sort by name, and again after a filter, the clicked spec opens. The step clears the filter. |

## Dispatch and the provider popup

These run last among the new steps.

| Id | Fixture it reads | The one assertion |
|---|---|---|
| `provider-dispatch` | `_00_demo-specified`, untouched by the matrix rows | The footer offers Next: Plan, and clicking its Plan button puts a `/speckit-plan` command in the stand-in terminal; the note quotes the command. The existing `bug-next-step` and `converge-sends` steps dispatch too, and the `provider-dispatch` check names all three. |
| `popup-provider-changed` | the throwaway profile's `User/settings.json` | Writing `speckit.aiProvider` to another provider raises the "AI provider changed" message exactly once, with a Reload Now button. The step dismisses it without reloading, restores the setting, and clears the notifications the restore raises. |

## Steps the scripted checks name that already existed

`process-panes` names `sidebar-panes`, `bug-story`, `bug-report-tab`, `idea-decision`, `idea-assessing` and `new-bug`. `popups` names `create-issues-confirm` and `create-issues-cancel` beside the new `popup-provider-changed`. `provider-dispatch` names `bug-next-step` and `converge-sends` beside the new `provider-dispatch`. `themes` names `sidebar-panes` and `first-spec` beside `narrow-panel-spec`, `narrow-panel-tasks` and `nav-n7`, graded from both themes' results.

## What every new step keeps

- It runs in the main window. No step launches or closes a window.
- It leaves the window as the next step expects it: the side bar back at its width, the builder closed, the filter cleared, the setting restored.
- It returns a one-line note, never a dump: a count, a width, a name, or the command that reached the terminal.
- It reads no folder of the repo's own `specs/` in place; the fixtures are copied and derived into the throwaway project, which is removed when the run ends.
- It is left out of a `--shots` or `--record` run and skipped under `--sandbox`, where the grader reads it as BLOCKED.
