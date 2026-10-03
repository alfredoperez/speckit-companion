# Changelog — SpecKit Companion for Claude Code

Changes to the **Claude Code mod** are listed here. It is versioned on its own in `.claude-plugin/plugin.json`; the VS Code extension's changelog is at the repo root: [`../../CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

## [0.1.0]

First version. Tested on Claude Code 2.1.287.

### Added
- **A band above the prompt** with the spec you are following and where its run stands, such as `Plan done · Tasks 7/12 · Implement running`.
- **A pane beside the transcript** with the spec's title and status, the four steps with the time each took, the total active time, and the task list by phase.
- **`/spec`** to choose which spec the band and pane follow. Bare `/spec` lists the recent specs; `/spec 42` or `/spec export-csv` follows one.
- **A text answer where nothing is drawn**, such as `claude -p` and the VS Code chat panel.
- The mod only reads the run record. It never writes a spec file or sends a prompt.
