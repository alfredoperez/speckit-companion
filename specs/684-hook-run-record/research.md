# Research: A record of which hooks ran

## Where the record lives

**Decision**: a new top-level append-only list, `hookRuns`, in `.spec-context.json`.
**Rationale**: every history reader (Python `_entry_kind`, the viewer's `entryKind` and `isStepLevelEntry`) reads a row with no `substep`, no `task` and an unknown `kind` as a step start. A hook row in `history[]` would start a step on every hooked run unless every reader in Python, the host, the viewer package, the canvas and the Claude Code mod learned to skip it.
**Alternatives considered**: a `history[]` row with `kind: "hook"` (rejected: five readers to change, one missed corrupts step timing); `.spec-context.events.jsonl` (rejected: it is folded into history and only carries task finishes).

## How the record gets written without a new turn

**Decision**: a `--hook-outcome` flag on `write-context.py` that rides on any call, like `--set`. The rendered hook tells the assistant to add it to its next writer call.
**Rationale**: the cost of this pipeline is turns times carried context. Every Companion step makes writer calls after its hooks: a wave close, a batch, the step close the timing rule puts after any after-hook. So a record normally adds a few words to a call already being made, and zero calls.
**Alternatives considered**: a dedicated call per hook (rejected: one more turn per hook); folding it into `--batch` only (rejected: the batch sits mid-step, before most after-hooks).

## The shape of the flag

**Decision**: `<step>/<when>/<anchor>/<index>/<type>[:<ref>]=<ran|skipped>[: <reason>]`, rendered whole by the build.
**Rationale**: the build knows every part; the assistant only picks the outcome. A slash path is shorter than JSON and needs no quoting. Type and ref are kept so a reader can tell a record of a hook that has since moved.
**Alternatives considered**: a JSON object (longer in every hook block); the slot id alone with the writer looking the hook up in `companion.yml` (wrong once the configuration changes after the run).

## What the prompt costs

Measured on the rendered block: one line, about 30 words, per hook. The repo's own configuration renders 8 hooks across 4 steps, so a full auto run carries about 240 more words of instruction and no extra call when each hook is followed by a writer call, which every shipped step makes.

## "Most recent run"

**Decision**: the spec whose record has the newest `at` across `history` and `hookRuns`.
**Rationale**: folder numbers do not order runs (a re-run of an old spec is newer), and file mtimes move on checkout.
