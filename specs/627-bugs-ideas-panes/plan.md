# Implementation Plan: Bugs and Ideas panes

**Branch**: `627-bugs-ideas-panes` | **Spec**: [bugs-ideas-panes.spec.md](./bugs-ideas-panes.spec.md)

**Scale note**: About 18 files across the sidebar, the viewer's read-only path, the manifest and the docs. The risky parts are removing bugs from the Specs tree without changing when its welcome shows, and opening an idea through the path that today only knows bugs.

## Summary

Bugs and ideas are both a folder of staged report files, so one small reader describes a "report set" and both use it. One tree provider class, configured twice, draws the two panes: groups derived from the files, a row per item, a child row per report, and a single install or empty row when there is nothing to list. An idea opens through the viewer's existing read-only report path, which is generalised from "bug" to "report set". Bugs leave the Specs tree.

## Project Structure

```text
apps/vscode/src/
├── features/reports/reportSet.ts                 # NEW: ReportSet descriptor, read folder(s), path helpers, documents
├── features/bugs/bugReports.ts                   # becomes a thin layer over reportSet; adds bugState and allow-listed fields
├── features/ideas/ideaReports.ts                 # NEW: the idea set, ideaState, allow-listed verdict
├── features/processes/processPaneProvider.ts     # NEW: one tree provider, configured for bugs and for ideas
├── features/processes/processCommands.ts         # NEW: two refresh commands, the install command
├── speckit/processExtensions.ts                  # NEW: installed probe, runSpecifyExtensionAdd
├── features/specs/specExplorerProvider.ts        # bugs removed
├── features/spec-viewer/specViewerProvider.ts    # report panels keyed by set
├── features/spec-viewer/specViewerCommands.ts    # open option accepts a set
├── features/spec-viewer/messageHandlers.ts       # read-only allow-list renamed for reports
├── protocol/viewer.ts                            # panel state names the set
├── core/constants.ts                             # Views.bugs, Views.ideas, command ids
└── extension.ts                                  # register both panes, watchers, root-change refresh
package.json                                      # two views, three commands, view/title menus
apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx   # the bug story shows the pane
README.md, CHANGELOG.md, apps/website/src/content/docs/docs/{navigate/the-sidebar,processes/fix-a-bug,processes/assess-an-idea}.mdx
.claude/skills/release-qa/surface-map.yml
```

**Structure Decision**: The reader is generic and lives in `features/reports`; what a bug or an idea means (its state, its allow-listed fields) stays in its own folder. One provider class in `features/processes` avoids two near-identical trees.

## Identifiers

- Views: `speckit.views.bugs` ("Bugs"), `speckit.views.ideas` ("Ideas"), declared after `speckit.views.explorer`, with the same `when` clause as Living Specs.
- Commands: `speckit.bugs.refresh`, `speckit.ideas.refresh`, `speckit.processes.installExtension` (argument `bug` or `assess`, anything else ignored, hidden from the palette).
- Report sets: bugs in `.specify/bugs/` with `assessment`, `fix`, `test`; ideas in `.specify/assessments/` with `intake`, `research`, `problem`, `concept`, `decision`, title prefixes `Idea Intake:`, `Idea Research:`, `Problem Definition:`, `Concept:`, `Decision:`.
- Known values, from Spec Kit's own command files: bug verdict `valid`, `likely valid, needs reproduction`, `invalid`; severity `critical`, `high`, `medium`, `low`; fix status `applied`, `partial`, `not-applied`; test result `verified`, `partial`, `failed`; idea verdict `go`, `needs-clarification`, `kill`.
- Bug state: verdict `invalid` → Closed. Else a test result of `verified` → Verified; any other test → To fix. Else a fix with status `applied` or `partial` → To test; `not-applied` → To fix. Else To fix.
- Idea state: a `decision.md` → Decided; else Assessing, and the row names the last stage present.
- Extension ids and folders: `.specify/extensions/bug/`, `.specify/extensions/assess/`.
- Tree context values: `process-group`, `process-item`, `process-report`, `process-report-missing`, `process-install`, `process-empty`.
- Viewer open option: `{ report: 'bugs' | 'ideas' }`; the existing `{ bug: true }` keeps working.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. A third process is one more report-set config, not new code paths. |
| II. Spec-Driven Workflow | PASS. Read-only; nothing writes to a bug, an idea or a run record. |
| III. Visual and Interactive | PASS. Two native tree views and the existing viewer. |
| IV. Modular Architecture for Complex Features | PASS. Reader, meaning and tree are separate modules. |
