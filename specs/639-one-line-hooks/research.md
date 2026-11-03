# Research: One-line journaling hooks

## Translate the hook into today's flags

- **Decision**: `--hook start|finish --step <s>` rewrites the parsed arguments into today's `--kind`, `--status` and `--tasks-file` values early in `_main()`, then the existing flow runs.
- **Rationale**: the history written is then identical to today's by construction, and tracing, the plan check and the output line keep working with no new branch.
- **Alternatives considered**: a separate dispatch branch. Rejected: it would re-implement the post-write steps and drift.

## Save the specify start outside the project

- **Decision**: `--hook start --step specify` writes the clock to a file named by a hash of the project root inside the writer's lock root, and `--hook finish --step specify` records it as the start, then deletes it. A saved time more than an hour older than the new folder is ignored.
- **Rationale**: the folder does not exist at `before_specify`, the file must never show in git, and two projects must not share a clock.
- **Alternatives considered**: a file under `.specify/`. Rejected: it shows in `git status`. Keeping the time in the assistant's head. Rejected: that is the step that gets lost.

## Hook mode always exits 0

- **Decision**: any non-zero exit inside a `--hook` call is reported and turned into 0.
- **Rationale**: a hook that fails the host command breaks a stock run over bookkeeping.
- **Alternatives considered**: keeping exit 2 for caller errors. Rejected for hooks: the caller is a page the assistant reads, not a person.
