# Data Model: Bug reports in the sidebar and viewer (read-only)

Everything here is derived from files Spec Kit's `bug` extension writes. Nothing is persisted by the extension: no run record, no cache file, no change under `.specify/bugs/` (FR-007). One module, `features/bugs/bugReports.ts`, owns the derivation so the tree and the viewer cannot disagree.

## Source on disk

```text
<workspace>/.specify/bugs/
└── <slug>/
    ├── assessment.md   # "# Bug Assessment: <title>", - **Verdict**, - **Severity**
    ├── fix.md          # "# Bug Fix: <title>",        - **Status**
    └── test.md         # "# Bug Verification: <title>", - **Result**
```

No front matter. Outcome values live in `- **Label**: value` bullets near the top of each file. Other bullets (`Slug`, `Created`, `Fixed`, `Tested`, `Source`, `Assessment`, `Fix`) are ignored in this slice.

## Entities

### BugReport

One folder under `.specify/bugs/` that holds at least one report file.

| Field | Type | Source | Notes |
|---|---|---|---|
| `slug` | `string` | folder name | Identity. Validated to resolve inside `.specify/bugs/` (FR-009). |
| `directory` | `string` | absolute folder path | Used as the viewer panel key. |
| `title` | `string` | first existing report's `# Bug Assessment:` / `# Bug Fix:` / `# Bug Verification:` heading, in assessment → fix → test order | Falls back to `slug` when no heading matches. |
| `reports` | `Record<BugReportKind, BugReportFile>` | file presence | Always all three keys; `exists` says which are on disk. |
| `verdict` | `string \| undefined` | `assessment.md` `**Verdict**` | Absent when the file or line is missing or empty. |
| `severity` | `string \| undefined` | `assessment.md` `**Severity**` | Shown with the verdict; not part of the outcome precedence. |
| `fixStatus` | `string \| undefined` | `fix.md` `**Status**` | |
| `testResult` | `string \| undefined` | `test.md` `**Result**` | |
| `outcome` | `string \| undefined` | derived | `testResult ?? fixStatus ?? verdict` (FR-004). |
| `stages` | `BugReportKind[]` | derived | The kinds whose file exists, in assess, fix, test order. |

**Relationships**: a BugReport owns exactly three BugReportFile slots. A BugReport belongs to no spec and has no number, lifecycle status or `.spec-context.json`.

**Validation rules**

- A folder with none of `assessment.md`, `fix.md`, `test.md` is not a BugReport (FR-001, edge case "only other files").
- A folder name containing a path separator, `..`, or resolving outside `.specify/bugs/` is skipped before any read (FR-009).
- Values are read as written, trimmed. An unexpected value (e.g. `Verdict: maybe`) is kept and shown as text; a missing or blank line leaves the field absent, and the bug still lists and opens (edge case "missing outcome line").
- Header parsing reads only the leading bullet block, so a `**Status**` in the body is never mistaken for the fix status.

### BugReportFile (Report)

One of the three report slots of a bug.

| Field | Type | Notes |
|---|---|---|
| `kind` | `BugReportKind` = `'assessment' \| 'fix' \| 'test'` | Also the viewer document type. |
| `label` | `'Assessment' \| 'Fix' \| 'Test'` | Tree row and rail label. |
| `fileName` | `'assessment.md' \| 'fix.md' \| 'test.md'` | Fixed per kind. |
| `path` | `string` | Absolute path, whether or not the file exists. |
| `exists` | `boolean` | A missing slot reads "not created" and does nothing on click (FR-005). |

Header values seen in the real fixture run (the reader does not restrict them; any value is shown as written):

| Kind | Label line | Fixture values |
|---|---|---|
| assessment | `**Verdict**` | `valid` |
| assessment | `**Severity**` | `high`, `medium` |
| fix | `**Status**` | `applied` |
| test | `**Result**` | `verified` |

### Bug tree items (Specs view)

Shown in a **Bugs** group after Active, Completed and Archived, only when at least one BugReport survives the filter (FR-003).

| Item | `id` | `contextValue` | Label / description | Click |
|---|---|---|---|---|
| Bugs group | `bug-group` | `bug-group` | `Bugs (<n>)` | expands; starts collapsed |
| Bug entry | `bug:<slug>` | `bug-report` | `title`; description says the present stages in words and the `outcome` | `speckit.viewSpecDocument` with `[<first existing report path>, { bug: true }]` |
| Report row (exists) | `bug:<slug>:<kind>` | `bug-report-doc` | `Assessment` / `Fix` / `Test` | `speckit.viewSpecDocument` with `[<report path>, { bug: true }]` |
| Report row (missing) | `bug:<slug>:<kind>` | `bug-report-doc-missing` | label, description `not created` | none |

**Rules**

- No context value starts with `spec-`, so no manifest `viewItem` menu and no lifecycle multi-select reaches a bug row.
- Bug entries are ordered by `slug`, ascending; the sort setting never reorders them.
- The Specs filter matches `slug` or `title` with the same fuzzy match used for specs. With a filter that matches no spec and no bug, the root is empty so "No specs match" still shows.
- With bugs and no specs, the root returns only the Bugs group. With neither, the root is empty and today's welcome shows (SC-002).

### Viewer panel state (extension of `SpecViewerState`)

| Field | Type | Notes |
|---|---|---|
| `bug` | `boolean \| undefined` | Bug mode. Routed beside `living` in every update and refresh path. |
| `specDirectory` | `string` | The absolute `.specify/bugs/<slug>` folder; the panel key, so one viewer tab per bug (FR-006). |
| `specName` | `string` | `title`; the panel title is `Bug: <title>`. |
| `currentDocument` | `BugReportKind` | The report on screen. |

The panel's document list is the three BugReportFiles, in assessment, fix, test order, each with `exists`. The rail's existing disabled state covers missing reports. The header title is the bug's `title` and the badge is its `outcome`, or `BUG` when there is none.

**Read-only rules (FR-007)**

- The panel never reads or writes `.spec-context.json` and never backfills one.
- The extension accepts only read messages from a bug panel: ready, switch document, rail click, refresh, open file, open source, webview error. Every other message is dropped with one log line.
- The page carries `data-read-only`; `isReadOnly()`, the checkbox toggle and the line-action CSS honour it.
- No step footer, run strip, Overview or comment affordance is rendered.

## State transitions

### A bug's stage, as observed on disk

The extension never moves a bug; it only reflects what the `bug` commands have written. The usual progression, and the outcome shown at each point:

```text
(no folder)
   │ speckit.bug.assess writes assessment.md
   ▼
assessed ──────────── outcome = verdict          e.g. "valid"
   │ speckit.bug.fix writes fix.md
   ▼
fixed ─────────────── outcome = fix status       e.g. "applied"
   │ speckit.bug.test writes test.md
   ▼
tested ────────────── outcome = test result      e.g. "verified"
```

Any subset of files is legal (a hand-deleted assessment, a fix without a test). `stages` and `outcome` are recomputed from whatever exists, so out-of-order sets still list and open.

### Tree and panel on file events (FR-008)

A debounced watcher on `.specify/bugs/**` drives these:

| Event | Specs tree | Open bug panel |
|---|---|---|
| Report created in a bug folder | entry appears or gains the stage | rail entry becomes openable |
| Report changed | outcome text updates | shows the new text if it is the report on screen |
| Report deleted | stage removed; entry removed when no report remains | rail entry turns "not created" |
| Bug folder deleted | entry removed; Bugs group removed when it was the last | panel says the folder is gone, like a moved spec |
| First bug appears in a workspace with none | Bugs group appears | n/a |
