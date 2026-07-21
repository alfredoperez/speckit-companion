# SpecKit Companion — Design

## Tokens (source of truth)

Shared scale/spacing/type tokens come from `webview/styles/tokens.css` (host-derived — the spec-editor and workflow-editor webviews ride it and keep tracking the VS Code theme). The **spec viewer's owned palette** lives in `webview/styles/spec-viewer/_tokens-viewer.css`, loaded only by the viewer (after tokens.css, so it wins the cascade): deliberate light/dark literals for canvas, surfaces, ink, statuses, and syntax — chosen for predictable WCAG contrast rather than inherited from `--vscode-*` variables. Only typography (`--vscode-font-family` / `--vscode-editor-font-family`) and **high-contrast mode** follow the host. **Never hardcode hex in partials** — use the tokens; theme blocks (`body.vscode-light` / `-dark` / `-high-contrast`) re-value them. A `tokensScope` jest spec guards the split — Codex literals must never leak into the shared file.

- Surfaces: `--bg-primary` (canvas) / `--bg-secondary` / `--bg-elevated` / `--bg-hover` / `--bg-inset`
- Text: `--text-primary` / `--text-body` / `--text-secondary` / `--text-muted` — readable content uses `--text-body` / `--text-primary`; secondary/muted are **metadata only**.
- Accent / status: `--accent` (+ `--accent-ink` for on-accent text), `--info`, `--success`, `--warning`, `--error` (+ `*-subtle` opaque washes).
- Code: `--bg-code` is an **always-dark owned surface** (readable in both themes); syntax colors sit on it.
- Type: `--font-family` (host editor), `--font-mono`; scale `--text-xs` … `--text-3xl`.
- Radius / shadow / motion: `--radius-sm` 4px (controls) / `--radius-md` 6px (surfaces) / `--radius-lg` 8px; `--shadow-*`; `--transition-fast/normal`.

**Token discipline (learned the hard way):** a custom property declared on `:root` resolves its `var()` chain *at `:root`* — a theme block that re-values only the underlying token leaves the alias frozen. Theme-dependent tokens must be re-declared as literals in every theme block (see `--header-*`).

## Component vocabulary (markdown-rendered, inside `#markdown-content`)

Requirement scan rows (info-hue id badges), key-entity hairline rows, user-story cards (accent-edged), Given/When/Then stacked scenarios, compact tinted phase headers, task items + capture detail, plan Technical Context grid + Constitution verdict rows (collapsible), research decision cards, checklist report, surface tables (mono headers, row-only borders), file tree and code on the owned dark surface with a language chip. Per-item components stay commentable (the inline "+" line affordance, info hue). Task metadata (the id, `[P]`, `[US#]`) renders as chips ahead of the description, never as brackets inside the sentence; inline code and file references stay quieter than the prose they sit in, with the accent reserved for hover.

## Direction: the Codex system (spec 394)

The viewer reads as a calm operational surface for spec documents — structured data first, prose quieter than identifiers and headings.

- **Shell (Context-First revision)** — one **page-chrome band** (identity left, run facts right — one boundary, never two stacked headers; the facts yield as the pane narrows, identity never does); the **Overview** is the first destination on the vertical **document rail** (a rail entry, not a mode toggle — one selection axis) (selection = lifted surface, completion = rail marks — never one visual for both; action-only steps get no rail entry — the rail lists documents only, and lifecycle actions live in the footer); a one-line **run strip** above the content carries the frequently scanned run facts (replacing the permanent run-facts aside; the status lives in the header badge, not here); a 72ch-capped reading column laid out as a **controlled grid** (fixed reading track + outline track, so gutters are a decision rather than flex leftovers) with its heading TOC on the right — and the outline only takes a column when the region can afford one (~1040px), becoming a disclosure above the document below that; **staleness is document-local** (a notice inside the reading column, never a window-wide band behind the rail); a **floating glass-pill footer** whose primary carries the workflow-derived next action and whose extra commands collapse into "Other actions".
- **Overview = durable-context dossier** — ordered by what a future session needs: one typographic **Intent** statement (approach/area/size beside it) → **Expectations** as a paired fence (must-stay-true | deliberately out of scope) → **Verified** ledger (check · result · evidence command) → numbered **Decisions** → **Coverage** traceability table (requirement → task → test, untraced first) → the run log collapsed at the bottom. Editorial section dividers, not stacked cards.
- **Responsive = container queries** — breakpoints query `.viewer-container`'s inline size (`@container viewer`), not the window, so VS Code split panes collapse correctly (rail → horizontal strip ~900px; compact facts ~560px).
- **Shape** — 6px surfaces, 4px controls, pill badges. The earlier 2px terminal direction is retired.
- **Type** — host fonts; sentence-case buttons; mono microtype reserved for metadata (ids, counts, rail labels, timestamps).
- **Color** — primary fill reserved for the forward action; navigation and secondary actions use surface contrast, not accent fills; semantic hues on their `*-subtle` washes.
- **Motion** — quiet: background/color transitions at 150–200ms, a 1px press settle, the working-state pulse; only running states animate. Always reduced-motion safe (global kill-switch in tokens.css).

## Bans (impeccable + repo rules)

- No accent-flip hover fills or viewfinder/corner-bracket decoration (rejected in the Codex evaluation — competes with dense document content).
- No side-stripe accent borders **except** the Codex-specified user-story card edge and neutral structural edges (blockquote, spec-input).
- No gradient text; no decorative glassmorphism (the footer's backdrop blur is the one sanctioned glass moment).
- Readable text must clear WCAG AA in **both** owned palettes.
- Mono + uppercase is metadata voice only — never buttons or body copy.
