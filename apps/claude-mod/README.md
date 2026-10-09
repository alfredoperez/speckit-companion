# SpecKit Companion for Claude Code

Follow a [Spec Kit](https://github.com/github/spec-kit) run without leaving Claude Code. This [mod](https://code.claude.com/docs/en/plugins/mods/overview) adds a band above the prompt that says where the run stands, and a pane beside the transcript with the steps, their times, the documents and the tasks ticking off. It works with stock Spec Kit and with [SpecKit Companion](https://speckit-companion.dev), and it only reads.

![A Claude Code terminal with the mod's pane beside the transcript on its Run tab: Specify, Plan and Tasks ticked with their times, Implement running, the documents, and three of six tasks ticked. The band above the prompt names the spec and reads Plan done, Tasks 3/6, Implement running.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-window.png)

**[Docs](https://speckit-companion.dev/docs/claude-code/install/)** · **[A run, step by step](https://speckit-companion.dev/docs/claude-code/a-run-step-by-step)** · **[speckit-companion.dev](https://speckit-companion.dev)**

## Install

```bash
claude plugin marketplace add https://speckit-companion.dev/plugins/marketplace.json
claude plugin install speckit-companion@speckit-companion
```

You need Claude Code 2.1.287 or later, the first version with mods on by default. Check with `claude --version`.

In a session that is already open, run `/reload-plugins`. To check it loaded, run `/plugin`: the line under the tabs names `speckit-companion` among the active mods. To update later, run `claude plugin update speckit-companion@speckit-companion`.

The pane opens by itself in a terminal at least 144 columns wide: at the start when the project has a spec, or as soon as the first one appears. It opens once, so a pane you closed stays closed until you run `/speckit-tracker`. In a narrower terminal, run `/speckit-tracker` and the pane sits above the prompt.

## What it shows

Both the band and the pane follow one spec at a time. They update while the agent works: after each tool call, and every few seconds for changes made outside the session.

### The band

One line above the prompt: the spec you are following, a bar of ticked tasks, and where the run stands. A finished spec reads `Completed · Tasks 12/12 · 38m active`.

![The band, one line: a yellow dot, 041-profile-photo-upload, a bar half filled, Plan done, Tasks 3/6, and Implement running in yellow.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-band.png)

### The pane

Three tabs. Press `1`, `2` or `3` to switch. The spec's title and status stay at the top of each.

| Tab | What it shows |
| --- | --- |
| **Run** | The four steps (specify, plan, tasks, implement) with the time each one took, the spec's documents, and the task list by phase with a bar of ticked tasks |
| **Overview** | What the run recorded about the change: the intent, the approach, the decisions and why, what was verified, and any concerns |
| **Specs** | The recent specs, to pick the one to follow |

![The pane on its Run tab for Profile photo upload, Implementing. Specify, Plan and Tasks are ticked with their times, Implement reads running, six documents are listed with a read hint on each, the task bar reads 3/6, and tasks T001 to T003 are ticked under Phase 1. The foot lists the keys.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-run.png)

A step shows a time only when the run record measured it, and the waits between steps count toward nothing. When a small change is specified, planned and tasked in one pass, Plan and Tasks read `with Specify`.

The colours come from your Claude Code theme. A finished step is green, the running step is the warning colour, a failed check is red, and times are dim. Each section has a heading in capitals.

### Keys

The foot of the pane lists them.

| Key | What it does |
| --- | --- |
| `1` `2` `3` | Switch to Run, Overview or Specs |
| Tab or the arrow keys | Move between steps and documents |
| `↵` | Read the step or document you are on, inside the pane |
| `o` | Open that file in your editor |
| `b` | Go back from a document |
| `Esc` | Give the keyboard back to the prompt |

### Read a step's document

On the Run tab, every step and document that has a file ends in `↵ read`. Move to it and press Enter to read it in the pane, rendered as markdown. Specify opens the spec, Plan opens `plan.md`, and Tasks and Implement open `tasks.md`. Press `b` to go back. The document refreshes as the agent writes it. A step whose file does not exist yet says `not written yet`.

![The pane showing specs/_02_demo-tasked/plan.md after Enter on Plan. Under the path are b: Back and o: Open in editor, then the plan's title, its Approach and its list of files.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-document.png)

### Open a file in your editor

Press `o` on a step or a document, or while you are reading one. The file opens in the editor named by `$VISUAL` or `$EDITOR` when that editor has a window of its own (`code`, `cursor`, `zed`, `subl` and the like, never `vim`), else in Cursor or VS Code, else in your system's default app. When none can be started, the file's path is copied to the clipboard and a toast says so.

### Switch specs with `/speckit-tracker`

| You type | What happens |
| --- | --- |
| `/speckit-tracker` | The pane opens on its Specs tab |
| `/speckit-tracker 42` or `/speckit-tracker export-csv` | The band and the pane follow that spec |
| `/speckit-tracker auto` | They go back to following the most recently active spec |

Your pick is remembered for the project. `/spec` is a shorter name for the same command.

## Works with stock Spec Kit

A stock Spec Kit project has no run record, because the Companion Spec Kit extension is what writes it. The mod then works from the files in the spec folder:

- **Each step says when its document was written**, such as `✓ Plan  written 7:18 PM · 4m after the spec`. Implement reads `3 of 10 tasks · last change 2m ago` while tasks are being ticked. A line under the steps says these are file times, not measured ones.
- **The line under the title says what is happening now**, such as `Writing the plan` or `Implementing: T004 next`. Once the turn ends it reads `Plan written · Tasks next`.
- **Documents** lists each file in the spec folder with what it holds: stories, requirements and open questions in the spec, tasks by phase, decisions in the research, and how much of each checklist is checked.
- **The Overview comes from the spec**: the description, the user stories, the open questions, the first requirements, the success criteria and the plan's summary.
- **The last line names the next command**, such as `Next: /speckit-tasks`.

![The pane on its Run tab in a stock Spec Kit project. The line under the title reads Implementing: T004 next. Specify, Plan and Tasks each read written 10:15 AM, Implement reads 3 of 6 tasks, last change just now, and the last line reads Next: /speckit-implement.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/live-mod-run-files.png)

With the [Companion Spec Kit extension](https://speckit-companion.dev/docs/install) in the project, each step shows the time it took, and the Overview tab adds the run's intent, decisions and checks.

## Good to know

- **The mod only reads.** It never writes a spec file or the run record, and never sends a prompt. You run the `/speckit-*` commands yourself. The one command it runs is your editor's, when you press `o`.
- **Where it draws.** The Claude Code terminal and the Code tab of the Claude Desktop app draw the band and the pane. The VS Code extension's chat panel and `claude -p` draw nothing, so there `/speckit-tracker` answers with text: the followed spec, its band line, and the recent specs.
- **Where it looks for specs.** In `specs/` and `.specify/specs/`, or in `speckit.specDirectories` from `.vscode/settings.json` when you set it.
- **Tested on Claude Code 2.1.291.** The mods API can change between releases.

## What it reads, runs and sends

- **Reads:** the spec files and the run record in your project, and the `VISUAL`, `EDITOR`, `TERM_PROGRAM` and `CURSOR_TRACE_ID` environment variables, only to pick your editor. It does not read the conversation.
- **Runs:** one program, your editor, and only when you press `o`. It tries `$VISUAL` or `$EDITOR` when that editor has a window of its own, then `cursor` or `code`, then the system opener (`open` or `xdg-open`), each with the file's path as its only argument. When none works, the path goes to your clipboard.
- **Sends:** nothing. The mod makes no network request and has no telemetry.
- **Hooks:** `session.start` to find the specs, `tool.call` and `turn.complete` to look at the files again after the agent writes, and `ui.focus` to remember which row you are on in its own pane. It passes every call through unchanged.

## The other places SpecKit Companion runs

The mod reads the same run record as the other two surfaces, so all three show the same steps, times and task counts.

- **VS Code**: the [SpecKit Companion extension](https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion) has the sidebar, the spec viewer with review comments, and the Overview.
- **GitHub Copilot app**: the [spec board](https://speckit-companion.dev/docs/copilot-app/install/) lists every spec next to the chat and runs the next step from a button.

Docs: [install](https://speckit-companion.dev/docs/claude-code/install/), [what it shows](https://speckit-companion.dev/docs/claude-code/what-it-shows), [switch specs](https://speckit-companion.dev/docs/claude-code/switch-specs). Changes are in the [changelog](./CHANGELOG.md). MIT licensed.

## Develop

```bash
npm run mod:build                          # from the repo root: rebuild hooks/vendor and the test fixtures
npm run test:mod                           # build, then claude plugin test
claude plugin validate --strict ./apps/claude-mod
claude --plugin-dir ./apps/claude-mod      # load this checkout for one session, reloading on save
```

| File | Job |
|---|---|
| `hooks/register.js` | The hooks module: every call to Claude Code, the file reads, the band, the pane and `/speckit-tracker`. |
| `hooks/board.js` | What the band, the pane's three tabs, a step's document and the text replies say, worked out from the rows. No IO. |
| `hooks/vendor/board-rules.mjs` | Generated by `build.mjs` from `apps/copilot-canvas/spec-rules.mjs`, the board's own rules for statuses, steps, tasks and timing. Never edit by hand. |
| `tests/` | `claude plugin test` suites. `fixtures/demo-specs.js` is generated from the repo's `specs/_0N_demo-*` fixtures, because a plugin test cannot read files. |

A hooks module may import only files inside its plugin, so the board's rules arrive as a generated bundle. CI fails when the bundle or the fixtures are stale.
