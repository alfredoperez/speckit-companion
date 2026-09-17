# Research: Living spec surface

## Reshape living mode, not a new webview

**Decision**: render the surface through the spec viewer's existing living mode.
**Rationale**: living mode already owns card wrapping (`preprocessLivingRequirements`), scenario colouring, rail pips, the living footer, and the tree's open path (`speckit.viewSpecDocument` with `{ living: true }`). The issue's "own surface" is about the unit being the requirement; the viewer's comment and refine machinery is already off in living mode. LV-9 retires the leftovers.
**Alternatives considered**: a new webview panel. Rejected: it duplicates the renderer, the rail, the footer and the open path for no visible difference in LV-1.

## Per-card drift is computed in the extension

**Decision**: `pushLivingHealth` sends `driftedRequirements: string[]` (headings) alongside `drifted`.
**Rationale**: `readDriftedFiles` and the capability glob matcher already run in the extension. Touches markers are globs; matching them in the webview would need a second matcher.
**Alternatives considered**: send the drifted file list and match in the webview. Rejected for the duplicate matcher.

## Adopted and drifted together

**Decision**: drifted wins the edge; the header counts both.
**Rationale**: drift is the state that needs action first. The spec's edge cases pin this.

## Validate

**Decision**: a `speckit.livingSpecs.validate` command dispatching `/speckit.companion.living-validate <capability>` through the terminal, the same way sync dispatches.
**Rationale**: no validate command exists in the extension; the companion command does.
**Alternatives considered**: reuse drift. Rejected: drift is a different check with a different output.

## Sync

**Decision**: the bar's Sync sends the existing `livingUpdate` (capability-scoped update to match code), shown only when drifted.
**Rationale**: that is the repair the tree row offers for a drifted capability. The whole-project `livingSyncAll` stays in the tree title bar.

## Adopted tooltip

**Decision**: the state word carries a `title` with the adopted source, escaped for attributes (quotes included).
**Rationale**: `escapeHtml` does not escape quotes. The source comes from the spec file, so it is user data inside an attribute.

## Watcher gap

**Decision**: the tree's capability-file watcher also calls the viewer's `refreshIfDisplaying`.
**Rationale**: the viewer's own watcher only matches the spec directory, so a capability under `capabilities/**` or colocated never redraws.
