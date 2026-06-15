# Implementation Plan: Fade Create Spec Placeholder

**Branch**: `326-fade-spec-placeholder` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/326-fade-spec-placeholder/spec.md`

## Summary

The Create Spec description field paints its placeholder guidance in nearly the same color as real typed text, so an empty field can be mistaken for a filled one. The fix is a one-line CSS color change: move the placeholder from the body-content token (`--text-body`) to VS Code's native input-placeholder color (`--vscode-input-placeholderForeground`, falling back to the muted token), which sits clearly between full-contrast content and the disabled appearance and stays legible on both light and dark themes. We also drop the heavy `opacity: 0.85` stacking (pinning `opacity: 1`) so the fade comes from the color treatment as a whole rather than from layering transparency on top of an already-readable color (FR-004).

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict) — but this change is pure CSS
**Primary Dependencies**: VS Code Extension API, Webpack 5 (webview bundling); no new dependencies
**Storage**: N/A (no persisted state touched)
**Testing**: Storybook visual baseline (`CreateSpec.stories.tsx`); manual light/dark theme check in Extension Development Host
**Target Platform**: VS Code webview (spec-editor)
**Project Type**: Single VS Code extension with a webview UI layer
**Performance Goals**: N/A (static style change)
**Constraints**: Placeholder must clear WCAG AA on both themes and not read as disabled
**Scale/Scope**: One CSS rule in `webview/styles/spec-editor.css`; one Storybook story verifies the empty state

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — No config surface added; uses existing theme-adaptive design tokens. PASS.
- **II. Spec-Driven Workflow** — Change flows through the normal spec pipeline. PASS.
- **III. Visual and Interactive** — This is a visual-affordance fix that improves the GUI's first-step clarity; squarely on-principle. PASS.
- **IV. Modular Architecture** — Change lives in the existing modular webview CSS layer; no new modules. PASS.

No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/326-fade-spec-placeholder/
├── plan.md              # This file
├── research.md          # Phase 0 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

`data-model.md`, `contracts/`, and `quickstart.md` are intentionally omitted: this is a purely visual CSS change with no entities, no external interface contracts, and no new user-facing setup flow.

### Source Code (repository root)

```text
webview/
├── styles/
│   ├── spec-editor.css           # The placeholder rule being changed (line ~134)
│   └── tokens.css                # Source of --text-secondary / --text-body (read-only here)
└── src/spec-editor/
    └── __stories__/
        └── CreateSpec.stories.tsx  # Visual baseline for the empty-placeholder state (FR-005)
```

**Structure Decision**: Single-project VS Code extension. The fix is isolated to the webview CSS partial `webview/styles/spec-editor.css`. The design tokens in `webview/styles/tokens.css` are the source of truth for the chosen color and are read, not modified. The Storybook story is the empty-state visual reference that FR-005 requires we keep in sync.

## Approach

1. In `webview/styles/spec-editor.css`, change the `.spec-editor-textarea::placeholder` rule from `color: var(--text-body); opacity: 0.85;` to `color: var(--vscode-input-placeholderForeground, var(--text-muted)); opacity: 1;` (dropping the stacked 0.85 opacity).
   - `--vscode-input-placeholderForeground` is VS Code's native input-placeholder color — purpose-built for this, theme-adaptive, and consistent with the textarea already using `--vscode-input-background` / `--vscode-input-foreground`. It reads clearly faded on both themes without looking disabled, satisfying FR-001/002/003. `opacity: 1` keeps the fade sourced purely from the color token so no UA-default placeholder opacity stacks on top (FR-004). Falls back to `--text-muted` (a 50%-foreground `color-mix`) for any theme that doesn't define the native token.
2. Verify the empty Create Spec state visually in the Extension Development Host on both a light and a dark theme.
3. Confirm the `CreateSpec.stories.tsx` empty-placeholder story still represents the intended baseline (it picks up the CSS automatically; no story-code change expected, but it is the FR-005 reference to eyeball).

## Complexity Tracking

> No constitution violations — section intentionally empty.
