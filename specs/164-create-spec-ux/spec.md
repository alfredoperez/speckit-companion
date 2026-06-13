# Create Spec Page — UX & Accessibility Overhaul

## Overview

The Create Spec page (the spec-editor webview) wastes wide editors, hides its writing guidance behind a low-contrast placeholder that vanishes on the first keystroke, lets an empty description be submitted, and is silent to assistive technology about errors, in-progress submission, and image attachment changes. This feature makes the form comfortable at any width, gives writers persistent readable guidance, gates submission on real input, and brings the page to WCAG AA — so screen-reader and keyboard users get the same feedback sighted mouse users already do.

## Functional Requirements

### Layout & guidance

- **FR-001** The form content MUST be constrained to a centered, readable-width column (~720–840px) regardless of editor width; the textarea MUST NOT span the full editor width.
- **FR-002** The page MUST present persistent helper text (visible while typing) that guides what to write, in a proportional font with contrast ≥ 4.5:1 against the background — replacing the monospace placeholder example that vanished on first keystroke.
- **FR-003** The specification textarea MUST use a proportional, readable font for entered text (not a monospace font).
- **FR-004** The subtitle MUST state what happens next (the AI generates spec/plan/tasks) rather than restating the page title.
- **FR-005** The Attachments area MUST collapse into a compact composer-style control attached to the textarea; the misleading dashed drag-and-drop affordance MUST be removed (drag-and-drop is not implemented).
- **FR-006** Section divider rules MUST be dropped in the single-column layout.

### Primary action & validation

- **FR-007** The primary submit button MUST be labeled **Create Spec** (not "Submit").
- **FR-008** The Create Spec button MUST be disabled while the description is empty (whitespace-only counts as empty) and enabled once non-empty content exists.
- **FR-009** The character counter MUST stay hidden until the content reaches ~90% of the limit, then become visible in a warning color.
- **FR-010** When content exceeds the character limit, submission MUST be blocked (button disabled and keyboard-submit suppressed), and the over-limit state MUST be communicated by more than color alone.
- **FR-011** The footer MUST be one aligned row: Cancel + Create Spec grouped on the right, keyboard hints on the left.

### Accessibility — announcements

- **FR-012** Error messages MUST be announced to assistive technology when they appear (live region with assertive politeness).
- **FR-013** The loading overlay MUST announce that submission is in progress and MUST set a busy state on the affected region.
- **FR-014** Attaching or removing an image MUST produce non-visual feedback announced to assistive technology.

### Accessibility — names, discoverability, focus

- **FR-015** Every "×" close/remove button MUST have a meaningful accessible name (e.g. "Remove image <name>", "Dismiss error").
- **FR-016** The character limit MUST be discoverable non-visually by associating the textarea with the counter (the textarea references the counter as its description).
- **FR-017** Every interactive control (textarea, select, all buttons) MUST show a clearly visible focus indicator when navigated by keyboard; focus outlines MUST NOT be suppressed without a visible replacement.
- **FR-018** The main content MUST be wrapped in a `<main>` landmark and the heading order MUST not skip levels (no h1→h3 jump).
- **FR-019** Keyboard hints MUST show the platform-correct modifier (Cmd on macOS, Ctrl elsewhere) rather than a hardcoded "Ctrl".

### Safety

- **FR-020** Pressing Escape with typed content MUST NOT silently discard work — it MUST either confirm before discarding or rely on a draft that demonstrably restores the typed content.

### Regression guardrails

- **FR-021** Existing flows MUST remain functional: workflow selection, custom command buttons, paste-to-attach, file-picker attach, and draft restore.

## Success Criteria

- **SC-001** At any editor width, the form renders as a centered column no wider than ~840px (readable line length maintained).
- **SC-002** Writing guidance is visible both before and during typing and meets ≥ 4.5:1 contrast.
- **SC-003** The primary button reads "Create Spec" and cannot be activated (click or keyboard) when the description is empty or over the limit.
- **SC-004** A screen reader announces: an error when it occurs, that submission is in progress, and confirmation when an image is attached or removed.
- **SC-005** Every button exposes a non-empty accessible name to assistive technology.
- **SC-006** The character limit is conveyed by text/state in addition to color, and over-limit content cannot be submitted.
- **SC-007** Every interactive control shows a visible focus ring when reached by keyboard.
- **SC-008** Heading levels are sequential and the primary content sits inside a `<main>` landmark.
- **SC-009** On macOS the keyboard hint reads "Cmd"; elsewhere "Ctrl".
- **SC-010** Pressing Escape with unsaved typed content does not lose the content without acknowledgement.
- **SC-011** All listed existing flows continue to work unchanged.

## Assumptions

- The webview is vanilla DOM (not Preact); the `CreateSpecMock.tsx` Storybook component is a visual reference only and is updated to match the new layout.
- Readable content uses `--text-body` / `--text-primary` tokens (never `--text-secondary` / `--text-muted`, which are intentionally low-contrast metadata tokens per the project token rules).
- Platform detection for the Cmd/Ctrl hint uses the webview `navigator.platform`/userAgent (Mac detection) at runtime.
- The Esc-discard safety is satisfied by a confirm-before-discard prompt when content is present (the existing draft-restore is retained as a complementary safety net).
- The helper-text column width target lands at 800px as the informed default within the 720–840px range.
- The character-counter reveal threshold is 90% of the 50,000 limit (45,000 characters).
