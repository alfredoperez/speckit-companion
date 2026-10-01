# UI Contract: Bug reports in the sidebar and viewer (read-only)

The identifiers tests and consumers code against. Nothing here is a new contributed command, setting or menu.

## Input: the report folder (read only)

| Item | Value |
|---|---|
| Report folder | `.specify/bugs/<slug>/` |
| Report files | `assessment.md`, `fix.md`, `test.md` |
| Title heading | first line of the first existing report: `# Bug Assessment: <title>`, `# Bug Fix: <title>`, `# Bug Verification: <title>`; fallback is `<slug>` |
| Header labels | `**Verdict**`, `**Severity**` (in `assessment.md`), `**Status**` (in `fix.md`), `**Result**` (in `test.md`), each on a `- **Label**: value` line |
| Listed when | the folder holds at least one of the three report files |
| Rejected | a folder name that resolves outside `.specify/bugs/` |

A missing or unreadable label value is absent, never an error. The extension writes nothing under `.specify/bugs/`.

## Sidebar: Specs view tree items

| Row | `id` | `contextValue` | Label | Description / tooltip | Click |
|---|---|---|---|---|---|
| Bugs group | `bug-group` | `bug-group` | `Bugs (<n>)`, like the other groups | tooltip `Bug reports from Spec Kit's bug commands` | expands; starts collapsed |
| Bug | `bug:<slug>` | `bug-report` | parsed title, else `<slug>` | the stages present, in words (assess, fix, test), and the latest outcome: `**Result**`, else `**Status**`, else `**Verdict**` | `speckit.viewSpecDocument` with `[<absolute path of first existing report>, { bug: true }]` |
| Report row (exists) | none required | `bug-report-doc` | `Assessment`, `Fix` or `Test` | none | `speckit.viewSpecDocument` with `[<absolute report path>, { bug: true }]` |
| Report row (missing) | none required | `bug-report-doc-missing` | `Assessment`, `Fix` or `Test` | `not created` | no command |

Rules:

- The Bugs group comes after Active, Completed and Archived, and appears only when at least one bug is discovered.
- With bugs and no specs, the root returns the Bugs group alone; with neither, the root stays empty and the welcome shows as today.
- Bugs never appear inside Active, Completed or Archived and carry no lifecycle badge.
- The Specs filter narrows bugs by slug or title with the same fuzzy match as specs; a filter matching nothing leaves the tree empty.
- The sort setting never reorders bugs; they are ordered by `<slug>`.
- No bug `contextValue` starts with `spec-`, so no existing `viewItem` menu clause matches a bug row.

## Command: `speckit.viewSpecDocument`

```ts
(filePath: string, opts?: { living?: boolean; requirement?: string; bug?: boolean }) => Promise<void>
```

With `bug: true`, `filePath` is a report file inside `.specify/bugs/<slug>/`. One viewer tab per bug: a second call for the same `<slug>` reuses that tab and shows the clicked report.

## Viewer: bug panel

| Item | Value |
|---|---|
| Panel title | `Bug: <title>` |
| State flags | `SpecViewerState.bug` (`true`); the panel key `specDirectory` is the absolute bug folder |
| Document types | `assessment`, `fix`, `test` |
| Rail labels | `Assessment`, `Fix`, `Test` |
| Missing report | rail entry disabled, shown as not created |
| Header title | parsed title |
| Header badge | the latest outcome value, else `BUG` |
| Page attribute | `<body data-read-only>`; `isReadOnly()` returns true |
| Absent chrome | step footer, run strip, Overview, line add/comment buttons, checkbox toggling |
| Run record | `.spec-context.json` is neither read nor written |

Messages accepted from a bug panel (all others dropped with a log line): ready, switch document, rail click, refresh, open file, open source, webview error.

## Refresh

A watcher on `.specify/bugs/**` refreshes the Specs tree on create, change and delete, and the open bug panel on create and change. Deleting the open bug's folder marks the panel gone, like a moved spec.

## Storybook

| Title | Stories |
|---|---|
| `VS Code Extension/Spec Viewer/Bug report` | `All reports`, `Assessment only` |
| `VS Code Extension/Sidebar` | `B6 · Bug reports` |

## Fixtures

`apps/vscode/tests/fixtures/bug-reports/.specify/bugs/`:

| Slug | Reports | Outcome shown |
|---|---|---|
| `cart-total-skips-first` | `assessment.md`, `fix.md`, `test.md` | `verified` |
| `slug-keeps-spaces` | `assessment.md` | `valid` |
