# Changelog — SpecKit Companion for Claude Code

Changes to the **Claude Code mod** are listed here. It is versioned on its own in `.claude-plugin/plugin.json`; the VS Code extension's changelog is at the repo root: [`../../CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

## [0.2.0] - 2026-10-06

### Added
- **A useful pane without a run record.** Stock Spec Kit projects get a pane from the spec's files: step times, ticked tasks, a Documents list and the next command.
- **Open a step's document.** On the Run tab, press a step to read its spec, plan or tasks inside the pane, and `b` to go back.
- **Open a file in your editor.** Press `o` on a step or document to open its file in your editor, and each readable row says `↵ read`.
- **An Overview tab.** Read the run's intent, approach, decisions, checks and open concerns on tab `2: Overview`, between `1: Run` and `3: Specs`.

### Changed
- **A colourful pane and band.** Coloured section headings, a task progress bar, a state dot in the band, and key hints at the pane's foot.
- **Install from the SpecKit Companion site.** Add the mod with `claude plugin marketplace add https://speckit-companion.dev/plugins/marketplace.json`; an existing install keeps working.
- **The command is `/speckit-tracker`.** It takes the same arguments, and `/spec` still works as a shorter name.
- **Colour, used sparingly.** The running step takes your theme's warning colour, finished is green, failed is red, and the spec's title stays atop every tab.
- **Steps done alongside Specify say `with Specify`.** Plan and Tasks say where their time went instead of showing an empty time, and the run shows its total.

### Fixed
- **A record behind the files follows the files.** Without Companion's recorder, a written document finishes its step even when the run record stopped earlier.
- **A copied template is not a finished step.** An empty file, an untouched Spec Kit template or a task list with no task leaves its step open.
- **The activity line stops when the turn does.** After a turn ends the pane reads `Plan written · Tasks next` or `Implement stopped at 9 of 10 · T010 left`, never `Writing the plan`.
- **The mod starts in a session already open.** After installing and running `/reload-plugins`, the band, pane and `/spec` start on first use, no restart of Claude Code needed.
- **Back keeps the focus.** After `b` closes a document, focus lands on the step you opened, so Enter and the arrow keys carry on from there.
- **The pane opens for a session's first spec.** When the first spec appears, the pane opens by itself, once, if the terminal is wide enough to hold it.
- **A spec created during the session is followed.** The band and pane pick up a new spec folder as soon as your agent creates it.

## [0.1.0]

First version. Tested on Claude Code 2.1.287.

### Added
- **A band above the prompt** with the spec you are following and where its run stands, such as `Plan done · Tasks 7/12 · Implement running`.
- **A pane beside the transcript** with the spec's title and status, the four steps with the time each took, the total active time, and the task list by phase.
- **`/spec`** to choose which spec the band and pane follow. Bare `/spec` lists the recent specs; `/spec 42` or `/spec export-csv` follows one.
- **A text answer where nothing is drawn**, such as `claude -p` and the VS Code chat panel.
- The mod only reads the run record. It never writes a spec file or sends a prompt.
