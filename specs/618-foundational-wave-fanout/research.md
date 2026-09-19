# Research: Implement fans out large Foundational waves

## Where the decision lives

- **Decision**: a `--waves` mode of `dispatch-briefs.py` decides which Foundational waves go to workers and prints their briefs.
- **Rationale**: #758 showed that an unattended run argues its way out of prose that says "dispatch when…", and that a printed brief gets dispatched. It also keeps the implement node under the 1,000-word limit, which is at 993 today.
- **Alternatives considered**: a prose rule in step 3 (argued away, and no words left for it); a new script (duplicates the check-in and trace plumbing).

## What a wave is

- **Decision**: a wave ends at a `**⟶ Wait` join line, a `###` block heading or a `**Wave N` header, and the phase ends at the next `##` heading. Task lines use the shared task grammar (bold or plain, `-`/`*`/`+` bullets, fenced code skipped).
- **Rationale**: a `### Tests` block and the `### Implementation` block after it have no join line between them, but the tests are written first and must fail before the code exists; merging them would hand a test and its code to workers at the same time. Spec 612's Foundational phase reads as 7, 4, 4, 4, 1.
- **Alternatives considered**: splitting on join lines only (first draft: merged spec 612's tests and implementation into one 11-task wave; review round one caught it). A join test on any line containing `⟶ Wait` (a task that quotes the phrase was read as a join).

## How a qualifying wave is split

- **Decision**: at most four workers per wave, tasks dealt round-robin, never across a join line.
- **Rationale**: four matches the reader cap from #758 and keeps a seven-task wave to four startups rather than seven.
- **Alternatives considered**: one worker per task (startup cost dominates; the node warns against per-task fan-out for exactly that reason).

## The threshold

- **Decision**: four tasks.
- **Rationale**: the issue's example sits at four, and three or fewer mirrors the thin-phase case measured as costing twice as much for nothing. The speed claim needs the benchmark the issue names and is not made here.

## The tally

- **Decision**: `.claude/scripts/subagent-tally.py` imports the wave splitter from `dispatch-briefs.py`.
- **Rationale**: one definition of a wave, read by the instruction and by the measurement.
