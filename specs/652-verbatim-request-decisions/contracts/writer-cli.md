# Writer CLI contract

The run record writer is `write-context.py`. This feature adds one flag and extends the decision shape.

## `--request <path|->`

Stores the original request in the run record's `request` field.

- `<path>` reads the text from that file. `-` reads it from stdin.
- Write-once: if the record already holds a non-empty request, the call changes nothing.
- Outer whitespace is trimmed. The inside of the text is stored untouched.
- A blank or whitespace-only request is a no-op and is not stored.
- Exit code is always 0, so a failed store never stops a step.
- Prints one `[companion]` line saying what happened (stored, kept the existing one, or nothing to store).

Usage from a command body. The quoted heredoc passes quotes, `$` and line breaks through untouched:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <dir> --request - <<'COMPANION_REQUEST'
<the request, exactly as the person gave it>
COMPANION_REQUEST
```

## Decision JSON

Accepted by `--decision` and by the `decisions` key of `--batch`. Both go through the same writer.

| Field | Required | Meaning |
|---|---|---|
| `decision` | yes | The answer text |
| `why` | no | The reasoning |
| `rejected` | no | The alternative not taken |
| `id` | no | Stable id, enables reopening |
| `by` | no | `agent` or a person's name |
| `at` | no | When it was answered |

The writer fills `by: "agent"` and `at` (the write time) when absent. It never guesses a person's name. A step that asks a person records their answer with `"by": "you"`.

## Id semantics

- An entry with an `id` matches a stored entry by `id`.
- Same `id`, same answer text: nothing is added.
- Same `id`, different answer: the new answer replaces the stored one in place. The old answer, with its `by`, `at`, `why` and `rejected`, goes to the end of that entry's `earlier` list, after any earlier answers it already held (oldest first).
- No `id`: de-duplicates by answer text as before, and cannot be reopened.
- No earlier answer is ever dropped.
