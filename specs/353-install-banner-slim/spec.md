# Feature Specification: Slim, dismissible install banner

**Feature**: `353-install-banner-slim`
**Issue**: #353 — make the "install spec-kit extension" banner less invasive

## Summary

The prompt that nudges a user to install the companion spec-kit extension currently shows up as a large bordered card — a rocket icon, a heading, two lines of body text, and two buttons stacked together. It sits at the top of both the Create-Spec view and the spec-viewer Activity panel, on every visit, with no way to make it go away. Once a user has decided (installed the extension, or chosen to skip it), that big card is pure friction. This feature slims the banner down to a single compact line and gives it a dismiss control that remembers the choice everywhere.

## User Scenarios & Testing

### User Story 1 - Dismiss the banner for good (Priority: P1)

A developer who has seen the install prompt and doesn't want it anymore clicks a small "×" on the banner. The banner disappears immediately, and it stays gone — on this project and every other project they open — even after reloading the window or reopening the editor.

**Why this priority**: This is the core of the issue. The banner being permanently dismissible is what removes the recurring friction; without it the change has no value.

**Independent Test**: Open Create Spec (or the Activity panel) in a project where the spec-kit extension is not installed. Confirm the banner shows. Click the "×". Confirm it disappears, reload the window, and confirm it does not come back. Open a *different* project and confirm it is also absent there.

**Acceptance Scenarios**:
1. **Given** the spec-kit extension is absent and the banner has never been dismissed, **When** the user opens Create Spec, **Then** the slim banner is shown.
2. **Given** the slim banner is shown, **When** the user clicks the dismiss control, **Then** the banner is hidden without a reload.
3. **Given** the user dismissed the banner, **When** they reload the window or open any other workspace, **Then** the banner does not reappear.
4. **Given** the user dismissed the banner, **When** they open the spec-viewer Activity panel, **Then** the banner is also absent there (one dismissal covers both surfaces).

### User Story 2 - A lighter, single-row banner (Priority: P1)

A developer opening Create Spec or the Activity panel sees a compact one-line hint instead of a tall bordered card: a small glyph, one short sentence, an Install action, and a "Learn more" link, all on one row. It takes far less vertical space above the thing they actually came to do.

**Why this priority**: "Smaller footprint" is the other half of the requirement. Even before dismissal, the banner should stop dominating the panel.

**Independent Test**: Open Create Spec with the extension absent and the banner not dismissed; confirm the banner is a single compact row (glyph + one line + Install + Learn more + dismiss), not the old icon/heading/paragraph/two-button stack.

**Acceptance Scenarios**:
1. **Given** the banner is shown, **Then** it presents as a single compact row with a glyph, one short line of text, an Install action, a Learn more link, and a dismiss control.
2. **Given** the banner is shown, **When** the user clicks Install, **Then** the existing install flow runs (unchanged).
3. **Given** the banner is shown, **When** the user clicks Learn more, **Then** the README opens (unchanged).

### User Story 3 - Same behavior on both surfaces (Priority: P2)

The Create-Spec view and the Activity panel show the same slim banner and honor the same dismissal. A change to the look or the gating applies to both surfaces without divergence.

**Why this priority**: The two surfaces render the banner through different code paths (server-rendered HTML vs. a Preact component). Keeping them consistent is required, but it is a correctness property of stories 1 and 2 rather than a separate user-facing feature.

**Independent Test**: Eyeball both surfaces back to back; confirm identical slim look and that dismissal on one hides it on the other.

**Acceptance Scenarios**:
1. **Given** the extension is absent, **Then** both the Create-Spec banner and the Activity-panel banner render in the same slim form.
2. **Given** the banner is dismissed on either surface, **Then** both surfaces hide it.

## Edge Cases

- The extension is already installed → the banner never shows, regardless of the dismiss flag (the existing absence gate still wins first).
- The dismiss flag has never been set → treated as not-dismissed (banner shows when the extension is absent).
- The user dismisses, then later installs and uninstalls the extension → the banner stays dismissed (a permanent user choice; re-surfacing on a new reason is explicitly out of scope for this change).
- A click lands on the row but not on the dismiss control → only the matching action runs; a click on empty banner area does nothing.

## Requirements

### Functional Requirements

- **FR-001**: The install banner MUST render as a single compact row containing a glyph, one short line of text, an Install action, a Learn more link, and a dismiss control — not the prior icon/heading/paragraph/two-button stack.
- **FR-002**: The banner MUST include a dismiss control that hides the banner immediately when activated.
- **FR-003**: Dismissing the banner MUST persist the choice in the extension's global state (not workspace state), so it stays dismissed across all workspaces and across reloads.
- **FR-004**: The banner MUST be shown only when the spec-kit extension is absent AND the banner has not been dismissed. The existing absence gate continues to take precedence.
- **FR-005**: Both the Create-Spec view and the spec-viewer Activity panel MUST honor the same slim look and the same dismissal state.
- **FR-006**: The Install and Learn more actions MUST continue to behave exactly as before (run the install flow / open the README).
- **FR-007**: The dismiss control MUST carry an accessible label so assistive technology announces its purpose.
- **FR-008**: The webview MUST send a dismiss message to the extension when the dismiss control is activated; the extension MUST set the global-state flag and re-render the affected surface without the banner.

### Key Entities

- **Install-banner dismissed flag** — a single boolean stored in the extension's global state. Absent/false means "show when the extension is missing"; true means "never show again."

## Success Criteria

### Measurable Outcomes

- **SC-001**: When the extension is absent and the banner is not dismissed, the banner occupies a single row rather than the multi-line card (vertical footprint visibly reduced).
- **SC-002**: After a user dismisses the banner once, it does not reappear in 100% of subsequent opens — across reloads and across different workspaces.
- **SC-003**: When the extension is installed, the banner shows 0% of the time, unchanged from today.
- **SC-004**: The Install and Learn more actions succeed at the same rate as before the change (no regression in the install / README flows).

## Assumptions

- A dismissal is permanent. Re-surfacing the banner when "a new reason appears" (mentioned as optional in the issue) is out of scope for this change.
- The dismiss flag is a single global boolean; no per-surface or per-version dismissal is needed.
- The banner remains static markup with no user-supplied data, so the existing escaping approach is sufficient.

## Verbatim Constraints

- Global-state key suffix: `installBannerDismissed` (added alongside the existing `speckit.globalState.*` keys).
- The dismiss control is rendered with an `aria-label`.
- The banner must NOT be modified under `speckit-extension/`; the `package.json` version must NOT be bumped.
