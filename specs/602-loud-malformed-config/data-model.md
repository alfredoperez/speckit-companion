# Data Model: A companion config the reader cannot handle fails loudly

The feature introduces no persisted entity. It reshapes two values the reader already passes around and adds one.

## Numbered line

The reader's working unit while parsing. Today it is the comment-stripped text alone; it gains the line's original position in the file.

| Field | Meaning |
| --- | --- |
| number | The line's 1-based position in the file as the user sees it, counting blank and comment lines |
| text | The line with any trailing comment removed, blank lines excluded from the list entirely |

Rule: the number is assigned before blank and comment lines are dropped, so it always matches the user's editor. The reader may rewrite a line's `text` while re-anchoring a block-mapping sequence item; its `number` never changes.

## Rejection

Raised by the reader and consumed by the loader, which already turns it into the documented warning.

| Field | Meaning |
| --- | --- |
| line | The original line number the problem was found on |
| reason | Which unsupported feature was met, in the user's words — anchors and aliases, tab indentation, block scalars, or a file the reader could not read to the end |

Rules:
- Exactly one rejection is reported per file — the first problem found. A file is either fully readable or not readable at all; there is no partial result and no list of problems.
- A rejection never escapes the loader. It is caught, worded as `malformed companion.yml (…); using shipped defaults`, and returned as a warning alongside the shipped defaults, so it can never fail the host command.

## Config

Unchanged. A readable file yields exactly the mapping it yields today; an unreadable one yields the shipped defaults, which is the empty mapping.
