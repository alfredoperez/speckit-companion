# Research

## How to record an amendment

- **Decision**: an `amendments` list field, appended without de-dupe.
- **Rationale**: history kinds are `start|complete` in the zod schema, and the Python and TypeScript readers treat any other kind as a start, so the doctor would report an unfinished step and timing would regroup.
- **Alternatives considered**: a history kind `amended` (eight files plus every kind reader); keying entries on `what` (two amendments with the same description would merge).

## How amend replans without moving status backward

- **Decision**: dispatch plan, then converge; never write status.
- **Rationale**: the writer refuses every backward move by design. Plan rewrites `plan.md` with harmless no-op hooks, and converge appends tasks the next implement picks up.
- **Alternatives considered**: a `--reopen` writer flag (a second backward-moving writer, which the review checklist forbids).

## Where the command lives

- **Decision**: a flat command body copied from `speckit.companion.resume.md`.
- **Rationale**: no nodes folder keeps it out of the Workflow Builder, like the other side commands.
- **Alternatives considered**: `nodes/amend/` (it would appear in the builder as a pipeline command).

## How the Overview shows it

- **Decision**: one row, label "Amended", value "N times · last: <what>" (1 time, 2 times).
- **Rationale**: it matches the Extends and Replaces rows beside it.
- **Alternatives considered**: a full list (left for later, per the spec's non-goals).
