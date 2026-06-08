---
allowed-tools: Bash(node examples/todo-claude/bench/prep.mjs:*), AskUserQuestion
description: Arm a lean-vs-standard bench run in the todo-claude sandbox
---

## Your task

Arm a bench run so the next manual spec-kit pipeline pass (run by hand in VS Code) is measured. The harness lives in `examples/todo-claude/bench/`.

### 1. Resolve size + mode

Read them from `$ARGUMENTS` (e.g. `small lean`, or `--size medium --mode standard`).

- **size** ∈ `small` | `medium` | `complex`
- **mode** ∈ `lean` | `standard`

If either is missing or ambiguous, ask with **AskUserQuestion** (one question for size, one for mode) before continuing. Do not guess.

### 2. Run prep

```bash
node examples/todo-claude/bench/prep.mjs --size <size> --mode <mode>
```

This sets the sandbox `templateProfile` in `.specify/companion.yml`, reconciles the `companion-<mode>` preset via `specify preset … --dev` (mirrors `companionPresetReconciler`), snapshots a git baseline into `bench/.run-state.json`, and prints the **prompt to paste** plus the **exact pipeline commands for this mode**.

### 3. Hand off

Relay the script's printed block to the user verbatim (the prompt + the mode-specific commands). Then tell them: open `examples/todo-claude` as the VS Code workspace, run specify → plan → tasks → implement for that spec, and come back and run **`/bench-finish`** when it's done.

Do **not** run the pipeline yourself — the user drives it in VS Code. Your job ends after prep prints the instructions.
