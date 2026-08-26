# Research: A companion config the reader cannot handle fails loudly

## What actually happens today

The reader in `speckit-extension/scripts/companion_config.py` walks the file with a cursor (`pos`) over the non-blank, comment-stripped lines. `_parse_map` and `_parse_seq` each stop the moment they meet a line whose indentation is not their own. When the file then contains something no branch claims, the cursor simply stops advancing and every enclosing frame unwinds — `load_yaml` returns whatever was gathered up to that point and never looks at the rest of the file. `load_config` warns only when `load_yaml` raises, so an early stop is indistinguishable from a complete parse.

Reproducing the issue's config confirms it: `specify: &shared` is read as the ordinary string `"&shared"`, the anchored `hooks:` block underneath it is at an indentation no open frame accepts, so parsing halts there and `plan: *shared` is never seen. No exception, no warning.

The same probe over the other shapes the issue names:

| Shape | Today |
| --- | --- |
| Anchor / alias (`&name` / `*name`) | Parsed as a plain string; the rest of the file is silently dropped |
| Tab indentation | Every line collapses to the top level (a tab is not a space, so indentation reads as zero) — a silently wrong config, no truncation to betray it |
| Block scalar (`|`, `>`) | The indicator is read as the value; the block's real lines are silently dropped |
| Document separator (`---`, `...`) | Already raises — the line has no `:` and `_parse_map` rejects it |

## Decision: detect the unsupported token, do not support it

**Decision**: Recognise anchors, aliases, tab indentation, and block-scalar indicators as unsupported, and raise so the existing malformed path reports them.

**Rationale**: The failure table already has the right answer for "this file cannot be read" — one warning plus shipped defaults. What was missing was the reader noticing. Detection is a handful of line-shape checks; the reporting machinery is already built and already tested.

**Alternatives considered**: Implementing real anchor support. Rejected — merge keys, nested anchors and recursive aliases are a substantial reader, and a hook config gains almost nothing from reuse syntax. Swapping in PyYAML was never on the table: the runtime is stdlib-only by contract, because it executes inside the user's own pipeline.

## Decision: a general "did we read the whole file?" backstop

**Decision**: After parsing, treat any unread line as a hard failure.

**Rationale**: Named-token detection catches the four shapes we know about; it cannot catch the fifth one nobody has hit yet. The cursor stopping short is the *mechanism* behind every silent truncation, so checking it directly converts the entire class — present and future — into a loud failure. It is also what makes the anchor case fail even before the anchor check reads the line.

**Alternatives considered**: Relying on token detection alone. Rejected — it leaves the defect's actual mechanism in place and only patches the spellings we happened to enumerate.

## Decision: reject the file, never apply the readable part

**Decision**: A file with unsupported syntax contributes nothing; the caller gets the shipped defaults.

**Rationale**: This is the issue's central point. A half-applied config is worse than none, because the user reads their file and believes all of it is live.

**Alternatives considered**: Applying the part above the failure and warning about the rest. Rejected — it keeps the misleading state the report is about, and makes the outcome depend on where in the file the mistake sits.

## Decision: anchor the checks at the start of a value, not anywhere on the line

**Decision**: Only the first token of a key or a value is examined, and only when that value is unquoted and not inline flow.

**Rationale**: This is what keeps the change from narrowing. `run: echo a && b` contains an ampersand, `exempt: ["*.config.*"]` contains an asterisk, `run: cmd > log` contains a redirect — none of them is an anchor, an alias or a block scalar, and all three must keep parsing exactly as they do now. A YAML anchor or block indicator can only appear where a value begins, so that is the only place worth looking.

**Alternatives considered**: Scanning the whole line for the marker characters. Rejected outright — it would break shell commands and globs, the two things a hook config is most full of.

## Note on the one deliberate narrowing

An unquoted value that is `&` or `*` followed by a plain name is currently accepted as a string, and after this change it is rejected. That spelling is invalid in real YAML too — every conforming parser reads it as an anchor or an unknown alias and errors — so a file relying on it works only under this reader. Rejecting it loudly aligns the reader with the rest of the YAML world and is the behavior the issue asks for; a value genuinely meant as text is written in quotes and is unaffected.

The name has to be a *plain* one for exactly this reason. A hook config and a capability registry are full of globs, and an unquoted `- *.config.*` in a block sequence parses today as the string it looks like. Requiring the name after the marker to be letters, digits, underscores and dashes keeps every such glob accepted while still catching `*shared`, which is the shape the report is about.
