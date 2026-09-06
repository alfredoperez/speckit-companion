---
allowed-tools: Bash(node ../speckit-bench/run-all.mjs:*), Bash(node ../speckit-bench/sync-templates.mjs:*), Bash(date:*), Bash(git -C:*), Agent, Workflow, AskUserQuestion
description: Agent-driven bench round for one size — drive the three cells, judge, capture
---

## Your task

The automated version of `/bench-prep` → run it → `/bench-capture`, for one size. Driver agents work the cells instead of a person.

Size from `$ARGUMENTS` (`easy`/`medium`/`hard`/`oversized`).

> Faithful dispatch: a driver mimics the GUI, it does not follow raw command bodies. The bench is a trustworthy **relative** comparator with capture overhead isolated; it does not reproduce a human's absolute wall clock.

### 1. Check the cells

`node ../speckit-bench/run-all.mjs --dry-run` — if any cell is missing, run `/bench-sync`. Note the three versions it prints; they belong in the final report.

### 2. Prep

`node ../speckit-bench/run-all.mjs prep --sizes <size>` — resets the cells and writes their run markers into the harness.

### 3. Drive the three cells (Workflow, parallel)

One driver per cell (`parallel` of 3). Each works only in `~/dev/projects/conduit-<size>-<letter>`, stamps `startedAt`/`finishedAt` into `../speckit-bench/runs-meta/conduit-<size>-<letter>.json` (via `date -u`), and runs **specify → plan → tasks → implement** the GUI-faithful way (see `../speckit-bench/driver.mjs`):

- For EACH step, prepend the **same** GUI preamble every arm gets — `buildStepPreamble(step, specDir)` from `driver.mjs`, which imports the real renderer from `dist/ai-providers/promptPreamble.js` so it cannot drift — then dispatch the step's command.
  - **stock arm** → stock `/speckit.*` command bodies. No capture script; stock is blind by design.
  - **Companion arms** → `/speckit.companion.*` command bodies, **and nothing on top of them**. The bodies carry every capture call a run needs. A driver that also runs `cap.mjs <step> start` writes the start stamp twice — the second is a documented no-op that still costs a round-trip on every step, and it inflated wave A's call count by four. The count that matters comes from the writer's own `.trace.jsonl`, so the driver has no bookkeeping of its own to do.
- After dispatching a step, **wait for it to settle** — `waitForSettle(cellDir, step)` polls `.spec-context.json` until the step's completed status **or any later one** appears. It returns `folded: true` when the status overshot, which happens for two shipped reasons: the fast path folds specify/plan/tasks onto `ready-to-implement`, and mark-complete takes implement to `completed`. **A folded step is already done — never re-dispatch it, and never steer the size verdict to make steps settle one at a time.** Right-sizing is the feature under measurement; a driver that disables it produces numbers that look valid and are not.
- Do not time the capture calls. The harness counts them from `.trace.jsonl` and the timing itself is under the noise floor.

The feature prompt is `../speckit-bench/prompts/conduit/<size>.md`, the text between the `---` rules.

**A driver may run the app's own build and test suite, and should.** That is what a person does, and forbidding it measured something nobody does: on the first Conduit round one arm wrote twelve tests and eleven failed on a single convention slip it had no way to see, because it was not allowed to run them. The acceptance oracle is injected only at grading time and removed afterwards, so a run cannot reach it from inside the cell — there is nothing to protect by keeping the suite closed.

The one hard rule for a driver is **no git commands**. Branching and committing belong to the pipeline, and a driver reaching for git is how a cell's baseline gets rewritten under the harness.

**Tell a driver its letter, never its arm.** A driver that knows it is "the Companion arm" is no longer measuring anything.

### 4. Judge + capture

Spawn a rubric judge per cell and one cross-solution comparative reviewer (steps 3 and 4 of `/bench-capture`), then:

`node ../speckit-bench/run-all.mjs capture --sizes <size>`

### 5. Report

Print the size's three-column table with the Overall rows and the version line. Repeat for the other sizes to cover the matrix.
