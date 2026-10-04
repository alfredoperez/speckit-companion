# Data Model: Bugs and Ideas panes

Nothing here is stored. Every entity is read from files on disk each time a pane refreshes, and nothing writes to a bug, an idea or a run record.

## ReportSet

The descriptor one reader uses for both processes. It also carries a label per kind, a panel prefix and a fallback badge for the viewer.

| Field | Bugs | Ideas |
|---|---|---|
| id | `bugs` | `ideas` |
| directory | `.specify/bugs/` | `.specify/assessments/` |
| kinds, in order | `assessment`, `fix`, `test` | `intake`, `research`, `problem`, `concept`, `decision` |
| title prefixes | as today | `Idea Intake:`, `Idea Research:`, `Problem Definition:`, `Concept:`, `Decision:` |
| extension id and folder | `bug`, `.specify/extensions/bug/` | `assess`, `.specify/extensions/assess/` |

Rule: path helpers match on the directory, never on a kind name, because the bug kind `assessment` and the ideas directory `assessments` would collide.

## Report item (Bug or Idea)

One folder under a set's directory.

- `slug`: the folder name. Used as the name when no title can be read.
- `title`: the first report's heading with the set's title prefix removed.
- `reports`: one Report per kind, in the set's order. A bug has three, an idea has five.
- `state`: derived from the tables below. Never stored.

A Report has a `kind`, a `path` (`<directory>/<slug>/<kind>.md`) and `exists`. A missing report reads "not created" and cannot be opened. One that exists opens read-only in the viewer with `{ report: 'bugs' | 'ideas' }`; the older `{ bug: true }` means the same as `{ report: 'bugs' }`.

Rules: a folder with no recognised file is not listed. An item whose files cannot be read is still listed, named by its slug, with no detail on its row. Every item belongs to exactly one group.

## Allow-listed fields

A value shown on a row must be in its list. Matching is case-insensitive. Anything else is shown as nothing, never as text from the file.

| Field | Read from | Known values |
|---|---|---|
| bug verdict | `assessment` | `valid`, `likely valid, needs reproduction`, `invalid` |
| severity | `assessment` | `critical`, `high`, `medium`, `low` |
| fix status | `fix` | `applied`, `partial`, `not-applied` |
| test result | `test` | `verified`, `partial`, `failed` |
| idea verdict | `decision` | `go`, `needs-clarification`, `kill` |

## Bug state

The first matching rule wins. Groups are shown in the order To fix, To test, Verified, Closed, and an empty group is hidden.

| # | Condition | Group |
|---|---|---|
| 1 | verdict is `invalid` | Closed |
| 2 | a test exists and its result is `verified` | Verified |
| 3 | a test exists with any other result | To fix |
| 4 | a fix exists and its status is `applied` or `partial` | To test |
| 5 | a fix exists and its status is `not-applied` | To fix |
| 6 | anything else | To fix |

The row's secondary text is the severity and the latest outcome. Under rule 3 the row says the test failed. Transitions follow the files: assessment only (To fix), fix written (To test), test `verified` (Verified), test `failed` or `partial` (back to To fix). An `invalid` verdict closes the bug at any point.

## Idea state

| # | Condition | Group | Row text |
|---|---|---|---|
| 1 | `decision.md` exists | Decided | the verdict if it is `go`, `needs-clarification` or `kill`, otherwise nothing |
| 2 | anything else | Assessing | the last stage present, in the order `intake`, `research`, `problem`, `concept` |

The three verdicts are visually distinct. An idea moves from Assessing to Decided once, when the decision file appears.

## Process extension and pane contents

The extension `id` is `bug` or `assess`; no other value is accepted. `installed` is present, absent or unknown, from whether the extension folder exists. Only "not found" is absent, and unknown counts as present. The install command is `specify extension add <id>`, run in a terminal whose working directory is the project folder.

| Items | Extension | Pane shows |
|---|---|---|
| one or more | any | the groups and their items, no install row |
| none | absent | one row: `Install Spec Kit's bug extension` or `Install Spec Kit's assess extension` |
| none | present or unknown | one row saying there are none yet and naming the command that starts one |

Tree rows carry one of the context values `process-group`, `process-item`, `process-report`, `process-report-missing`, `process-install`, `process-empty`. With no workspace open, neither pane is shown.
