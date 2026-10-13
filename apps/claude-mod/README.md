# SpecKit Companion for Claude Code

Follow a [Spec Kit](https://github.com/github/spec-kit) run without leaving Claude Code. This [mod](https://code.claude.com/docs/en/plugins/mods/overview) adds a band above the prompt that says where the run stands, and a pane beside the transcript with the steps, their times, the documents and the tasks as they're ticked. It works with stock Spec Kit and with [SpecKit Companion](https://speckit-companion.dev).

![A Claude Code terminal with the mod's pane beside the transcript on its Run tab: Specify, Plan and Tasks ticked with their times, Implement running, the documents, and three of six tasks ticked. The band above the prompt names the spec and reads Plan done, Tasks 3/6, Implement running.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-window.png)

## Install

```bash
claude plugin marketplace add https://speckit-companion.dev/plugins/marketplace.json
claude plugin install speckit-companion@speckit-companion
```

You need Claude Code 2.1.287 or later, the first version with mods on by default. Check with `claude --version`.

In a session that is already open, run `/reload-plugins`. To update later, run `claude plugin update speckit-companion@speckit-companion`.

## First run

Open a project that has a spec. In a terminal at least 144 columns wide the pane opens by itself, and in a narrower one `/speckit-tracker` opens it above the prompt. It has three tabs: Run for the steps, documents and tasks, Overview for what the run recorded, and Specs to pick the spec to follow.

![The pane on its Run tab for Profile photo upload, Implementing. Specify, Plan and Tasks are ticked with their times, Implement reads running, six documents are listed with a read hint on each, the task bar reads 3/6, and tasks T001 to T003 are ticked under Phase 1. The foot lists the keys.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-run.png)

## Keys

| Key | What it does |
| --- | --- |
| `1` `2` `3` | Switch to Run, Overview or Specs |
| Tab or the arrow keys | Move between steps and documents |
| `↵` | Read the step or document you are on, inside the pane |
| `o` | Open that file in your editor |
| `b` | Go back from a document |
| `Esc` | Give the keyboard back to the prompt |

## Switch specs with `/speckit-tracker`

| You type | What happens |
| --- | --- |
| `/speckit-tracker` | The pane opens on its Specs tab |
| `/speckit-tracker 42` or `/speckit-tracker export-csv` | The band and the pane follow that spec |
| `/speckit-tracker auto` | They go back to following the most recently active spec |

Your pick is remembered for the project. `/spec` is a shorter name for the same command.

## What it reads, runs and sends

The mod only reads. It never writes a spec file or the run record, and it never sends a prompt, so you run the `/speckit-*` commands yourself.

- **Reads:** the spec files and the run record in your project, and four environment variables (`VISUAL`, `EDITOR`, `TERM_PROGRAM`, `CURSOR_TRACE_ID`) to pick your editor. It does not read the conversation.
- **Runs:** one program, your editor, and only when you press `o`. When no editor can be started, the file's path goes to your clipboard.
- **Sends:** nothing. The mod makes no network request and has no telemetry.

Tested on Claude Code 2.1.291. The mods API can change between releases.

<!-- other-products:start -->
## SpecKit Companion runs in four places

| Where | What it is | Start here |
|---|---|---|
| VS Code | The extension: a sidebar, a spec viewer and the Overview of every run. | [Install](https://speckit-companion.dev/docs/install) |
| Spec Kit | The engine half: records each step so every surface can show progress and resume. | [Install](https://speckit-companion.dev/docs/install) |
| GitHub Copilot app | A live spec board in the app's side panel. | [Copilot app](https://speckit-companion.dev/docs/copilot-app) |
| Claude Code | The followed spec's run above your prompt and in a pane. | [Claude Code](https://speckit-companion.dev/docs/claude-code) |
<!-- other-products:end -->

## Docs

[Guide](https://speckit-companion.dev/docs/claude-code) · [Changelog](./CHANGELOG.md) · [Develop](https://github.com/alfredoperez/speckit-companion/blob/main/apps/claude-mod/docs/develop.md) · MIT licensed.
