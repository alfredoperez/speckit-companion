# Implementation Plan: Contrast secondary/muted text + ghost buttons

## Summary

Re-derive the `--text-secondary` and `--text-muted` design tokens from the theme's own `--vscode-editor-foreground` via `color-mix` (70% and 50% respectively) instead of VS Code's intentionally low-contrast `descriptionForeground`/`disabledForeground`. Apply the derivation in the `:root` block and in each per-theme body block that redefines these tokens, so secondary/muted body text and the secondary/ghost buttons that inherit from it clear WCAG AA (≥4.5:1) / ≥3:1 on dark while staying theme-adaptive on light and high-contrast.

## Technical Context

- **Language/runtime**: CSS custom properties consumed by VS Code webviews (Chromium/Electron).
- **Primary file**: `webview/styles/tokens.css` — the single source of truth for all webviews.
- **Consumers (read-only verification)**: `webview/styles/spec-viewer/_buttons.css` (secondary/ghost tiers), `webview/styles/spec-viewer/_content.css` and `_navigation.css` (metadata rules: `.meta-date`, `.spec-file-ref`, `.meta-label`, nav subsection label).
- **Testing**: `npm run compile` (tsc) + `npm test` (jest). No CSS contrast/a11y test exists today, so verification of derived hex values is by reasoning; the suite confirms nothing else regressed.
- **Constraint**: `color-mix(in srgb, …, transparent)` already used in this file (`--accent-subtle`), so runtime support is established.

## Approach & Structure

`webview/styles/tokens.css` — four edit sites, same two-token derivation in each, with a per-block fallback foreground matching that block's existing `--text-primary` fallback:

1. `:root` (lines ~44–45): fallback `#d4d4d4`.
2. `body.vscode-light` (lines ~141–144): fallback `#333333`.
3. `body.vscode-dark` (lines ~171–173): fallback `#d4d4d4`.
4. `body.vscode-high-contrast` (lines ~183–186): fallback `#ffffff`. High-contrast intentionally keeps full-strength foreground for `--text-secondary` today (`#ffffff`); to avoid regressing its mandated maximal contrast, keep its `--text-secondary` at the foreground (no dilution) and leave `--text-muted` as-is or derive at 50% only if it does not drop below the existing value. Treat high-contrast conservatively — it must not lose contrast.

Order of attack: edit `:root` first (the base), then dark, then light, then high-contrast. Leave all other tokens (primary button, `--accent*`, status colors) untouched.

## Out of Scope

- The optional button polish from the issue (bumping secondary-button border to `--border-hover`, or giving Regenerate/Archive an explicit `--text-body` at rest) — the token re-derivation alone satisfies the acceptance criteria; border polish is deferred unless review shows it's still needed.
- Any change to the primary button, `--accent`/`--accent-*`, or status (`--success`/`--warning`/`--error`) tokens.
- Adding a new automated contrast/a11y test harness (none exists; out of scope for this fix).
