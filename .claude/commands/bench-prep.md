---
allowed-tools: Bash(node examples/todo-claude/bench/run-all.mjs:*), AskUserQuestion
description: Clean + arm the 2 bench variant folders for one size, ready to run in VS Code
---

## Your task

Arm the two per-variant sandbox folders for one feature size so you can run each through the real SpecKit Companion extension in VS Code. The two folders **are** the run folders — no copies.

### 1. Resolve the size

From `$ARGUMENTS` — `easy` | `medium` | `hard`. If missing, ask with **AskUserQuestion** (one question). Don't guess.

### 2. Arm the folders

```bash
node examples/todo-claude/bench/run-all.mjs prep --size <size>
```

This resets each of `examples/bench-sandboxes/todo-{speckit,companion}/` to pristine (restores `src/` + `index.html` from the canonical app, clears `specs/`), writes a `.run-meta.json` marker, **prints the paste-able prompt**, and **opens both folders in VS Code** (`code -n` per folder; pass `--no-open` to skip). If a folder is missing, it tells you to run `/bench-sync` first.

### 3. Hand off

The script already printed the prompt and opened the windows. Relay the prompt block to the user as well, then tell them:

- Two VS Code windows just opened (set the Companion provider to Claude in each). If fewer than two opened, the `code` CLI is missing — open the rest by hand.
- Run **specify → plan → tasks → implement** in each, through the extension.
  - `speckit` — plain upstream spec-kit, no companion, NO lifecycle capture. Stock `/speckit.*`. You'll see **no progress tracking** (the point — it's blind).
  - `companion` — the SpecKit Companion pipeline (`/speckit.companion.*`) with capture on, so the GUI tracks progress/timing.
- They can run both in parallel (isolated folders) or one at a time.
- When both are done, run **`/bench-capture <size>`**.

Do **not** drive the pipelines yourself — the user runs them in VS Code. Your job ends after prep prints the instructions.
