# Option B — "materialize per wave instead of per task"

**Verdict: do not do it for speed. It saves no wall clock.** There is a real problem underneath it, but it is a scaling problem, not a today problem, and it is worth about 30 lines. The actual time in this run went somewhere else entirely, and that is the part worth acting on.

Evidence below is all from one measured run: `specs/609-living-spec-navigation` on `speckit-companion`, 24 tasks, implement = 29.9 min. Raw data in that spec's `.trace.jsonl` and `.spec-context.json` `history[]`.

---

## What B was supposed to save, and why it doesn't

The instruction in `speckit-extension/presets/_parts/timing.md` (and `nodes/implement/implement-exec.md`) says: on each task finish, run `--append`, then run `--materialize`. Two calls per task, 48 for 24 tasks.

The theory was that 48 calls means 48 agent round-trips. **It does not.** The agent put both in one shell invocation:

```
append -> its materialize gap, across all 24 tasks:
  min 0.10s   median 0.11s   max 0.12s
  gaps over 2s (i.e. a genuinely separate round-trip): 0 of 24
```

So B removes zero round-trips. What it removes is script time and bytes:

```
op              calls        bytes   % of all bytes      ms
task-append        24      120,313         9%           585
materialize        24      580,253        42%          1177
...
TOTAL              83    1,384,212                     5228
```

**1.2 seconds of script time and 580 KB of writes, inside a 29.9-minute step.** That is 0.07% of implement. Cutting it to 6 wave-joins saves roughly one second and costs live per-task progress in the panel, which is the thing the whole finish-only timing model exists to provide.

## The real problem hiding under B

`materialize_log` (`speckit-extension/scripts/task_sync.py:315`) **replays the entire append log on every call.** Call *n* folds *n* lines. That is O(n²) folds and a full rewrite of a growing `.spec-context.json` each time:

```
materialize bytes, first -> last: 18215, 18710, 19200, 19727 ... 29413, 29974, 30709
```

24 tasks → 300 fold operations, 580 KB. It is linear-ish in bytes here only because the file is small. Extrapolating the same shape:

- 50 tasks → ~1275 folds, ~2.5 MB
- 100 tasks → ~5050 folds, ~10 MB

Nothing in this repo has hit that yet (the largest spec so far is this one). **The fix is not "fold less often" — it is "fold only what is new."** Track the last-folded line offset (or a folded-line count) in the context, and have `materialize_log` start from there. Idempotency is currently bought by replaying everything and deduping on `(implement, task_id)`; an offset gives the same guarantee for free, and re-folding from an offset is still safe because the dedupe stays.

That is the change worth making. It keeps per-task progress, keeps the idempotency contract, and removes the quadratic term. Roughly: one new field, one `enumerate` with a skip, one test that a second materialize after a third append folds exactly one line.

## Where implement's 30 minutes actually went

This is the part I would act on before touching capture at all.

```
24 tasks, 29.9 min, median 52s per task
slowest tasks (seconds from the previous finish):
  T009  307s   writing the failing tests for the rules resolver
  T022  219s   the docs task
  T024  160s   the validation pass (3 test suites)
  T014  139s   rebuild + hunting for how to emit a new command
  T016  127s   writing the failing TS tests
top 5 tasks = 15.9 min = 53% of implement
```

Three findings, in order of what they cost:

**1. The suites ran three times, not once.** Full Python is ~65s, full Jest ~40s. They were run at each phase boundary and again at T024. The doctor counted **41 of 227 commands as repeats of something already run**. Running them once, at the validation task, saves ~3 minutes. The phase-boundary reconciliation in `implement-exec.md` says "type-check/build the wave's files together" — it should say type-check, and explicitly *not* the full suites.

**2. Registering a new command is discovered by trial and error.** T014 took 139s, and part of it was wasted: `emission_sync.create_command` takes the *bare* step name (`living-show`), not the full command id, and calling it with the full id silently created five directories named `speckit-companion-speckit.companion.living-show` that then had to be deleted. Two of the seven areas (`.gemini/commands` toml, `.github/prompts`) were skipped by `create_command` entirely and had to be written by hand, and `.specify/extensions/.registry` had to be edited separately for 8 agents. **Nothing documents this sequence.** `check-command-emissions.py` reports the gap perfectly but says nothing about how to close it. One paragraph — in `speckit-extension/docs/` or as a `--fix` mode on that checker — removes ~2 minutes from every future command and the wrong-name cleanup entirely.

**3. Contracts were written before the CLI shape was known.** `specs/609-.../contracts/living-show.md` says `--requirement` takes a capability name; the implementation added a separate `--capability` flag instead. Harmless here because I caught it, but the plan step writing an interface contract it has not yet had to satisfy is a systematic drift source. Worth considering whether `contracts/` should be written or amended at the end of implement rather than in plan.

## Recommendation for whoever picks this up

- **Do not implement B as described.** It trades a visible feature (per-task progress) for one second.
- **Do implement the incremental fold** in `materialize_log`: last-folded offset, skip what is already folded. Small, keeps every current guarantee, removes the quadratic term before a 100-task spec finds it.
- **Do fix the suite-repeat instruction** in `implement-exec.md` — that is the actual 3 minutes.
- **Do document the new-command registration path.** Biggest ratio of time saved to work required of anything here.

