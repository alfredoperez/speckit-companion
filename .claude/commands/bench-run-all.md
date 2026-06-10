---
allowed-tools: Bash(node examples/todo-claude/bench/run-all.mjs:*), Bash(node examples/todo-claude/bench/sync-templates.mjs:*), Bash(date:*), Bash(git -C examples/bench-sandboxes:*), Agent, Workflow, AskUserQuestion
description: Agent-driven bench round for one size — drive the 5 variant folders + judge + capture, hands-off
---

## Your task

The **automated** version of the manual `/bench-prep` → run-in-VS-Code → `/bench-capture` loop, for **one size** at a time (the five folders hold one feature at a time). Drives all five variant folders via subagents instead of a human in VS Code.

Size from `$ARGUMENTS` (`easy`/`medium`/`hard`). Variants: `speckit`, `companion-logs`, `companion-standard`, `companion-turbo`, `companion-fast-path`.

### 1. Ensure folders exist
`node examples/todo-claude/bench/run-all.mjs --dry-run` — if any folder is MISSING, run `/bench-sync` (or `node examples/todo-claude/bench/sync-templates.mjs`).

### 2. Prep
`node examples/todo-claude/bench/run-all.mjs prep --size <size>` — resets the five folders to pristine + writes their `.run-meta.json`.

### 3. Drive the 5 folders (Workflow, parallel)
One driver agent per folder (`pipeline`/`parallel` of 5). Each works only in its folder `examples/bench-sandboxes/todo-<variant>/`, stamps `startedAt`/`finishedAt` into `.run-meta.json` (via `date -u`), and runs **specify→plan→tasks→implement** by following its variant's command bodies + capture:
- **speckit** → `.claude/skills/speckit-*` (stock hyphenated). **No capture.**
- **companion-logs** → stock `.claude/skills/speckit-*` **+ capture** via `node <repo>/examples/todo-claude/bench/cap.mjs <step> …` (companion is installed at profile `off`, so the hooks fire — same stock commands, now tracked).
- **companion-standard** → `companion-standard` preset commands (stock shape) + `cap.mjs`.
- **companion-turbo** → `.claude/skills/speckit-companion-*` (lean) + `cap.mjs`.
- **companion-fast-path** → `.claude/skills/speckit-companion-*` (lean) + `cap.mjs`; `complexityFastPath` is on, so simple changes fold plan+tasks into specify.
Feature prompt = `bench/prompts/<size>.md` (between the `---` rules); implement the Required affordances exactly. Hard rules: no git, no `npm build`/`test`.

### 4. Judge + capture
Spawn an independent rubric judge per folder (writes `quality` into each `.run-meta.json`) **and** one cross-solution comparative reviewer (writes `bench/reviews/<size>.md`), then `node examples/todo-claude/bench/run-all.mjs capture --size <size>` — measures + folds the rubric + computes the Overall composite + appends rows to `stats.jsonl`/`history.jsonl` + regenerates the 5-column `REPORT.md` + resets the folders.

### 5. Report
Print the size's 5-column table (including the Overall rows). To cover all sizes, repeat for the other two.
