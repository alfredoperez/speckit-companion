---
allowed-tools: Bash(node examples/todo-claude/bench/run-all.mjs:*), Bash(node examples/todo-claude/bench/sync-templates.mjs:*), Bash(date:*), Bash(git -C examples/bench-sandboxes:*), Agent, Workflow, AskUserQuestion
description: Agent-driven bench round for one size — drive the 4 variant folders + judge + capture, hands-off
---

## Your task

The **automated** version of the manual `/bench-prep` → run-in-VS-Code → `/bench-capture` loop, for **one size** at a time (the four folders hold one feature at a time). Drives all four variant folders via subagents instead of a human in VS Code.

Size from `$ARGUMENTS` (`easy`/`medium`/`hard`). Variants: `speckit`, `companion-logs`, `companion-commands`, `companion-turbo`.

### 1. Ensure folders exist
`node examples/todo-claude/bench/run-all.mjs --dry-run` — if any folder is MISSING, run `/bench-sync` (or `node examples/todo-claude/bench/sync-templates.mjs`).

### 2. Prep
`node examples/todo-claude/bench/run-all.mjs prep --size <size>` — resets the four folders to pristine + writes their `.run-meta.json`.

### 3. Drive the 4 folders (Workflow, parallel)
One driver agent per folder (`pipeline`/`parallel` of 4). Each works only in its folder `examples/bench-sandboxes/todo-<variant>/`, stamps `startedAt`/`finishedAt` into `.run-meta.json` (via `date -u`), and runs **specify→plan→tasks→implement** by following its variant's command bodies + capture:
- **speckit** → `.claude/commands/speckit.*.md` (stock). **No capture.**
- **companion-logs** → `.claude/commands/speckit.*.md` (stock) **+ capture** via `node <repo>/examples/todo-claude/bench/cap.mjs <step> …` (companion is installed, so the hooks fire — same stock commands, now tracked).
- **companion-commands** → `.specify/presets/companion-standard/commands/speckit.*.md` + `cap.mjs`.
- **companion-turbo** → `.specify/extensions/companion/commands/speckit.companion.*.md` + `cap.mjs`.
Feature prompt = `bench/prompts/<size>.md` (between the `---` rules); implement the Required affordances exactly. Hard rules: no git, no `npm build`/`test`.

### 4. Judge + capture
Spawn an independent judge per folder (writes `quality` into each `.run-meta.json`), then `node examples/todo-claude/bench/run-all.mjs capture --size <size>` — measures + folds the rubric + appends rows + regenerates the 4-column `REPORT.md` + resets the folders.

### 5. Report
Print the size's 4-column table. To cover all sizes, repeat for the other two.
