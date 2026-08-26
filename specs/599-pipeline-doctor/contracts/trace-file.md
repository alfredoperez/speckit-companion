# Contract: the self-trace file

## Location and lifecycle

- Path: `specs/NNN/.trace.jsonl` — one file per spec directory, exactly as the request pins it.
- Created lazily on the first traced call for that spec. Never created for a call that could not resolve a spec directory; those lines are dropped rather than written to a guessed location.
- Alongside the first write, `trace.py` ensures `specs/NNN/.gitignore` contains `.trace.jsonl`. The write is idempotent and skipped when an existing rule already covers the file.
- Size-capped. On overflow the file is rewritten newest-first-preserved with one `{"truncated": <dropped-count>}` marker line at the top.
- Never deleted by any command. Removing it is a user action, and a missing file is a skipped check, never an error.

## Line format

One JSON object per line, newline-terminated, UTF-8, no trailing whitespace:

```json
{"at":"2026-08-26T00:51:12Z","tool":"write-context","op":"lifecycle","ok":true,"reason":null,"spec":"specs/599-pipeline-doctor","files":["specs/599-pipeline-doctor/.spec-context.json"],"bytes":4182,"in_bytes":214,"ms":11}
```

A declined call carries the reason verbatim from the message the script already prints:

```json
{"at":"2026-08-26T00:51:19Z","tool":"write-context","op":"unknown","ok":false,"reason":"Could not resolve the active feature directory (checked --feature-dir, SPECIFY_FEATURE_DIRECTORY, SPECIFY_FEATURE, .specify/feature.json, git branch prefix).","spec":null,"files":[],"bytes":0,"in_bytes":180,"ms":2}
```

## Writer guarantees

- **Never raises.** Every failure inside the tracer is swallowed; a trace that cannot be written must not break the call it was observing. This is the strictest form of the runtime's never-fail-the-host contract, because the tracer runs on paths that are already failing.
- **Never blocks meaningfully.** A single append per call, opened in append mode, target well under a millisecond and budgeted at ~1ms.
- **Adds no prompt weight.** No command body gains a single word for tracing. The tracer is invoked from inside the scripts the bodies already call.
- **Stamps its own clock.** `at` and `ms` come from the tracer, never from a caller.

## Reader guarantees

- Unparseable lines are counted and skipped; the count is reported, never silently absorbed.
- A `truncated` marker makes the reader report counts as "at least N", never as exact totals.
- The reader is the doctor and only the doctor. No production code path may branch on trace contents.
