# Research: Living Viewer Fixes

## 1. Where the banner drop lives

**Decision**: In `approveLivingText`, a whole-spec approve (no heading) always runs the banner drop. The function returns `null` only when neither a marker nor the banner changed. A per-heading approve keeps today's rule: the banner goes with the last marker.
**Rationale**: It has one caller, `handleLivingApprove`, so the fix lands where every approve passes through. The handler already offers Undo for the whole-tier case, so a zero-marker approve gets Undo for free.
**Alternatives considered**: A second "clear draft" message. Rejected: a new route for what is one early return.

## 2. How the bar knows the spec is a draft

**Decision**: `LivingFooter` reads the draft state the provider already sends for the badge, and shows approve when the spec is a draft or the adopted count is above zero.
**Rationale**: `specViewerProvider` already computes `isLivingDraft` and ships it as the badge. No new protocol field.
**Alternatives considered**: A `livingMeta.draft` flag. Rejected unless the badge state turns out not to reach `navState`; then add that one boolean.

## 3. Marker pass-through

**Decision**: Widen the one regex in `preprocessHtmlComments` and the matching `TOUCHES_MARKER_LINE` in the renderer to `touches|adopted|reviewed|aligns|capability`.
**Rationale**: Once the reviewed marker stops expanding into a seven-line disclosure, the banner is back inside the ten-line window. The window itself does not need to change.
**Alternatives considered**: Widening the scan window. Rejected: it hides the disclosure bug and the grey bar would still render.

## 4. Rail dots

**Decision**: The dot is a state mark only. `toc.ts` emits it when the card is drifted, adopted or new, reading `data-req-new` for the last one, with drifted winning over adopted over new. Confirmed rows get no dot. The coverage dot and its unknown ring go. The words stay in the row's accessible name.
**Rationale**: `new` never reached the rail, so its CSS rule was dead. Coverage already shows in the header.
**Alternatives considered**: Keeping a coverage dot beside the state dot. Rejected by the issue.

## 5. Tree grouping and labels

**Decision**: `buildCapabilityTree` counts capability specs per folder. A spec whose folder holds two or more keeps that folder as its last group segment. Otherwise the folder collapses as today. The model puts a `label` on each leaf and group: `readableName`, with leaves in one group passed through `stripSharedLeadingWords`.
**Rationale**: Labels in the model are testable without the VS Code mock. The provider only picks icons.
**Alternatives considered**: Stripping in the provider. Rejected: it would need the sibling list the model already has.

## 6. Shared naming util

**Decision**: `src/core/utils/capabilityNames.ts` exports `readableName(name)` and `stripSharedLeadingWords(labels)`. The Overview card uses `readableName` on the full capability name, with no prefix strip.
**Rationale**: A card chip has no siblings to share a prefix with, and a bare `Living` chip would not say which area it belongs to. The same function still makes both surfaces agree on casing and word breaks.
**Alternatives considered**: Sending tree labels over the wire. Rejected: new payload for a cosmetic gain.

## 7. Overview groups

**Decision**: `LivingSpecLinks` splits its chips by `synced` into two labelled lists, **Updated by this run** and **Read for context**, and omits an empty one. The `folded back` span and its CSS are deleted.
**Rationale**: The chip already carries `synced`. No data change.
