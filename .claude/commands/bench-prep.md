---
allowed-tools: Bash(node ../speckit-bench/run-all.mjs:*), AskUserQuestion
description: Reset and arm the three bench cells for one size
---

## Your task

Arm the three cells for one feature size so each can be run through the real SpecKit Companion extension. The cells **are** the run folders — there are no copies.

### 1. Resolve the size

From `$ARGUMENTS` — `easy` | `medium` | `hard` | `oversized`. If missing, ask with **AskUserQuestion** (one question). Don't guess.

### 2. Arm the cells

```bash
node ../speckit-bench/run-all.mjs prep --sizes <size>
```

This resets each cell to its git baseline, writes the run marker **into the harness** (never into the cell — the marker names the arm), and prints the paste-able prompt. It does not open editor windows; pass `--open` if you want one per cell.

### 3. Hand off

Relay the prompt block to the user, then tell them:

- The three cells for this size are `conduit-<size>-a`, `-b` and `-c` under `~/dev/projects/`. Which letter is which arm is deliberately not visible from inside a cell; `node ../speckit-bench/run-all.mjs --dry-run` prints the mapping.
- Run **specify → plan → tasks → implement** in each, through the extension. The stock arm shows no progress tracking — that is the point, it is the blind control.
- The three can run at the same time; the cells are isolated.
- When all three are done, run **`/bench-capture <size>`**.

Do **not** drive the pipelines yourself — the user runs them. Your job ends after prep prints the instructions.
