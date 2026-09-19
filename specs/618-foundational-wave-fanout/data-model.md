# Data Model: Implement fans out large Foundational waves

No stored data changes. The feature adds in-memory shapes read from `tasks.md` by `dispatch-briefs.py --waves`, and reuses the existing trace `dispatch-checkin` event with a new label prefix.

## Entities

### Task

One checklist line of `tasks.md` inside a phase.

| Field | Type | Source |
|---|---|---|
| `id` | string (`T001`…) | the task line |
| `line` | string | the full task line, handed to the worker verbatim |
| `files` | list of paths | paths named on the line |

**Validation**: two tasks of one wave naming the same file break the wave rule the tasks step enforces; implement says so and runs them one after another (edge case, not a split error).

### Wave

A run of Foundational tasks that can be built together.

| Field | Type | Notes |
|---|---|---|
| `index` | int | 1-based position within the Foundational phase |
| `tasks` | list of Task | in file order |
| `qualifies` | bool | `len(tasks) >= 4` |

**Boundaries**: a wave ends at a `⟶ Wait` join line or at the next phase heading. `**Wave N**` headers are ignored, since they restart under `### Tests` / `### Implementation` and headerless tails exist. Spec 612's Foundational phase splits as 7, 4, 4, 4, 1.

**Rules**:
- Only the Foundational phase is split. Setup and Polish are never waves for dispatch (FR-003).
- A wave with fewer than four tasks stays with the main agent (FR-003).

### Worker brief

What `--waves` prints for each qualifying wave; implement dispatches every brief it prints.

| Field | Type | Notes |
|---|---|---|
| `wave` | int | the Wave `index` |
| `worker` | int | 1…N within the wave |
| `tasks` | list of Task | dealt round-robin from the wave |
| `prompt` | string | starts with the check-in command, then the task lines |

**Rules**:
- At most four workers per wave: N = `min(4, len(tasks))`.
- Every task of the wave goes to exactly one worker; no brief spans two waves.
- A worker appends its finishes only; the main agent folds them one at a time.

### Dispatch check-in (existing trace event, new label)

`op: "dispatch-checkin"`, `files: ["wave <index>: worker <n>"]`, written by the worker's first command. Plan's `reader:` and `doc:` labels are unchanged.

### Expected dispatch (doctor + tally)

Derived, never stored. Both read the same splitter, so the instruction and the measurement cannot disagree.

| Consumer | Implement expectation |
|---|---|
| `doctor_checks.check_dispatch` | one or more `wave …` check-ins for each qualifying wave once implement has closed; missing → finding naming the wave |
| `.claude/scripts/subagent-tally.py` | sum of worker counts over qualifying waves (FR-005) |

## State transitions (per qualifying wave)

```
pending ──dispatch all briefs together──▶ running
running ──every worker returned, finishes folded──▶ joined ──▶ next wave may start
running ──any worker's task failed──▶ halted (join not crossed, phase stops)
```

No task after a wave's join line starts before `joined` (FR-002). Inline waves follow the existing inline path.

## Failure behavior

`--waves` exits 0 on any error (missing `tasks.md`, no Foundational phase, unparseable lines) and prints no briefs, so implement falls back to building inline and never fails the host command.
