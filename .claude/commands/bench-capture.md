---
allowed-tools: Bash(node ../speckit-bench/run-all.mjs:*), Bash(git -C:*), Agent, Workflow, AskUserQuestion
description: Score the three bench cells for one size, record, report, and reset
---

## Your task

After a size has been run through its three cells, capture the evals, append to history, regenerate the report, and reset the cells for the next round.

### 1. Resolve the size

From `$ARGUMENTS` — `easy` | `medium` | `hard` | `oversized`. If missing, ask with **AskUserQuestion**.

### 2. Read the cell mapping

```bash
node ../speckit-bench/run-all.mjs --dry-run
```

It prints which letter carries which arm, plus the spec-kit, extension and Companion versions this round was measured with. You need the mapping to attribute the reviews; the judges below must **not** be told which arm they are looking at.

### 3. Independent rubric judges (before measuring — they read the diff)

Spawn one **judge agent per cell** (a `parallel()` Workflow of 3). Each judge — which did NOT write the code — does exactly:

- Read the diff: `git -C ~/dev/projects/conduit-<size>-<letter> diff bench-baseline`.
- Read the requirements at `../speckit-bench/prompts/conduit/<size>.md` and the conventions in the cell's `CLAUDE.md`.
- Score 1–5: `readability`, `conventions`, `scope`. Judge the layering rules the app actually documents; do not penalize a rule the size had no occasion to exercise.
- Write `quality = {readability, conventions, scope, justification}` into `../speckit-bench/runs-meta/conduit-<size>-<letter>.json` (MERGE — keep `runId`/`size`/`mode`).

Give each judge the **letter only**. A judge told it is looking at "the Companion arm" is no longer independent.

### 4. Comparative reviewer (one agent, cross-solution)

The per-cell judges score each solution in isolation, and tests cannot fully pin correctness. Spawn **one** reviewer that sees all three at once. **Run it before step 5** — measuring resets the cells and erases the diffs. It does exactly:

- Read all three diffs (`git -C ~/dev/projects/conduit-<size>-<letter> diff bench-baseline`), labeled A, B and C.
- Read the requirements and the conventions.
- Produce a **comparative** review:
  - **Ranking** best to worst, one line each.
  - **Head-to-head differences** — structure, layering, naming, edge cases, test coverage.
  - **Suspected bugs the deterministic harness cannot catch**, per solution (or "none found").
  - **One-line verdict per solution.**
- Write it to `../speckit-bench/reviews/<size>.md` — committed there, accumulating: read the existing file first, then **prepend** a `## <YYYY-MM-DD> — <size>` section so prior runs are preserved.

### 5. Measure + report + reset

```bash
node ../speckit-bench/run-all.mjs capture --sizes <size>
```

This runs the app's build and its full test suite, injects the acceptance oracle for the grading pass only, runs the convention and blast-radius checks, runs the capture eval and the doctor (skipped for the stock arm), folds in each rubric, computes the Overall composite, appends a row per cell to `stats.jsonl` and updates `history.jsonl` in place for a re-measurement, regenerates `REPORT.md`, writes per-run snapshots to `runs/`, then **resets the cells**. Pass `--no-reset` to inspect them first.

### 6. Report

Print the size's three-column table including the Overall rows and the version line, surface the reviewer's ranking and verdict with the arm names now attached, and confirm the cells were reset.
