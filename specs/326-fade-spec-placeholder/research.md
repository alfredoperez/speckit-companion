# Phase 0 Research: Fade Create Spec Placeholder

No open `NEEDS CLARIFICATION` items — the spec is fully specified. The only research needed was to locate the offending style and pick the correct replacement token.

## Decision: Use `--text-secondary` for the placeholder color

**Current state**: `.spec-editor-textarea::placeholder` in `webview/styles/spec-editor.css` uses `color: var(--text-body); opacity: 0.85;`. `--text-body` is `#d0d0d0` (dark) / `#4a4a4a` (light) — essentially the body-content color — so the placeholder reads almost like typed text. This is the bug from issue #330.

**Decision**: Replace with `color: var(--text-secondary);` and remove the `opacity: 0.85` stack.

**Rationale**:
- `--text-secondary` = `color-mix(in srgb, var(--vscode-editor-foreground) 70%, transparent)` on both themes (`tokens.css` lines 47 and 147). It is theme-adaptive and documented to clear WCAG AA on dark while staying subordinate to full content (per the spec-148 comment in `tokens.css`).
- It sits clearly between full-contrast content (`--text-primary` / `--vscode-input-foreground`) and the intentionally low-contrast disabled token (`--text-muted` at 50%), satisfying FR-001 and FR-003.
- Dropping `opacity` honors FR-004: the fade comes from the color treatment as a whole, not from stacking transparency on an already-readable color (which would risk pushing it below readable contrast).

## Alternatives considered

- **`--text-muted` (50% mix)** — rejected: it maps to VS Code's intentionally low-contrast description/disabled range and (per CLAUDE.md and `tokens.css`) blends below WCAG AA on dark; it would read as disabled, violating FR-002 and FR-003.
- **Keep `--text-body` and only lower opacity further** — rejected: this is exactly the "stack an already-low-contrast color with heavy transparency" anti-pattern FR-004 forbids, and contrast behaves differently per theme (edge case in the spec).
- **A hand-picked literal hex** — rejected: non-theme-adaptive; would look faded on one theme and near-content on the other (explicit edge case the spec calls out). The token-based approach stays correct across themes.
