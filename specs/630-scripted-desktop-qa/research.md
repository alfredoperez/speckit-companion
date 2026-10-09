# Research: Scripted desktop QA

## One window per run

**Decision**: every new step runs in the main window the script already opens on its throwaway project. The checks that need a window of their own stay on the Claude Desktop handoff: the first open with workspace trust on, the stock workspace without Companion, and two roots in one window. `provider-picker` stays what it was, a capture-only step that runs under `--shots` alone.

**Rationale**: the owner chose one window per run. One window keeps the run to about four minutes and keeps the script one launch, one project, one results file per theme. The three cut checks each need a different launch (trust on, another project, a workspace file), and the handoff already stages those windows.

**Alternatives considered**: a launch-and-close block per extra window (several more launches per run and a second project variant to keep true to the sandbox recipe).

## Fixtures for the navigation matrix

**Decision**: `addDemoSpecs(project)` copies the four repo demo specs into the throwaway project and derives the rest the way the `vscode-qa` recipe does: `_04_demo-related-docs` from `_02` plus research, data-model and a checklist, `_05_demo-archived` from `_03` with status archived, `_06_empty-record` from `_01` with its record emptied, and `_07_links-demo` from `_02` with a Links section and a source file to link to. It is called only when the new steps start, after every existing step except `specs-pane`, `first-spec` and the `doc-*` loop, and never under `--sandbox`, `--shots` or `--record`. The new steps carry `check: true`, which leaves them out of a screenshot or recording run. Rows N9 to N13 change the project on disk and run in the recipe's order; the project is rebuilt per run, so no reset is needed.

**Rationale**: the matrix names `_00` to `_05`, and the Links and empty-record steps name `_07` and `_06`. Adding them late means every earlier step and every docs picture sees the project it always did.

**Alternatives considered**: building the fixtures into the project from the start (changes the sidebar in every earlier step and picture); committing more demo folders to `specs/` (the baseline fixtures are pinned on purpose, and more folders is more drift).

## Narrowing the viewer

**Decision**: the narrow-panel steps drag the side bar out until the editor column is about 430px, then put it back. The builder steps do the same to about 330px. The check on the viewer is that the header, the rail and the footer sit inside the column, no button is cut by its container, and the page does not scroll sideways. A strip that scrolls sideways on purpose (the rail) is named in the step's note and does not fail it.

**Rationale**: dragging the side bar narrows the one editor without adding editor groups, so the next step gets the same single viewer back.

**Alternatives considered**: splitting the editor (leaves extra groups to close, and the width depends on how many splits fit the window).

## Light and dark side by side

**Decision**: the start-up wipe removes only the current theme's files (`*.<theme>.png`, `results.<theme>.json`), so a dark run after a light run leaves both results in `.desktop-check/`. Light is the full run. Dark is a second invocation limited to the steps the `themes` check names: `--theme dark --only sidebar-panes,narrow-panel-spec,narrow-panel-tasks,nav-n7`. No step switches the theme.

**Rationale**: the grader needs both files to answer the themes check, and only that check reads dark, so a full dark run would double the time for no row.

**Alternatives considered**: a full dark run (four more minutes that no check reads); a `--theme both` flag (a second launch hidden inside one command).

## The `scripted` kind and the grader

**Decision**: a check of kind `scripted` carries `run` (the npm command), `steps` (the step ids that decide it), `what`, and optional `themes: both`. It has no `recipe` key. A new `grade-scripted.py` reads `surface-map.yml` and `.desktop-check/results.<theme>.json` and prints one line per scripted check: PASS when every named step is present with `ok` and not `skipped` in each required theme, FAIL naming the first failed step, BLOCKED when a results file is missing, a step did not run or was skipped, or the check names no steps. `recheck` reruns the whole real-window check and regrades, because steps build on one another.

**Rationale**: this is the canvas harness pattern (fresh run, one PASS/FAIL line per check, a JSON the report reads), applied to results the script already writes.

**Alternatives considered**: making every moved check `kind: auto` with its own `run` (would launch VS Code once per check); grading by hand from the console log (what produced the BLOCKED rows); rechecking with `--only` and one check's steps (a step can depend on the state an earlier one left).

## Which checks move, and which stay

**Decision**: scripted: themes, nav-matrix, narrow-panel, popups, provider-dispatch, builder, and process-panes (its steps already existed). Desktop: first-open, vscode-run, stock-workspace, multi-root, canvas-open, mod-terminal, canvas-new-spec and site-pages. The handoff's former Links, empty-record and Move to phase clicks are steps now (`nav-links`, `nav-empty-record`, `builder-move-to-phase`), so cutting them from the handoff drops nothing. The diff-driven popup grep stays the rule: a changed file whose popup no walked flow raises gets one desktop check of its own.

**Rationale**: of the twelve checks BLOCKED on the 2026-10-06 reports, six need only one window and a stand-in assistant. The other six need a window of their own, a real assistant or the real app: vscode-run, first-open, stock-workspace, multi-root, canvas-open in the real app, and the board stock run in the real app.

## The handoff

**Decision**: four parts. A: first open (Restricted Mode, then Trust, then a spec in the viewer). B: the stock workspace and the two-roots window. C: the timed run through VS Code's buttons. D: the GitHub Copilot app (the canvas opens, New spec sends its command). A terminal question is written as `C<n> QUESTION:` and the pass moves on to part D, because Claude Code answers it from the Mac. `qa-stage.sh` is unchanged and still opens the three QA windows.

**Rationale**: FR-012 and FR-013. About twenty minutes of clicking fits inside the thirty-minute grant, and nothing a script can decide is on it.
