# Implementation Plan: Bug reports in the sidebar and viewer (read-only)

**Branch**: `feat/785-bug-reports-read-only` | **Spec**: [bug-reports-read-only.spec.md](./bug-reports-read-only.spec.md) | **Issue**: #785 (first slice)

## Summary

Spec Kit's `bug` extension leaves `assessment.md`, `fix.md` and `test.md` under `.specify/bugs/<slug>/`. A new pure reader turns that folder into a list of bug reports, each with its title, which reports exist, and the Verdict, Severity, Status and Result read from the bold-label header lines. The Specs tree shows them in a **Bugs** group after Active, Completed and Archived, and a click opens the bug in the spec viewer in a new read-only bug mode: the three reports are the rail's entries, and there is no footer, no run strip, no Overview, no comment affordance, and no run record read or written. A dedicated watcher on `.specify/bugs/**` refreshes the tree and an open bug panel.

**Where bugs sit, and why.** A group inside the Specs view, not a new view. The Specs view is where work items live and already speaks in groups, so a fourth group reads as "another kind of work here" without a new container entry. A new view would change the container's fixed view list and its toolbar contract in `open-the-sidebar`, and would need its own welcome and visibility setting for a slice that is read-only. Bugs stay out of the lifecycle groups because they have no number and no lifecycle, so they would break the Number and Workflow Step sorts and the lifecycle menus. The Specs filter applies to bugs too: otherwise a filter matching no spec would still leave the Bugs group on screen and hide the "No specs match" clear offer.

## Project Structure

```text
apps/vscode/src/
├── features/bugs/
│   ├── bugReports.ts                  # new: scan .specify/bugs, parse headers, build viewer documents
│   └── __tests__/bugReports.test.ts   # new: BDD tests against the real fixtures
├── features/specs/
│   ├── specExplorerProvider.ts        # Bugs group, bug rows, report rows; root no longer empty when only bugs exist
│   └── __tests__/specExplorerProvider.test.ts  # Bugs group cases (mocked fs, like the rest of the file)
├── features/spec-viewer/
│   ├── specViewerCommands.ts          # viewSpecDocument accepts { bug: true }
│   ├── specViewerProvider.ts          # showBug, updateBugContent, routing in update/refresh paths
│   ├── messageHandlers.ts             # bug panels accept only read messages
│   ├── html/generator.ts              # readOnly flag onto <body data-read-only>
│   └── __tests__/bugPanel.test.ts     # new: bug panel opens with three documents, never writes
├── protocol/viewer.ts                 # SpecViewerState.bug
└── extension.ts                       # .specify/bugs/** watcher next to the living-specs one
apps/vscode/webview/
├── src/spec-viewer/editor/readOnly.ts # also true for data-read-only
├── styles/spec-viewer/_line-actions.css  # hide line add buttons when data-read-only
└── src/spec-viewer/__stories__/BugReport.stories.tsx   # new: all reports, assessment only
apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx  # new B6 story with a Bugs group
apps/vscode/tests/fixtures/bug-reports/.specify/bugs/   # real reports from a real run (already added)
package.json                           # no new commands or menus; bug contextValues match no spec menu
capabilities/sidebar/browse-specs.spec.md
capabilities/spec-viewer/read-a-spec.spec.md
apps/website/src/content/docs/docs/anatomy/the-sidebar.mdx
apps/website/src/content/docs/docs/anatomy/anatomy-of-the-spec-viewer.mdx
CHANGELOG.md
```

**Structure Decision**: one new `features/bugs/` module owns everything about the folder format, so the tree and the viewer read one derivation and cannot disagree about which reports exist or what the outcome is.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. Nothing provider-specific; no new setting needed for a read-only list that shows only when reports exist. |
| II. Spec-Driven Workflow | PASS. Specs, their pipeline and lifecycle are untouched; bugs are a separate group and never enter Active/Completed/Archived. |
| III. Visual and Interactive | PASS. The feature is the visual surface for a CLI-only flow. |
| IV. Modular Architecture | PASS. Folder parsing lives in its own module; the viewer reuses its existing provider/handler/generator split. |
| User Interface: webview reserved for core workflow documents | Justified. Bug reports are Spec Kit workflow documents written by Spec Kit commands, and the issue asks for them in the viewer. They open read-only with no workflow chrome, the same exception living specs already use. |
| User Interface: canonical lifecycle grouping | PASS. Lifecycle groups are unchanged; the Bugs group carries no lifecycle badge. |

## Phase 0 and Phase 1

See [research.md](./research.md) for the decisions, [data-model.md](./data-model.md) for the bug report shape, and [contracts/ui-contract.md](./contracts/ui-contract.md) for the context values, command arguments and story ids that tests code against.
