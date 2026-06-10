---
allowed-tools: Bash(node examples/todo-claude/bench/run-all.mjs:*), Agent, Workflow, AskUserQuestion
description: Score the 5 bench variant folders for one size (build/acceptance/regression/conventions/capture + rubric + cross-solution review), record, report, and reset
---

## Your task

After you've run a size through the five folders in VS Code, capture the evals, append to history, regenerate the report, and reset the folders for the next round.

### 1. Resolve the size

From `$ARGUMENTS` — `easy` | `medium` | `hard`. If missing, ask with **AskUserQuestion**.

### 2. Independent rubric judges (before measuring — they read the diff)

Spawn one **judge agent per folder** (a `parallel()` Workflow of 5, or five Agent calls). Each judge — which did NOT write the code — does exactly:

- Read the diff: `git -C examples/bench-sandboxes/todo-<variant> diff --no-index examples/todo-claude/src examples/bench-sandboxes/todo-<variant>/src` (plus `index.html`).
- Read the requirements `bench/prompts/<size>.md` and conventions `CLAUDE.md` in the folder.
- Score 1–5: `readability`, `conventions`, `scope`. For a pure rename, store/lib-storage conventions are N/A — don't penalize their absence.
- Write `quality = {readability, conventions, scope, justification}` into `examples/bench-sandboxes/todo-<variant>/.run-meta.json` (MERGE — keep runId/size/mode).

The five variants: `speckit`, `companion-logs`, `companion-standard`, `companion-turbo`, `companion-fast-path`.

### 3. Comparative reviewer (one agent, cross-solution — augments the per-folder judges)

The per-folder judges score each solution in isolation. Code correctness is hard to fully pin with tests, so also spawn **one** reviewer agent (it did NOT write any of the code) that sees **all five solutions at once**. **Run it before step 4** — measure resets the folders and erases the diffs. It does exactly:

- Read every variant's diff: for each of the five variants, `git -C examples/bench-sandboxes/todo-<variant> diff --no-index examples/todo-claude/src examples/bench-sandboxes/todo-<variant>/src` (plus `index.html`).
- Read the requirements `bench/prompts/<size>.md` and the conventions `CLAUDE.md`.
- Produce a **comparative** review (not five isolated scores):
  - **Ranking** best→worst, one line each.
  - **Head-to-head differences** — structure, naming, edge-case handling, test coverage, where the solutions genuinely diverge.
  - **Suspected bugs / risks the deterministic harness can't catch** — subtle logic errors, missed edge cases, fragile patterns — per solution (or "none found").
  - **One-line verdict per mode.**
- Write it to `examples/todo-claude/bench/reviews/<size>.md` — **committed, accumulates across runs**: read the existing file first, then **prepend** a new `## <YYYY-MM-DD> — <size>` section (newest on top) so prior runs are preserved. Create the dir/file if missing.
- Return the ranking + verdict block.

### 4. Measure + report + reset

```bash
node examples/todo-claude/bench/run-all.mjs capture --size <size>
```

This runs `npm run build` + the acceptance oracle + the full regression suite + convention/blast checks + the capture eval (`check_capture.py`, skipped for `speckit`), folds in each folder's rubric, computes the **Overall health composite** (+ `vs speckit` and `vs last run`), appends one row per variant to `bench/stats.jsonl` (deduped to last-per-variant) **and** to the append-only `bench/history.jsonl` (never deduped — the durable trend log), regenerates the 5-column `bench/REPORT.md`, writes per-run snapshots to `bench/runs/`, then **resets the five folders** to pristine for the next round. (Pass `--no-reset` if you want to inspect them first.)

### 5. Brief (optional)

If the user wants a refreshed comparison brief, regenerate it via the **html-brief** skill (Blueprint theme) from the new `REPORT.md` and re-file it in `Projects/speckit companion/briefs/` (the durable archive — sdd is legacy).

### 6. Report

Print the size's 5-column table (including the **Overall** rows), surface the comparative reviewer's ranking + verdict and the `reviews/<size>.md` path, and confirm the folders were reset (or note `--no-reset`).
