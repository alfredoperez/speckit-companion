# Contrast: secondary/muted text + ghost buttons blend on dark theme

## Overview

Secondary and muted body text — and the secondary/ghost buttons that inherit their rest color from it — blend into the dark editor background because the design tokens pull straight from VS Code's intentionally low-contrast description/disabled foregrounds. This change re-derives the two tokens from the theme's own (brighter) editor foreground so secondary/muted text meets WCAG AA on dark while staying clearly subordinate to primary content, and the Archive (secondary) and Regenerate (ghost) buttons read as clearly clickable at rest. The derivation stays theme-adaptive, so light and high-contrast themes are not regressed.

## Functional Requirements

- **FR-001**: `--text-secondary` MUST be re-derived as `color-mix(in srgb, var(--vscode-editor-foreground) 70%, transparent)` instead of the raw `var(--vscode-descriptionForeground)`.
- **FR-002**: `--text-muted` MUST be re-derived as `color-mix(in srgb, var(--vscode-editor-foreground) 50%, transparent)` instead of the raw `var(--vscode-disabledForeground)`.
- **FR-003**: The re-derivation MUST be applied in every block where these tokens are (re)defined — the `:root` block AND each per-theme body block that redefines them (`body.vscode-dark`, `body.vscode-light`, `body.vscode-high-contrast`) — so the value is consistent regardless of which theme cascade wins.
- **FR-004**: Each per-theme `color-mix` MUST keep a sensible fallback foreground matching that theme's existing `--text-primary` fallback (dark `#d4d4d4`, light `#333333`, high-contrast `#ffffff`, `:root` `#d4d4d4`) so the token degrades gracefully when `--vscode-editor-foreground` is unavailable.
- **FR-005**: The change MUST NOT alter the primary button styling, `--accent` / `--accent-*`, or any `--success` / `--warning` / `--error` / status token.
- **FR-006**: The change MUST NOT introduce a new token name or rename `--text-secondary` / `--text-muted`; downstream consumers in `_buttons.css`, `_content.css`, and `_navigation.css` continue to reference the same names.

## Success Criteria

- **SC-001**: On the default dark theme, `--text-secondary` resolves to approximately `#bdbdbd`, yielding a contrast ratio ≥ 4.5:1 against the `#1e1e1e` editor background (WCAG AA for body text).
- **SC-002**: On the default dark theme, `--text-muted` resolves to approximately `#a0a0a0`, yielding a contrast ratio ≥ 3:1 against the `#1e1e1e` editor background.
- **SC-003**: The secondary (Archive) and ghost (Regenerate) buttons render with a rest-state text color that reads as clearly clickable (≥ 3:1 against background), not disabled, while remaining visually subordinate to the primary button.
- **SC-004**: Light and high-contrast themes show no contrast regression — the derived secondary/muted values remain legible and subordinate on those backgrounds.
- **SC-005**: The full test suite and TypeScript compile pass with the change applied.

## Assumptions

- VS Code exposes `--vscode-editor-foreground` in all themed webviews; the per-block fallbacks cover the rare case it is absent.
- `color-mix(in srgb, … N%, transparent)` is supported by the Electron/Chromium runtime that ships with currently supported VS Code versions (already used elsewhere in `tokens.css`, e.g. `--accent-subtle`).
- Mixing the foreground with `transparent` over the known editor background produces the intended ~70%/50% effective luminance; this is the same approach the issue's accepted Option B specifies.
- No automated contrast/a11y test currently exists in the suite; correctness of the derived hex values is verified by manual reasoning and the existing CSS being unit-test-free.
