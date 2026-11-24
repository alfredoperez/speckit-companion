# Research: the build bar

## Headline count

**Decision**: count steps that differ from shipped ("2 changed steps not built"); when none do, say "companion.yml changed since the last build".
**Rationale**: the panel has no record of which writes happened since the last build; changed steps is the measure the stale notice already used.
**Alternatives considered**: counting preview commands (needs a preview on every write, which flips the busy state); counting change bits per step (mixes hooks counted as numbers with flags).

## Undo per row

**Decision**: Undo only on the last write's row, when its status carries a token.
**Rationale**: the host holds one undo at a time and clears it on the next write.
**Alternatives considered**: per-row undo, which the host cannot honour.

## Problem fixes

**Decision**: Edit hook opens the hook modal; Remove hook sends `removeHook`. No "Install it".
**Rationale**: the host has no install-skill action; the design's button would do nothing.
**Alternatives considered**: a disabled Install button, which is a control that fires nothing.

## Build with a problem

**Decision**: Build stays enabled when a hook has a problem.
**Rationale**: the build only warns about a missing skill and still writes; disabling would claim the build writes nothing when it does.
**Alternatives considered**: the design's disabled Build, which does not match the host.

## Preview on review

**Decision**: opening the review sends `preview` once when no dry-run report is held.
**Rationale**: the host clears the report on every redraw, so a held report is always fresh.
**Alternatives considered**: a "See which commands change" button, one more click for the same thing.
