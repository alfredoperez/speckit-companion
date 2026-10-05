# Changelog — SpecKit Companion for Claude Code

Changes to the **Claude Code mod** are listed here. It is versioned on its own in `.claude-plugin/plugin.json`; the VS Code extension's changelog is at the repo root: [`../../CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

### Added
- **A useful pane without a run record.** In a stock Spec Kit project the pane used to show `No record`, four step names and the task list. It now works from the spec folder's files: each step says when its document was written and how long after the one before, Implement counts the ticked tasks and when the last one changed, and a line under the title says what is happening now, such as `Writing the plan` or `Implementing: T004 next`. A new Documents block lists every file with what it holds (stories, requirements, open questions, files named, tasks by phase, checklist progress) and opens it when pressed. The Overview tab shows the feature's description, user stories, open questions, requirements, success criteria and plan summary, and the Run tab ends with the command for the next step. The band reads the same way, such as `Plan written 4m ago · Tasks next`. A run that has a record gets the Documents block and the next command too.
- **Open a step's document.** On the Run tab each of the four steps is now a control: press one to read its spec, plan or task file inside the pane, rendered as markdown, with `b` to go back to the step you came from. The document refreshes while the agent writes it, Implement lists what each finished task did when the record has it, and a step whose file is not written yet says so.
- **An Overview tab.** It shows what the run record says about the change: intent, approach, size and workflow, what is out of scope, the decisions and the reason for each, what was verified and how each check came out, the open concerns, and how many requirements are covered by tests. The tabs are now `1: Run`, `2: Overview` and `3: Specs`.

### Changed
- **The command is now `/speckit-tracker`.** It takes the same arguments as before, and `/spec` still works as a shorter name for it.
- **Colour, used sparingly.** The running step and the word `running` use your theme's warning colour, in the pane and in the band; a finished step is green, a failed check is red and says `failed`, section titles are bold, and secondary facts are dim. The spec's title and status now stay at the top of every tab.
- **A step done in the same pass as Specify reads `with Specify`.** When a small change is specified, planned and tasked at once, Plan and Tasks used to show an empty time, and the run showed a timing coverage count in place of its total. They now say where their time went, and the total is shown.

### Fixed
- **The mod starts in a session that was already open.** Installing the mod and running `/reload-plugins` loaded it without starting it, so there was no band, no pane and no `/spec` until Claude Code was restarted. It now starts on its own the first time it is needed.
- **A spec created during the session is followed.** In a project with no specs when Claude Code started, the band and the pane stayed empty through the whole first run. The mod now notices a new spec folder as soon as the agent creates it.

## [0.1.0]

First version. Tested on Claude Code 2.1.287.

### Added
- **A band above the prompt** with the spec you are following and where its run stands, such as `Plan done · Tasks 7/12 · Implement running`.
- **A pane beside the transcript** with the spec's title and status, the four steps with the time each took, the total active time, and the task list by phase.
- **`/spec`** to choose which spec the band and pane follow. Bare `/spec` lists the recent specs; `/spec 42` or `/spec export-csv` follows one.
- **A text answer where nothing is drawn**, such as `claude -p` and the VS Code chat panel.
- The mod only reads the run record. It never writes a spec file or sends a prompt.
