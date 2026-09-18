# Research: Requirement Coverage Badges

## How a coverage line is joined to a requirement

**Decision**: Join by heading text first, through the shared `requirementKey`, and by `FR-nnn` id when the requirement's heading or body carries one. A coverage line counts only when it names a test, by the same test-reference rule the header count uses.

**Rationale**: The cards key on the heading, and every living spec in this repo names requirements by heading with no id. The header count today recognises ids only, so an id-only join would leave every real card blank, which is the bug again.

**Alternatives considered**: Reuse `readCoverageCount` as is. Rejected: it returns one number and knows nothing about headings.

## What the label says

**Decision**: `N tests` when every named test path exists, `F/N tests` when only some do, singular `1 test`. A requirement whose line names no test gets no entry. A requirement whose named tests are all missing gets `0/N tests`, which the card draws, because "named but not found" is a different fact from "not mapped".

**Rationale**: The living spec rule says a label names how many were found when several tests are named, and that a missing test must read differently from an unmapped requirement. The stories already use `3/4 tests`.

**Alternatives considered**: A bare count. Rejected: it hides missing tests. Checking test names inside files. Rejected: the rule is about the file existing, and a content check is slow and brittle.

## Where the existence check runs

**Decision**: In the extension, with plain filesystem checks, each path confined to the workspace. No git call, so no timeout is needed.

**Rationale**: The webview cannot read the disk. The living-specs model already confines resolved paths to the workspace.

## How stale labels are cleared

**Decision**: The webview clears the map when the panel's nav state names a different spec path, and replaces it on every health message, including with nothing when the field is absent.

**Rationale**: The provider skips the health message when nothing resolved. Without an explicit clear, a capability with no coverage file would keep the previous capability's labels on any heading the two share.

**Alternatives considered**: Always post a health message. Rejected: it changes today's behaviour for capabilities with no facts, which FR-006 forbids.

## Attribute safety

**Decision**: The label is built by the extension from two integers and fixed words, never from file text.

**Rationale**: The card writes the label into a `data-req-coverage` attribute through an escape that does not cover quotes. A label made of digits and fixed words cannot break out, so the renderer stays untouched.
