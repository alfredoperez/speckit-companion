# UI Contract: Bugs and Ideas panes

The feature exposes no API or CLI. Its interface is two sidebar views, three commands, the tree rows, and one viewer open option. Tests and consumers code against the identifiers below.

## Views

| View id | Title | Reads | Extension folder |
|---|---|---|---|
| `speckit.views.bugs` | `Bugs` | `.specify/bugs/` | `.specify/extensions/bug/` |
| `speckit.views.ideas` | `Ideas` | `.specify/assessments/` | `.specify/extensions/assess/` |

Both are declared after `speckit.views.explorer` and before Living Specs. Both use the same `when` clause as Living Specs, so neither shows when no workspace is open. Neither has a visibility setting. The Specs view no longer lists bugs.

## Commands

| Command id | Where | Argument | Effect |
|---|---|---|---|
| `speckit.bugs.refresh` | Bugs title bar | none | Re-reads `.specify/bugs/` and redraws the pane. |
| `speckit.ideas.refresh` | Ideas title bar | none | Re-reads `.specify/assessments/` and redraws the pane. |
| `speckit.processes.installExtension` | Install row only, hidden from the palette | `bug` or `assess` | Opens a visible terminal in the project folder and runs the install command. Any other argument is ignored. |

Install commands: `specify extension add bug --force`, `specify extension add assess --force` (forced so a stale registry entry cannot block a reinstall). The project folder is the terminal's working directory. The command never contains a `cd`.

## Tree rows

| Context value | Label | Secondary text | Click runs |
|---|---|---|---|
| `process-group` | Group name | none | Expand or collapse |
| `process-item` | Item title, or the folder name if no file can be read | See below | `speckit.viewSpecDocument` on its first report |
| `process-report` | Report or stage label | none | `speckit.viewSpecDocument` on that file |
| `process-report-missing` | Report or stage label | `not created` | Nothing |
| `process-install` | Install label | none | `speckit.processes.installExtension` |
| `process-empty` | Empty label | none | Nothing |

A group with no items is not shown. A long title truncates with an ellipsis and the tooltip holds the full title. A folder with no recognised file is not listed.

### Bugs pane

Groups, in order: `To fix`, `To test`, `Verified`, `Closed`.

Item children, in order: Assessment (`assessment`), Fix (`fix`), Test (`test`).

Item secondary text: severity and the latest outcome. A failed or partial test reads as a failed test.

Group rule, first match wins:

1. Verdict `invalid` goes to `Closed`.
2. Test result `verified` goes to `Verified`. Any other test result goes to `To fix`.
3. Fix status `applied` or `partial` goes to `To test`. `not-applied` goes to `To fix`.
4. Otherwise `To fix`.

### Ideas pane

Groups, in order: `Assessing`, `Decided`.

Item children, in order: Intake (`intake`), Research (`research`), Problem (`problem`), Concept (`concept`), Decision (`decision`).

Group rule: a `decision.md` goes to `Decided`. Otherwise `Assessing`.

Item secondary text: under `Assessing`, the last stage present, for example `research`. Under `Decided`, the verdict. The three verdicts look distinct from each other.

### Known values

Every value on a row is matched case-insensitively against these lists. Anything else shows as nothing.

- Bug verdict: `valid`, `likely valid, needs reproduction`, `invalid`
- Severity: `critical`, `high`, `medium`, `low`
- Fix status: `applied`, `partial`, `not-applied`
- Test result: `verified`, `partial`, `failed`
- Idea verdict: `go`, `needs-clarification`, `kill`

## Install and empty rows

A pane with no items shows exactly one row.

| Pane | Extension folder absent | Extension folder present |
|---|---|---|
| Bugs | `Install Spec Kit's bug extension` | `No bugs yet. Start one with /speckit.bug.assess.` |
| Ideas | `Install Spec Kit's assess extension` | `No ideas yet. Start one with /speckit.assess.intake.` |

A pane with items on disk lists them and shows neither row, whether or not the extension is installed. A folder that cannot be read counts as present, so no install row is offered.

## Viewer open option

`speckit.viewSpecDocument(filePath, opts)` accepts `{ report: 'bugs' | 'ideas' }`. The existing `{ bug: true }` keeps working and means `{ report: 'bugs' }`. A report panel is read-only for both sets.
