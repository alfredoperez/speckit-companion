# Implementation Plan: Inline Comment Composer Card

**Branch**: `097-inline-comment-composer` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/097-inline-comment-composer/spec.md`

## Summary

Restructure the spec-viewer's inline comment composer so it reads as one
cohesive, GitHub-style review-comment card instead of a textarea with a
secondary "Remove Line" button floating above it. The card gains a header
(what's being commented on), a body (the existing textarea), and a single
footer row with the secondary line action(s) left-aligned and the primary
Cancel / Add Comment actions right-aligned. This is a visual restructure
only — markup placement and CSS change; all composer behavior (anchoring,
submission, scratchpad persistence, keyboard shortcuts, auto-focus,
empty-submit cancels, context-action outcomes) is preserved unchanged.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview), Webpack 5
**Storage**: File-based — refinement comments persist to `<docType>-extra.md` scratchpad (unchanged by this feature)
**Testing**: Jest (`describe`/`it` BDD) for extension side; Storybook for webview component visual review
**Target Platform**: VS Code webview (browser context) inside the desktop editor
**Project Type**: Single project (VS Code extension with bundled webview UI)
**Performance Goals**: N/A (static layout change; composer is already instant)
**Constraints**: Visual restructure only — no behavior change, no new comment capabilities (FR-009); must remain themable via VS Code CSS variables
**Scale/Scope**: One Preact component (`InlineEditor.tsx`), one CSS partial (`_editor.css`), plus Storybook stories. ~6 line types/modes to verify.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. No provider or
  configuration surface touched; the action-set data in `lineActions.ts`
  stays the single source of truth for per-line-type actions.
- **II. Spec-Driven Workflow** — PASS. Composer is part of the viewer
  that supports the Specify→Plan→Tasks→Implement pipeline; lifecycle
  gating (composer disabled when completed/archived) is preserved.
- **III. Visual and Interactive** — PASS (and directly served). This is a
  pure UI/UX improvement to a visual, interactive component.
- **IV. Modular Architecture for Complex Features** — PASS. Change stays
  within the established modular structure: webview component +
  CSS partial + Storybook story; no new cross-cutting modules.

No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/097-inline-comment-composer/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── checklists/          # Pre-existing checklist artifacts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

No `contracts/` directory: the composer is a purely internal webview
component with no external interface (no public API, CLI command, or
network endpoint). Contracts are not applicable.

### Source Code (repository root)

```text
webview/
├── src/spec-viewer/
│   ├── components/
│   │   ├── InlineEditor.tsx          # PRIMARY edit: header/body/footer card markup
│   │   ├── InlineEditor.stories.tsx  # Update + add stories per line type
│   │   └── InlineComment.tsx         # Persisted-comment card (unchanged)
│   └── editor/
│       ├── lineActions.ts            # Action data + handlers (unchanged)
│       ├── inlineEditor.ts           # Mounting/anchoring (unchanged)
│       └── refinements.ts            # Add/submit/persist (unchanged)
└── styles/spec-viewer/
    └── _editor.css                   # PRIMARY edit: single-card border, footer split

src/features/spec-viewer/
└── messageHandlers.ts                # Scratchpad persistence (unchanged)
```

**Structure Decision**: Single-project VS Code extension with a bundled
Preact webview. The change is confined to the webview component
`InlineEditor.tsx`, its CSS partial `_editor.css`, and its Storybook
stories. No extension-side (`src/`) logic changes. This honors the
extension-isolation rule (no edits to `.claude/**` or `.specify/**`) and
the "keep the inline-comment UX, layer onto it" guidance — the existing
mounting, action data, and persistence paths are untouched.

## Complexity Tracking

> No constitution violations; no entries required.
