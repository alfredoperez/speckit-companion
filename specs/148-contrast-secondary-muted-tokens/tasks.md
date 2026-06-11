# Tasks: Contrast secondary/muted text + ghost buttons

Dependency-ordered checklist. All edits land in a single file (`webview/styles/tokens.css`), so the core tasks are sequential (same-file, no `[P]`). Verification tasks follow.

## Setup

- [x] **T001** Confirm the bug reproduces on the current tree: `--text-secondary`/`--text-muted` in `webview/styles/tokens.css` still resolve to raw `descriptionForeground`/`disabledForeground` (not already `color-mix`). (FR-001, FR-002)

## Core work

- [x] **T002** In the `:root` block of `webview/styles/tokens.css`, re-derive `--text-secondary` to `color-mix(in srgb, var(--vscode-editor-foreground, #d4d4d4) 70%, transparent)` and `--text-muted` to `color-mix(in srgb, var(--vscode-editor-foreground, #d4d4d4) 50%, transparent)`. (FR-001, FR-002, FR-003, FR-004)
- [x] **T003** In the `body.vscode-dark` block of `webview/styles/tokens.css`, apply the same derivation with fallback foreground `#d4d4d4`. (FR-003, FR-004, SC-001, SC-002)
- [x] **T004** In the `body.vscode-light` block of `webview/styles/tokens.css`, apply the same derivation with fallback foreground `#333333`. (FR-003, FR-004, SC-004)
- [x] **T005** In the `body.vscode-high-contrast` block of `webview/styles/tokens.css`, keep `--text-secondary` at the full editor foreground (no dilution) so high-contrast's mandated maximal contrast is not regressed; leave `--text-muted` no weaker than its existing value. (FR-003, SC-004)

## Polish / Verification

- [x] **T006** Re-read `webview/styles/spec-viewer/_buttons.css`, `_content.css`, and `_navigation.css` to confirm the secondary/ghost button tiers and metadata rules still reference `--text-secondary`/`--text-muted` (no token rename needed) and now inherit the lifted values. (FR-006, SC-003)
- [x] **T007** Confirm no change leaked into the primary button, `--accent*`, or status (`--success`/`--warning`/`--error`) tokens. (FR-005)
- [x] **T008** Run `npm run compile && npm test` and confirm green. (SC-005)

## Dependencies

- T001 (reproduce) precedes all edits.
- T002 (`:root`) is the base; T003–T005 are the per-theme overrides and depend on the same understanding but edit distinct blocks of the same file.
- T006–T007 verify the edits from T002–T005.
- T008 (compile + test) is last.

## Parallel

- None marked `[P]`: T002–T005 all edit `webview/styles/tokens.css`, so they run sequentially to avoid edit conflicts. T006/T007 are read-only and could be reviewed together but are listed sequentially for clarity.
