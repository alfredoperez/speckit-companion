# Artifact gallery fixtures

One real file from every Spec Kit command, used by the `Artifact gallery` stories. Nothing here is hand-written except where this note says so. Do not edit a file to make a story look better: re-run the command and copy the output again.

## tiny-todo/ (real run)

Output of one headless run of Spec Kit 1.0.10.dev0 on a 42-line browser todo app, feature "add a dark mode toggle", on 2026-10-03. Each command ran once through `claude -p "/speckit-<command> ..."` with the bundled `bug` and `assess` extensions installed.

| Path | Written by |
|------|------------|
| `.specify/memory/constitution.md` | `/speckit-constitution` |
| `specs/001-dark-mode-toggle/spec.md` | `/speckit-specify`, then `/speckit-clarify` added the Clarifications section |
| `specs/001-dark-mode-toggle/checklists/requirements.md` | `/speckit-specify` |
| `specs/001-dark-mode-toggle/checklists/ux.md` | `/speckit-checklist` |
| `specs/001-dark-mode-toggle/plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` | `/speckit-plan` |
| `specs/001-dark-mode-toggle/tasks.md` | `/speckit-tasks`, then `/speckit-implement` checked off the first three phases |
| `printed/analyze.md` | `/speckit-analyze`. The command writes no file. This is what it printed. |
| `printed/converge.md` | `/speckit-converge`. This is what it printed. It appends to `tasks.md` only when a gap has no task yet, and in this run every gap already had one. |
| `.specify/assessments/shared-lists/` | `/speckit-assess-intake`, `-research`, `-define`, `-shape`, `-decide`, on the idea "let two people share one todo list" |

## template-filled/ (not a real run)

`taskstoissues.md` is generated, not captured. `/speckit-taskstoissues` writes no file: it creates GitHub issues through the GitHub MCP server and stops when the project has no GitHub remote, so there was nothing to capture without filing real issues. The list is built from the real `tasks.md` above using the title rule the command states (`T001: <description>`). It carries no issue numbers because none exist.

## Bug reports

The bug stories read the existing fixtures in `apps/vscode/tests/fixtures/bug-reports/`, which are a real run of `/speckit-bug-assess`, `-fix` and `-test`.
