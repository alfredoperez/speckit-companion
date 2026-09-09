---
allowed-tools: Bash(../speckit-bench/replay.sh:*), Bash(../speckit-bench/stage-from-capture.sh:*), Bash(node ../speckit-bench/grade-one.mjs:*), Bash(node ../speckit-bench/regressions/read-case.mjs:*), Bash(node ../speckit-bench/sync-templates.mjs:*), Bash(node -e:*), Bash(git -C:*), Bash(ls:*), Bash(cat:*), Bash(python3:*), AskUserQuestion
description: Change one thing and replay one pipeline step from a staged cell, then grade it
---

## Your task

Answer a single-step question without running a round. The user names a change ("fan-out off", "the new check node", "gentle-ai's classifier") and which step it affects; you replay that step from a staged state, as many ways as the question needs, and grade each. Everything else is held byte-identical, so a difference in the result is the change and nothing else.

This is for "does X help", never for "is the pipeline good today". A round answers the second. A replay costs about $8 and ten minutes; a round costs about $35 and forty. The harness `README.md` under **Stages** is the reference; this command is the procedure.

### 1. Name the question and the variants

`$ARGUMENTS` is the change. Turn it into:

- the **step** it affects: `implement`, `tasks`, `plan`, or `specify`
- the **stage** to start from: the one before that step (`post-tasks` for implement, `post-plan` for tasks, `post-specify` for plan, the baseline for specify)
- the **variants**, each with a one-word label: the shipped behaviour is always one of them and is always labelled `asis`

Two variants is the normal shape. Three or more only when the question genuinely has that many arms.

### 2. Pick the cell and check the build

Pick the arm the question is about. Cells are blind on disk; identify one by what is installed rather than by letter:

```bash
for d in ~/dev/projects/conduit-*/; do n=$(basename $d); c=$([ -d "$d/.specify/extensions/companion" ] && echo companion || echo stock); l=$([ -f "$d/living-specs.yml" ] && echo "+living" || echo ""); echo "$n $c$l"; done
```

A variant that changes the product needs the pinned build to carry it: `~/dev/GitHub/speckit-companion.worktrees/bench-main` is what a cell installs from. If the change is on `main` and not in the worktree, fast-forward it, then refresh the cell in place rather than re-baking:

```bash
git -C ~/dev/GitHub/speckit-companion.worktrees/bench-main merge --ff-only main
node -e "import('$HOME/dev/GitHub/speckit-bench/sync-templates.mjs').then(m=>m.installCompanion('$HOME/dev/projects/<cell>','companion','code'))"
node -e "import('$HOME/dev/GitHub/speckit-bench/lib.mjs').then(m=>m.gitCommitCellBaseline('$HOME/dev/projects/<cell>'))"
```

The second line re-tags the baseline so the stage you build next starts from the new build. Skip both if the variant is only a prompt passed to `replay.sh`.

### 3. Get a stage

Check for one first:

```bash
git -C ~/dev/projects/<cell> tag | grep ^stage/
```

If the stage you need is missing, rebuild it from a captured run. Every round since the clean sweep leaves stages behind, and every captured run under `runs/conduit/<runId>/` can become one:

```bash
../speckit-bench/stage-from-capture.sh <runId> <cell> <stage>
```

It winds the record back — unticks the task boxes, resets the status, trims the history — because a capture is of a finished run and a replayed step would otherwise read it as work already done. Confirm the output says `source changes: 0`.

### 4. Replay each variant

One call per variant. A variant that is only an instruction goes as the fifth argument; a variant that is a product change was installed in step 2:

```bash
../speckit-bench/replay.sh <cell> <stage> <step> asis
../speckit-bench/replay.sh <cell> <stage> <step> <label> "<extra instruction>"
```

Run them one after another, never at once: the machine and the workers are what is being measured. Each replay prints its time, tokens, workers and cost, then the exam score, then any regression case the cell still trips. The result stays on branch `replay-<label>` in the cell for diffing.

**A replay that finishes in under two minutes with zero workers did not run.** Read `runs-meta/replay-<cell>-<stage>-<step>-<label>.json` before believing a low score. Twice today a harness bug read as a catastrophic result.

### 5. Report

A table, one row per variant: exam, workers, cost, time, and the regression cases. Then the answer to the question in one or two sentences, and the strongest thing that disagrees with it.

Then, for every variant that scored below the best one, **chase the failure to the line** before reporting it. The per-test detail is in `.test-out/<cell>.acceptance.json`, the code is on the replay branch. Two variants failing the same tests means one cause. A score with no named cause is a number, not a finding.

Replays never land in `history.jsonl`. If the answer changes what ships, the confirming step is a round via `/bench-experiment`, not another replay.

### What not to do

- Do not compare a replay row against a round row. Different starting states.
- Do not reuse a cell's stage after refreshing its build without re-staging. The old stage carries the old commands.
- Do not stage by hand with `git`. `stage-from-capture.sh` and `drive-steps.sh` are the two writers, and both wind the record back.
