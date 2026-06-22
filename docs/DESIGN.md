# SpecKit Companion — Design

## Tokens (source of truth)

All color / spacing / type come from `webview/styles/tokens.css`, which maps to VS Code theme variables (`--vscode-*`) with fallbacks. **Never hardcode hex for theme-able surfaces** — use the tokens so light / dark / high-contrast all work.

- Surfaces: `--bg-primary` / `--bg-secondary` / `--bg-elevated` / `--bg-hover`
- Text: `--text-primary` / `--text-body` / `--text-secondary` / `--text-muted` — readable content uses `--text-body` / `--text-primary`; secondary/muted are **metadata only** (they map to VS Code's intentionally low-contrast description/disabled colors).
- Accent / status: `--accent`, `--success`, `--warning`, `--error` (+ `*-subtle` tints, `--border-accent`).
- Type: `--font-family` (Geist / system), `--font-mono`; scale `--text-xs` … `--text-3xl`.
- Radius / shadow / motion: `--radius-*`, `--shadow-*`, `--transition-fast/normal`.

## Component vocabulary (markdown-rendered, inside `#markdown-content`)

Requirement rows, key-entity rows, user-story headers, Given/When/Then stacked scenarios, phase headers, task items + capture detail, plan Technical Context grid + Constitution verdict rows (collapsible), research decision cards, checklist report, tables, file tree. Card-like components share a hover affordance (border + shadow + slight lift). Per-item components stay commentable (the inline "+" line affordance).

## Direction: terminal-native / techy accent (measured)

Goal: feel modern and built-for-developers without breaking VS Code nativeness.

- **Shape** — squared corners (radius 0–2px) on interactive / techy elements; sharp 1.5–2px borders.
- **Type** — monospace + uppercase + wide letter-spacing on buttons and key labels for a terminal feel.
- **Motion** — crisp hover **color-flip** (transparent ↔ accent, or fg/bg invert), ease-out, 120–160ms; always a `prefers-reduced-motion` fallback to instant.
- **Signature interactions** — a hard offset shadow that collapses on press (`box-shadow` 3–4px → 0 + a small translate); optional **corner-bracket / viewfinder** framing on primary actions.
- **Restraint** — do NOT drench surfaces in one loud color; backgrounds stay theme-adaptive. The accent (VS Code `focusBorder` by default) carries the energy, not a fixed yellow.

## Bans (impeccable + repo rules)

- No **side-stripe accent borders** (a >1px colored border on one side). Use full borders or background tints.
- No gradient text; no decorative glassmorphism.
- Readable text must clear WCAG AA; `--text-secondary` / `--text-muted` are for metadata, not body copy.
- Stay **theme-adaptive** — hardcoded brand color only for a deliberate accent moment, never for body surfaces.
