# Split work across workers: Living Spec

## Purpose

A step that has several independent pieces of work hands each one to its own worker instead of doing them one after another. Without this a plan reads every code area in sequence, a build works one user story at a time, and two workers writing the same file at once corrupt the run record.

## Requirements

### The run is told whether to fan out, it does not decide
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py, apps/speckit-extension/nodes/plan/gather-context.md, apps/speckit-extension/nodes/plan/side-files.md, apps/speckit-extension/nodes/implement/implement-exec.md -->

Before the work that can fan out, a step SHALL ask for the briefs and then do exactly what comes back: dispatch every brief it was given, in one message and unedited, or do the work itself when it was told to work inline. Two or more pieces means workers, fewer means inline. The answer does not change because the run is unattended, because the feature is short, or because an earlier step already sent workers.

#### Scenario: an unattended run reaches the fan-out point
- **WHEN** auto runs plan and the briefs come back
- **THEN** the workers are dispatched exactly as in a manual run

#### Scenario: the host has no way to run workers
- **WHEN** the assistant has no subagent tool
- **THEN** it does each brief's work itself, in order, and the step produces the same files

### Reading the code is split by area, writing the design documents by document
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py, apps/speckit-extension/nodes/specify/draft-spec.md, apps/speckit-extension/nodes/plan/gather-context.md, apps/speckit-extension/nodes/plan/side-files.md -->

Where a change touches more than one code area, specify and plan SHALL send one read-only reader per area, and plan SHALL write each design document in its own worker once the research it builds on is on disk. Areas past the fourth share a reader, so no step runs more than four workers at once. A simple change writes its design documents inline, because the size budget leaves at most one.

#### Scenario: the spec recorded six code areas
- **WHEN** plan starts its investigation
- **THEN** four readers go out together, each carrying more than one area, and none of them writes anything

#### Scenario: research is not written yet
- **WHEN** plan would start the design documents
- **THEN** it writes the research first, because the documents are drawn from its decisions

### Each user story is built by its own worker
<!-- touches: apps/speckit-extension/nodes/implement/implement-exec.md, apps/speckit-extension/nodes/implement/_frame.md -->

Implement SHALL hand a user story to its own worker when that story owns five or more files, and build the smaller ones itself, along with setup and the final cross-cutting pass. A story is never split further: below that many files, starting a worker costs more than the work. The run SHALL say which stories it dispatched and which it kept.

#### Scenario: a story owning three files
- **WHEN** implement reaches a story phase that owns three files
- **THEN** it builds that phase itself and reports it as kept inline

#### Scenario: two stories claim the same file
- **WHEN** a story phase names a file another phase also names
- **THEN** implement reports the task list as defective and runs those two phases one after the other

### Shared groundwork goes out one wave at a time
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py, apps/speckit-extension/nodes/implement/implement-exec.md -->

The work every story depends on SHALL be built before any story starts, in waves: each wave's tasks are independent of each other, and nothing past a wave begins until every worker in it has returned. A wave of four or more tasks goes to workers, up to four of them; a smaller wave is built inline. The next wave is asked for only after the current one is finished, so a wave is always chosen from what is actually still open.

#### Scenario: the groundwork has two waves
- **WHEN** the first wave's workers return
- **THEN** the run asks again and gets the second wave, never both at once

#### Scenario: the task list has no shared groundwork
- **WHEN** the tasks have no foundational phase
- **THEN** the run is told to build them itself and continues without error

### A worker returns findings, never file contents
<!-- touches: apps/speckit-extension/scripts/dispatch-briefs.py, apps/speckit-extension/nodes/implement/implement-exec.md -->

Every worker SHALL be given only what its own piece needs: its area or its story, the part of the spec that covers it, and the requirements that govern the files it touches and no others. It SHALL return a distilled result, what it found or built, the files it touched and the tests it ran, and never the contents of a file. A worker runs only the tests its own files own, because the full suite runs once at the end.

#### Scenario: a story worker finishes
- **WHEN** its result comes back
- **THEN** it names what was built, the files and the tests, and nothing is pasted back in full

### One writer folds, workers only append
<!-- touches: apps/speckit-extension/nodes/implement/implement-exec.md, apps/speckit-extension/presets/_parts/timing.md -->

A worker SHALL only append its finished task to the run record. Merging those finishes into the run record and checking the task's box SHALL be done only by the agent that dispatched the workers, one result at a time, because merging reads and rewrites a shared file and two workers doing it at once lose each other's writes. A merge is repeatable, and the run repeats it once at each wave join so a missed finish is still picked up.

#### Scenario: three workers finish together
- **WHEN** their results return
- **THEN** each finish was appended by its worker and merged one at a time by the run, and every task shows as done

### A worker's claims are checked before anything is built on them
<!-- touches: apps/speckit-extension/nodes/implement/implement-exec.md -->

Before crossing from one wave or phase to the next, the run SHALL confirm that the files and test files a worker reported are actually on disk. A claim that does not hold up gets one more attempt with the specific correction, and a second failure stops the step rather than building the next phase on work that was not done.

#### Scenario: a worker reports a test file that is not there
- **WHEN** the run checks the claim at the join
- **THEN** that worker is re-run with the correction, and a second miss stops implement with the reason

### The task list is what makes the fan-out possible
<!-- touches: apps/speckit-extension/nodes/tasks/tasks-doc.md -->

The tasks step SHALL give every file exactly one owning phase, state each story phase's files on its own line, and lay every phase out as waves with an explicit wait line between them. Two phases naming one file is a defect to fix while writing the list. Writing the list is a single pass that never fans out.

#### Scenario: two stories would touch one file
- **WHEN** the tasks step finds a file two stories both need
- **THEN** it either moves that file into the shared groundwork phase or splits it so each story owns its own file

## Uncovered

- Whether a step's fan-out actually happened is only visible afterwards: each worker records that it started, and a step that was given briefs and shows no workers is reported later as having worked inline. Nothing stops a run from ignoring the briefs while it happens.
- The four-worker ceiling and the five-file and four-task thresholds are fixed in the shipped commands. Nothing says whether a project may change them.
