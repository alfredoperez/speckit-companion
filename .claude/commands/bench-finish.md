---
allowed-tools: Bash(node examples/todo-claude/bench/finish.mjs:*), Bash(npm install:*), Bash(cd examples/todo-claude && npm install:*), Read
description: Measure the armed bench run and update the turbo-vs-standard report
---

## Your task

The user has finished running the spec-kit pipeline by hand for the currently armed bench run. Measure it and update the comparison.

### 1. Ensure deps

The acceptance suite + build need the sandbox's `node_modules`. If `examples/todo-claude/node_modules` is missing, run:

```bash
cd examples/todo-claude && npm install
```

### 2. Run finish

```bash
node examples/todo-claude/bench/finish.mjs
```

(If it can't find the run's spec dir, re-run with `--spec <dir-name>` — the folder under `examples/todo-claude/specs/` that the pipeline just created.)

This reads timing from the spec's `.spec-context.json` `history[]`, runs `npm run build` + the size's acceptance suite, diffs the implementation vs the prep baseline, appends a row to `bench/stats.jsonl`, and re-renders `bench/REPORT.md`.

### 3. Report

Summarize the script's output in a sentence or two: total time + per-step, build pass/fail, acceptance N/total, and any **shape/mode mismatch** warning (spec shape didn't match the armed mode). Point the user at `examples/todo-claude/bench/REPORT.md` for the side-by-side, and remind them to run the other mode (or another size) to fill the comparison.

Do not edit the generated `REPORT.md` or `stats.jsonl` by hand — they're produced by the script.
