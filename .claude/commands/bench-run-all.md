---
allowed-tools: Bash(node examples/todo-claude/bench/run-all.mjs:*), Bash(node examples/todo-claude/bench/sync-templates.mjs:*), Bash(date:*), Bash(git -C examples/bench-sandboxes:*), Agent, Workflow, AskUserQuestion
description: Agent-driven bench round for one size — drive the 2 variant folders + judge + capture, hands-off
---

## Your task

The **automated** version of the manual `/bench-prep` → run-in-VS-Code → `/bench-capture` loop, for **one size** at a time (the two folders hold one feature at a time). Drives both variant folders via subagents instead of a human in VS Code.

Size from `$ARGUMENTS` (`easy`/`medium`/`hard`). Variants: `speckit`, `companion`.

> Faithful dispatch: the driver must mimic the GUI, NOT follow raw command bodies. The bench is a trustworthy **relative** comparator (stock vs companion) with capture overhead isolated — it does **not** reproduce a human's absolute GUI wall-clock (agents are faster). See `bench/README.md`.

### 1. Ensure folders exist
`node examples/todo-claude/bench/run-all.mjs --dry-run` — if any folder is MISSING, run `/bench-sync` (or `node examples/todo-claude/bench/sync-templates.mjs`).

### 2. Prep
`node examples/todo-claude/bench/run-all.mjs prep --size <size>` — resets the two folders to pristine + writes their `.run-meta.json`.

### 3. Drive the 2 folders (Workflow, parallel)
One driver agent per folder (`parallel` of 2). Each works only in its folder `examples/bench-sandboxes/todo-<variant>/`, stamps `startedAt`/`finishedAt` into `.run-meta.json` (via `date -u`), and runs **specify→plan→tasks→implement** the GUI-faithful way (see `bench/driver.mjs`):
- For EACH step, prepend the **same** GUI preamble both modes get — `buildStepPreamble(step, specDir)` from `bench/driver.mjs` (imports the real renderer from `dist/ai-providers/promptPreamble.js`, so no drift) — then dispatch the step's command.
  - **speckit** → stock `/speckit.*` command bodies. **No capture script** (stock is blind by design); the preamble's context-update instructions are the only tracking.
  - **companion** → `/speckit.companion.*` command bodies **+ capture** via `node <repo>/examples/todo-claude/bench/cap.mjs <step> …`.
- After dispatching each step, **wait for it to settle** before advancing — `waitForSettle(cellDir, step)` polls `.spec-context.json` until the step's completed-form status appears (don't fire the next step synchronously).
- Accumulate the time spent in capture into `.run-meta.json` `captureOverheadSec` so the report can isolate it from work time.
Feature prompt = `bench/prompts/<size>.md` (between the `---` rules); implement the Required affordances exactly. Hard rules: no git, no `npm build`/`test`.

### 4. Judge + capture
Spawn an independent rubric judge per folder (writes `quality` into each `.run-meta.json`) **and** one cross-solution comparative reviewer (writes `bench/reviews/<size>.md`), then `node examples/todo-claude/bench/run-all.mjs capture --size <size>` — measures + folds the rubric + computes the Overall composite + appends rows to `stats.jsonl`/`history.jsonl` + regenerates the 2-column `REPORT.md` (including the capture-overhead line) + resets the folders.

### 5. Report
Print the size's 2-column table (including the Overall rows). To cover all sizes, repeat for the other two.
