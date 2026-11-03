# Research: A clean converge completes the spec

## An unchanged task list means a clean converge

- **Decision**: converge counts as clean when `tasks.md` was not modified after converge's start.
- **Rationale**: converge records its findings by appending tasks; no other signal is written.
- **Alternatives considered**: counting tasks at start and finish. Rejected: needs a new stored field for the same answer.

## Gate in the hook, write in the existing writer

- **Decision**: the converge finish hook checks status `implemented`, all tasks checked and the clean window, then calls `mark_spec_complete(feature_dir, "extension")`.
- **Rationale**: `mark_spec_complete` is the only sanctioned writer of `completed`, but it does not itself re-check tasks on an `implemented` spec.
- **Alternatives considered**: a second completion path. Rejected: two writers of a terminal status.

## The page drops living-spec bookkeeping

- **Decision**: the mark-complete page is one sentence and one call.
- **Rationale**: implement's final node already accounts for living specs and writes `completed`, so the page only matters as a manual fallback.
- **Alternatives considered**: keeping the accounting on the page. Rejected: living specs are being retired (#934) and the node already owns it.
