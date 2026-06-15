# Install Banner Responsive

## Overview

The "Install spec-kit extension" banner shown in the Create-Spec and Activity panels reads as broken when the panel is narrow: its heading and body get crushed into a thin column and wrap into many one- or two-word lines while the action buttons hold the right edge. This change makes the banner adapt to the panel width so its text stays readable at any size, with the action buttons dropping below the text when space is tight.

## Functional Requirements

- **FR-001** When the banner has enough horizontal room, the system MUST keep the current side-by-side layout: icon and text on the left, action button and "Learn more" link on the right.
- **FR-002** When the banner is narrower than a defined threshold, the system MUST move the action button and "Learn more" link onto their own full-width row below the text, so the heading and body get the full panel width.
- **FR-003** The body paragraph MUST always wrap normally across the available width and MUST NOT be truncated, since it is explanatory.
- **FR-004** The body and heading MUST NOT wrap into a column of one- or two-word lines at any supported panel width.
- **FR-005** If the heading cannot fit on its line, the system MUST truncate it with an ellipsis and expose the full heading text on hover (tooltip), using a complete single-line-truncation style so it never silently wraps.
- **FR-006** The responsive behavior MUST respond to the banner's own container width, not the editor viewport width, so it adapts correctly regardless of how wide the host window is.
- **FR-007** The change MUST apply identically in both the Create-Spec panel and the Activity panel, since both render the same banner.
- **FR-008** The banner's existing actions (running the install, opening the README) and its accessibility role/label MUST continue to work unchanged.

## Success Criteria

- **SC-001** At a narrow panel width, no line of the banner heading or body contains only one or two words solely because of layout cramping; the text uses the full available width.
- **SC-002** At a narrow panel width, the action button and "Learn more" link appear below the text rather than beside it.
- **SC-003** At a comfortable panel width, the layout is visually unchanged from today (actions remain to the right of the text).
- **SC-004** When the heading is truncated, hovering it reveals the complete heading text, and the heading occupies a single line (never wraps).
- **SC-005** Both the Create-Spec and Activity panels show the same corrected behavior when checked at narrow, medium, and wide widths.

## Assumptions

- A single width threshold (around 420px of banner width) cleanly separates the stacked layout from the side-by-side layout; the exact value can be tuned during implementation without changing the requirements.
- A native browser tooltip (the element's `title`) is an acceptable mechanism for surfacing the full heading text; no custom tooltip component is required.
- Container-query support is available in the VS Code webview runtime targeted by the extension, so the banner can respond to its own width rather than the viewport.
- This is a CSS-and-markup presentation change only; no extension command, message, or stored state changes.

## Approach

- Make `.install-banner` its own query container (`container-type: inline-size`) and allow it to wrap (`flex-wrap: wrap`) in `webview/styles/spec-viewer/_install-banner.css`.
- Add a `@container (max-width: ~420px)` rule that gives `.install-banner__actions` a full-width basis so it wraps onto its own row beneath the icon + text at narrow widths; keep the default `flex: 0 0 auto` side-by-side behavior above the threshold.
- Apply the full ellipsis trio (`white-space: nowrap` + `overflow: hidden` + `min-width: 0`) to the banner heading (`.install-banner__text strong`) so it truncates instead of wrapping; leave the body `<span>` wrapping as-is.
- In `src/features/spec-editor/installBanner.ts`, add a `title` attribute carrying the full heading text to the `<strong>` so the truncated heading is recoverable via tooltip.
- No changes to the render function signature, the action `data-action` wiring, or the banner's `role`/`aria-label`.

Files to touch: `webview/styles/spec-viewer/_install-banner.css`, `src/features/spec-editor/installBanner.ts`. No new dependencies.
