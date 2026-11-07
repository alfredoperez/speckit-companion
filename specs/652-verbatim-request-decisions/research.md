# Research: Keep the request verbatim, and say who decided what

## How the request reaches the writer

**Decision**: A new `--request <path>` flag reads the text from a file, or from stdin when the path is `-`. The command bodies pass it with a quoted heredoc (`--request - <<'COMPANION_REQUEST'`).

**Rationale**: Every node today writes `--batch '…'` as one single-quoted argument, so one apostrophe in a request breaks the call. A quoted heredoc passes the text through untouched, including quotes, `$` and line breaks.

**Alternatives considered**: `--set request=…` strips and coerces values (`"42"` becomes a number) and overwrites on every call. A batch key inherits the same single-quote problem.

## Who stores the request

**Decision**: Auto's `resolve-dir` stores it from auto's own input; specify's `resolve-dir` (both variants) stores it from specify's input. The writer keeps the first one and ignores later writes.

**Rationale**: Auto hands specify a restatement, so if only specify stored it, every auto run would record a paraphrase. Write-once makes the order safe: auto writes first, specify's later write is a no-op.

**Alternatives considered**: Storing it in specify's `finalize` loses it when a run fails before the wrap-up, and runs after auto's restatement.

## Decision identity and reopening

**Decision**: Decisions get their own writer, `append_decisions`. A new entry gets `by: "agent"` and `at: <now>` when absent. An entry with an `id` matches a stored entry by `id`: the same answer text adds nothing; a different answer replaces it in place and carries the old answer (with its `by`, `at`, `why`, `rejected`) at the end of its `earlier` list, after any earlier answers the old entry held. An entry without `id` keeps today's de-dup on the answer text.

**Rationale**: History only grows: no answer is ever dropped, and the current one keeps its place in the list so numbering in the Overview is stable. Keeping `append_capture_entries` untouched protects verified and concerns, which share it.

**Alternatives considered**: Appending a second entry with a `reopens` pointer keeps the list flat but makes every reader resolve the chain. A top-level `decisionHistory` splits one fact across two fields.

## Who a person is

**Decision**: A Companion step that stops to ask a person records their answer with `"by": "you"`. The writer never guesses a name.

**Rationale**: The step does not reliably know the person's name, and `git config user.name` names the machine's committer, not necessarily who answered. "you" reads correctly to the person reading their own record.

**Alternatives considered**: `git config user.name`, rejected for the reason above.

## Showing the time

**Decision**: The view formats `at` with the existing `formatAbsolute` helper ("Nov 3, 10:12") and hides the meta when it returns `unknown`.

**Rationale**: It is already used by the Phases card, so the dossier does not grow a third date format.

**Alternatives considered**: The dossier's local `completedLine` includes the year and pins locales; it is meant for a single completion line.

## Captures

**Decision**: The shared teamboard fixture stays as it is. New stories in `ActivityPanel.stories.tsx` carry a request, an agent decision, a person's decision and a reopened one.

**Rationale**: Changing the fixture would move every Overview capture (SC-004 wants them unchanged), for no gain in this slice.
