# Contract: `dispatch-briefs.py --waves`

The spec has no Verbatim Constraints section, so the identifiers below come from the plan and research and are the ones implement, the doctor, the tally and the tests code against.

## CLI

```
python3 .specify/extensions/companion/scripts/dispatch-briefs.py --feature-dir <dir> --waves
python3 .specify/extensions/companion/scripts/dispatch-briefs.py --feature-dir <dir> --checkin "wave: <W>.<N>"
```

- Input: `<dir>/tasks.md`. Only the Foundational phase (`## Phase …` heading containing `Foundational`) is read.
- Exit code: always `0`, including a missing or unreadable `tasks.md` (error goes to stderr as `[dispatch-briefs] skipped: <reason>`).
- `--waves` and `--docs` are mutually exclusive modes; neither given keeps the reader mode.

## Wave splitting

- A wave ends at a `**⟶ Wait` join line, a `### ` block heading or a `**Wave N` header; the phase starts at `## Phase N: Foundational` and ends at the next `## ` heading.
- A task is any line the shared task grammar in `task_sync.py` matches (bold or plain id, `-`/`*`/`+` bullet); fenced code is skipped. Finished tasks count toward the doctor's judgement but are never briefed again.
- Qualifying wave: 4 or more tasks (`MIN_WAVE = 4`). Smaller waves, Setup and Polish stay with the main agent.
- A qualifying wave is split into `min(len(tasks), MAX_WORKERS)` workers, `MAX_WORKERS = 4`, tasks dealt round-robin (`tasks[i::4]`). A worker never holds tasks from two waves.
- Reference shape (spec 612): waves of 7, 4, 4, 4, 1 tasks → waves 1-3 dispatched (4 + 4 + 4 workers), wave 4 inline.

## Shared splitter

```python
def foundational_waves(tasks_text: str) -> list[list[str]]
```

Returns every Foundational wave (qualifying or not) as a list of task IDs (`"T004"`, …) in file order. Defined in `speckit-extension/scripts/dispatch-briefs.py`; `.claude/scripts/subagent-tally.py` imports it by path. It is the only definition of a wave.

## Output (stdout)

`--waves` prints one wave per call: the first Foundational wave with unfinished tasks. Implement runs it before each wave, so a later wave is never offered before the earlier one's join line. A qualifying print also records a `dispatch-offer` trace event with `files: ["waves:N"]`, and `--waves` folds appended finishes before reading `tasks.md`. The doctor judges only the waves offered since implement's latest start.

No qualifying wave:

```
Working inline: no Foundational wave of 4+ tasks. No wave workers to dispatch.
```

One or more qualifying waves:

```
Dispatch wave W's workers together, all in ONE message, each brief as written, and cross its join line only after every one returns. If you have no subagent tool, do each yourself instead.

=== wave: W.N ===
First run `<checkin line for "wave: W.N">`. Then implement <task IDs> from `<dir>/tasks.md` ... Append each task's finish; do not fold. Return what you finished and anything that failed.
```

Waves that do not qualify are listed by number as inline, so implement knows where they sit between dispatched waves.

## Check-in label

`wave: <W>.<N>` (wave number, worker number within the wave), recorded as a `dispatch-checkin` trace event with `files: ["wave: W.N"]`, same as `reader:` and `doc:`.

## Consumers

| Consumer | Uses |
|---|---|
| `nodes/implement/implement-exec.md` step 3 | runs `--waves` at the start of Foundational and dispatches what it prints |
| `doctor_checks.check_dispatch` | once implement has closed, a qualifying wave with no `wave: W.` check-in is a finding (`dispatch`, "built the Foundational wave inline") |
| `.claude/scripts/subagent-tally.py` `expected()` | the `implement` string adds the qualifying waves, e.g. `plus 16 across Foundational waves 1 (7 tasks), 2 (4 tasks), 3 (4 tasks), 4 (4 tasks)` |
