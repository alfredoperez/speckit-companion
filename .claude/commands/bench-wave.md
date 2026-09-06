---
allowed-tools: Bash(git -C:*), Bash(npm run compile:*), Bash(python3 speckit-extension/scripts/*), Bash(python3 -m pytest:*), Bash(npx jest:*), Bash(node ../speckit-bench/*), Workflow, Read, Edit
description: Bench one pipeline-diet wave on the two Companion cells and record the row
---

## Your task

Bench one wave of the pipeline diet, start to finish, and record it. `$ARGUMENTS` is the wave letter (`B`), optionally followed by the branch; the branch defaults to `pipeline-diet/wave-<letter lowercase>`. The plan and the results table live in the vault at `Projects/speckit companion/plans/pipeline-speed/Pipeline Speed Execution.md`.

One bench at a time. Nothing else heavy runs on this machine until the row is recorded.

### 1. The wave has to reach the cell

The bench dispatches from the pinned worktree, not from this checkout. Point it at the wave's pushed commit and rebuild the preamble:

```bash
git -C ~/dev/GitHub/speckit-companion.worktrees/bench-main fetch -q origin
git -C ~/dev/GitHub/speckit-companion.worktrees/bench-main checkout -q --detach origin/<branch>
(cd ~/dev/GitHub/speckit-companion.worktrees/bench-main && npm run compile)
```

Then prove the wave's text is what the cell will get: pick one line the wave changed and grep for it in `~/dev/GitHub/speckit-companion.worktrees/bench-main/speckit-extension/commands/`. If it is not there, the branch was not rebuilt (`assemble-nodes.py`, `build-commands.py`) or not pushed. Stop and fix that first.

### 2. Gates, in this checkout, on the wave branch

```bash
python3 speckit-extension/scripts/assemble-nodes.py --check
python3 speckit-extension/scripts/check-shape-parity.py
python3 speckit-extension/scripts/instruction-budget.py
python3 -m pytest speckit-extension/tests -q
npx jest
```

A red gate means the wave is not ready to bench. Say which one and stop.

### 3. Bake and prep

```bash
node ../speckit-bench/sync-templates.mjs --sizes hard --speckit keep --ext code --sweep "wave <letter>"
node ../speckit-bench/run-all.mjs prep --sizes hard --modes companion,companion-living
node ../speckit-bench/run-all.mjs --dry-run
```

The bake prints `speckitExtBuild` as `code@<sha>`; it must be the wave's commit. The dry run prints which letter is which arm: take the two letters that are not stock. Never pass the mapping itself anywhere.

### 4. Run the round

```
Workflow name: wave-bench
args: { "wave": "<letter>", "size": "hard", "letters": ["<l1>", "<l2>"], "sweep": "wave <letter>" }
```

It drives both cells, records tokens, captures alone, judges, folds the rubric, compares, and commits the round in `speckit-bench`. Expect about 40 minutes. The result carries the two rows, the `calls` and `context` compare tables, the drivers' notes on what did not work as written, and the commit.

### 5. Record

Add the wave's row to the results table in the plan note (section ⑦), in the same columns as the rows above it, and write the findings under it: what moved, whether it moved more than the noise floor, and every driver note verbatim. A driver note about a command body is the most useful thing a round produces; it is what the next wave fixes first.

Then say in one paragraph what wave <letter> showed and what the next wave changes.
