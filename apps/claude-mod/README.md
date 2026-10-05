# SpecKit Companion for Claude Code

A [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) that shows where your Spec Kit run stands without leaving the prompt. It reads the same `.spec-context.json` run record as the VS Code viewer and the GitHub Copilot app board, so all three show the same steps, times and task counts.

Tested on Claude Code 2.1.287, the first version with mods on by default. The mods API can change between releases.

## What it shows

- **A band above the prompt** with the followed spec and where its run stands, such as `042-export-csv · Plan done · Tasks 7/12 · Implement running`. A finished spec reads `Completed · Tasks 12/12 · 38m active`.
- **A pane beside the transcript** with three tabs. Press `1`, `2` or `3` to switch, and the spec's title and status stay at the top of each.
  - **Run** has the four steps (specify, plan, tasks, implement) with the time each one took, the total active time, and the task list by phase with the task in flight marked. A step shows a time only when the record measured it from its own start to its own finish, and the waits between steps count toward nothing. When a small change is specified, planned and tasked in one pass, Plan and Tasks read `with Specify`, because their time is inside that step.
  - **Overview** has what the run record says about the change: the intent, the approach, the size and workflow, what is out of scope, the decisions with the reason for each, what was verified and how each check came out, the open concerns, and how many requirements are covered by tests. A part the record does not have is left out. A check that failed says `failed` in red.
  - **Specs** lists the most recent specs so you can pick the one to follow.
- **`/speckit-tracker`** to choose the spec the band and pane follow. Bare `/speckit-tracker` opens the pane on its Specs tab. `/speckit-tracker 42` or `/speckit-tracker export-csv` follows that spec, and `/speckit-tracker auto` goes back to following the most recently active one. Your pick is remembered for the project. `/spec` is a shorter name for the same command.

Everything updates while the agent works: after each tool call, and every few seconds for changes made outside the session.

The colours follow your terminal: a finished step is green, the running step and the word `running` use the theme's warning colour, a failed check is red, and secondary facts are dim.

### Open a step's document

On the Run tab each step is a control. Move to it with Tab or the arrow keys and press Enter to read that step's file inside the pane, rendered as markdown: Specify opens the spec, Plan opens `plan.md`, and Tasks and Implement open `tasks.md`. When the record has a summary of what each finished task did, Implement lists those first. The first line names the file, and `b` goes back to the step you came from. The document refreshes as the agent writes it. A step whose file does not exist yet says `not written yet` and cannot be opened, and a very long file shows its first 60,000 characters with a line saying how much was left out.

### Without a run record

A stock Spec Kit project has no `.spec-context.json`, because the Companion Spec Kit extension is what writes it. The pane then works from the files in the spec folder alone:

- **A timeline from the files.** Each step says when its document was last written, such as `✓ Plan  written 7:18 PM · 4m after the spec`, and a file from another day carries its date. Implement reads `3 of 10 tasks · last change 2m ago` while tasks are being ticked. A line under the steps says these are file times, not measured ones, and a step the record did measure never shows a file time.
- **What is happening now.** The line under the title reads `Writing the plan`, `Implementing: T004 next` or `Waiting: tasks next`, from which files exist and how lately each changed. The band reads the same way: `001-clear-completed · Plan written 4m ago · Tasks next`.
- **Documents.** One line per file in the spec folder with what it holds: the spec's stories, requirements, success criteria and open questions, the files the plan names, the tasks by phase and how many can run in parallel, the decisions in the research, and how much of each checklist is checked. Press a line to read that file, including the ones in `checklists/` and `contracts/`. A count the file does not give is left out.
- **An Overview from the spec.** The feature's description, its user stories with their priority, the open questions, the first five requirements, the success criteria and the plan's summary.
- **The next command.** The last line of the Run tab names it, such as `Next: /speckit-tasks`, or the `/speckit-companion-*` command with the spec folder when the project has the Companion skills.

A run that has a record shows the Documents block and the next command too, and its Overview adds the user stories and open questions from the spec.

The mod only reads. It never writes a spec file or the run record, and never sends a prompt: you run the `/speckit-*` commands yourself.

## Install

```bash
claude plugin marketplace add alfredoperez/speckit-companion
claude plugin install speckit-companion@speckit-companion
```

Run `/reload-plugins` in a session that is already open. To check it loaded, run `/plugin`: the line under the tabs names `speckit-companion` among the active mods.

The pane sits beside the transcript in a terminal at least 144 columns wide, and opens there by itself: at the start when the project has a spec, or as soon as the first one appears. It opens once, so a pane you closed stays closed until you run `/speckit-tracker`. In a narrower terminal it waits until you run `/speckit-tracker`, then sits above the prompt.

## Where it draws

The Claude Code terminal and the Code tab of the Claude Desktop app draw the band and the pane. The VS Code extension's chat panel and `claude -p` draw nothing, so there `/speckit-tracker` answers with text: the followed spec, its band line, and the recent specs.

The spec folders are read from `specs/` and `.specify/specs/`, or from `speckit.specDirectories` in `.vscode/settings.json` when you set it.

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
