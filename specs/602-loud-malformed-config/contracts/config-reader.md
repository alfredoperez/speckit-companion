# Contract: the companion config reader

Two entry points, both in `speckit-extension/scripts/companion_config.py`. This contract states what callers may rely on after this change; everything not listed here is unchanged.

## `load_yaml(text)`

Parses the constrained subset — block maps, block sequences, inline flow maps and sequences, quoted and bare scalars — into nested dictionaries and lists.

**Accepts**, exactly as it does today:

- Any file it accepts today, producing an identical result.
- A `#` inside a quoted scalar, which stays part of the value.
- An inline flow value containing `&`, `*`, `|` or `>` — for example `exempt: ["*.config.*"]`.
- An unquoted value whose first token is ordinary text but which contains those characters later — for example `run: echo a && b` or `run: cmd > log`.
- An unquoted glob, in a value or a block sequence item — for example `- *.config.*`. A glob is not an alias name, so it keeps parsing as the string it is today.
- An empty document, or one that is only comments, which reads as an empty mapping.

**Raises `ValueError`** naming the original line number, for:

- A key or unquoted value whose first token is `&` or `*` followed by a plain name — an anchor or an alias.
- A tab character in a line's leading whitespace.
- An unquoted value that is exactly a block-scalar indicator: `|`, `>`, optionally followed by a chomping marker or an indentation digit.
- A document separator, and any other line the parser cannot place — the existing behavior.
- Any file the parser did not read to its last line.

The message form is `line <n>: <reason>`. Callers must not parse the reason text; it exists for the person reading the warning.

## `load_config(path)`

Returns `(config, warnings)`.

| Condition | Returns |
| --- | --- |
| No file at `path` | `({}, [])` — shipped defaults, silently |
| A readable file | the parsed mapping, `[]` |
| A file `load_yaml` rejects | `({}, ["malformed companion.yml (…); using shipped defaults"])` |
| A file whose top level is not a mapping | the same malformed result |

Guarantees:

- Never raises, whatever the file contains. A configuration problem can never fail the command that read it.
- Never returns a partially-applied config. The mapping it returns is either everything the file declared or nothing at all.
- Exactly one warning per rejected file.

## Verbatim strings

- `malformed companion.yml (…); using shipped defaults` — the warning prefix and suffix are unchanged; only the parenthesised reason is new.
- `.specify/companion.yml` — the config path, unchanged.
