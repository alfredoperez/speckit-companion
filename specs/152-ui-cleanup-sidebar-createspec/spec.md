# UI cleanup: distinct sidebar install icon + ordered title-bar icons; Create-Spec touchups

## Overview

Tighten two surfaces found while testing. In the SpecKit sidebar title bar, give the install action a glyph distinct from the upgrade action and reorder the title-bar actions into sensible groups with dividers. In the Create-Spec webview, remove the unused Load Template control entirely, shorten the turbo workflow option label to a single word while preserving its full description on hover, and make the panel wrap gracefully at narrow widths instead of overflowing horizontally.

## Functional Requirements

- **FR-001**: The sidebar install action MUST use a codicon visually distinct from the upgrade action's codicon, so the two are distinguishable when the install state toggles. (Title-bar icons are monochrome-themed; distinctness is by glyph, not color.)
- **FR-002**: The `view/title` actions for the specs explorer view MUST be ordered into distinct menu groups so VS Code renders dividers between them: create, list-view controls (filter, clear-filter, sort, collapse/expand), and install/upgrade.
- **FR-003**: The Load Template button MUST be removed from the Create-Spec panel along with every supporting artifact: the button markup, the `requestTemplateDialog` / `loadTemplate` / `templateLoaded` message types, the extension-side handler methods, the webview click wiring and message handling, the CSS for the button/loader, and the Storybook/mock representation.
- **FR-004**: Removing Load Template MUST NOT leave dead code, unreferenced message types, orphaned commands, unused CSS classes, or stale mocks.
- **FR-005**: The turbo workflow picker option's visible label MUST read `Turbo` (with the `(beta)` suffix omitted from the visible label), while the full descriptive text MUST remain available as the option's hover tooltip/description.
- **FR-006**: The turbo workflow option value MUST remain `speckit-turbo` (unchanged).
- **FR-007**: The `.workflow-row` and `.image-attachment-header` layouts MUST wrap (rather than overflow) at narrow viewport widths, using `flex-wrap` and `min-width:0`/ellipsis where a child can overflow; the responsive breakpoint MUST cover these rows, not only the footer actions.

## Success Criteria

- **SC-001**: The install and upgrade title-bar actions render with different glyphs (verifiable by inspecting the two `icon` codicon ids in `package.json`).
- **SC-002**: The specs explorer `view/title` entries resolve to at least three distinct `navigation@N` group numbers, producing dividers between create, list controls, and install/upgrade.
- **SC-003**: A repository-wide search for `loadTemplate`, `requestTemplateDialog`, `templateLoaded`, `LoadTemplate`, `load-template`, and `Load Template` returns zero matches in shipping source, styles, mocks, and `package.json`.
- **SC-004**: The turbo option's visible text is exactly `Turbo`; its tooltip/description contains the full descriptive sentence.
- **SC-005**: `npm run compile` and `npm test` pass (excluding the 6 known pre-existing Python `test_context.py` failures unrelated to this change).
- **SC-006**: At a narrow panel width the Create-Spec workflow row and image-attachment header wrap onto multiple lines with no horizontal overflow.

## Assumptions

- The chosen distinct install glyph is `$(desktop-download)` (a download-to-disk glyph that reads differently from the upgrade `$(cloud-download)`).
- "Full description on hover" is satisfied by the existing `<option title="...">` rendering path; only the option's `description` text needs to carry the full label, since the visible `displayName` becomes `Turbo`.
- No automated test currently asserts on the Load Template message types or the turbo `displayName`, so their removal/change requires no test rewrite (verified by grep before editing).
- The Storybook representation of Load Template lives only in the `CreateSpecMock` component and is not asserted by any test.
