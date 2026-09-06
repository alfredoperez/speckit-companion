---
allowed-tools: Bash(node ../speckit-bench/sync-templates.mjs:*), Bash(node ../speckit-bench/run-all.mjs:*), Bash(npm run compile:*), Bash(git -C:*), Bash(date:*), Bash(ps:*), Agent, Workflow, AskUserQuestion
description: Run one full benchmark round on Conduit and report it against previous sweeps
---

## Your task

Run one complete round of the benchmark and report what changed. The user says "run an experiment and bench it" and expects the whole thing without being asked for details.

The harness lives in the sibling [`speckit-bench`](https://github.com/alfredoperez/speckit-bench) repo and the app it measures in [`conduit`](https://github.com/alfredoperez/conduit). Its `README.md` is the reference; this command is the procedure.

### 1. Name the sweep

`$ARGUMENTS` is what the experiment is testing. Turn it into a short label — "hook anchors", "living specs off", "fresh baseline". If there is nothing to name, use today's date and call it a baseline repeat, which is also useful: it is how the noise floor gets measured.

### 2. Check the machine first

Twelve clones of a React app are about 8GB of files Spotlight has never seen, and indexing them has taken this machine to a load average of 260. Before baking:

```bash
ls ~/dev/projects/.metadata_never_index || echo "MISSING"
```

If it is missing, or if `ps aux | grep mds_stores` shows Spotlight busy, tell the user to run `sudo mdutil -i off ~/dev/projects` and wait for them. Do not start a round on a machine that is already struggling.

### 3. Bake

```bash
npm run compile                          # the driver dispatches the GUI preamble from dist/
node ../speckit-bench/sync-templates.mjs --sizes easy,medium,hard,oversized --ext code --sweep "<label>"
```

`--ext code` measures the extension in `COMPANION_DIR`, which is what an experiment on unreleased work needs. Use `--ext latest` only when the question is explicitly about the published build.

The bake prints the three versions it recorded and fails loudly if any cell can read what it is. Report the versions; do not report the arm mapping unless asked, and never pass it to a driver or a judge.

### 4. Prep and drive

```bash
node ../speckit-bench/run-all.mjs prep --sizes easy,medium,hard,oversized
```

Then one driver per cell, all twelve at once, following step 3 of `/bench-run-all` — the same GUI preamble, the same settle-wait, capture for the Companion arms only, and **the cell's letter, never its arm**. Twelve drivers in parallel is fine; the round costs the slowest cell rather than the sum.

Expect 20 to 30 minutes.

### 5. Measure — with nothing else running

```bash
node ../speckit-bench/run-all.mjs capture --sizes easy,medium,hard,oversized --no-reset
```

This runs a build and two test passes in each of twelve cells. **Do not start the judges while it runs.** Stacking twelve judge agents on top of it is what took the machine down; it costs nothing to wait the ten minutes.

`--no-reset` keeps the diffs so the judges have something to read.

### 6. Judge — after capture finishes, in small batches

A rubric judge per cell and a comparative reviewer per size, as `/bench-capture` steps 3 and 4 describe. Run them **three or four at a time**, not twelve. Then re-run `capture` once to fold the rubric into the composite.

If the machine is under load, or the user has other work to do, stop after step 5 and say so: the oracle, wall-clock and test columns are complete without the judges, and the composite can be filled in later.

### 7. Report

```bash
node ../speckit-bench/run-all.mjs compare --metric work
node ../speckit-bench/run-all.mjs compare --metric oracle
node ../speckit-bench/run-all.mjs compare --metric wall
```

Lead with what moved and whether it moved more than the spread of the sweeps before it. A change smaller than that spread has not been measured — say so plainly rather than reporting it as a result.

**Read `work`, not `overall`, when comparing the stock arm to a Companion one.** `overall` gives a quarter of its weight to lifecycle capture, which stock does not have and never will, so it caps stock at 75 by construction. `work` is correctness plus rubric and every arm can reach 100.

Then commit the round in `speckit-bench` — `stats.jsonl`, `history.jsonl`, `runs/`, `reviews/`, `REPORT.md` — with a message naming the sweep and what it was testing.

### If something is incomplete

Say which cells are missing and which columns they cost. A round with eleven of twelve cells and no rubrics is still worth pushing; a round reported as complete when it is not is worse than no round.
