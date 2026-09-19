# SpecKit Companion — Design

Three sections, outside in: [Tokens](#tokens) is the viewer's own CSS, [Editorial](#editorial) is the taste and brand rules that govern every surface, and [Generated art](#generated-art) is the reference for anything AI-generated (heroes, banners, social cards).

## Tokens

Shared scale/spacing/type tokens come from `webview/styles/tokens.css` (host-derived — the spec-editor and workflow-editor webviews ride it and keep tracking the VS Code theme). The **spec viewer's owned palette** lives in `webview/styles/spec-viewer/_tokens-viewer.css`, loaded only by the viewer (after tokens.css, so it wins the cascade): deliberate light/dark literals for canvas, surfaces, ink, statuses, and syntax — chosen for predictable WCAG contrast rather than inherited from `--vscode-*` variables. Only typography (`--vscode-font-family` / `--vscode-editor-font-family`) and **high-contrast mode** follow the host. **Never hardcode hex in partials** — use the tokens; theme blocks (`body.vscode-light` / `-dark` / `-high-contrast`) re-value them. A `tokensScope` jest spec guards the split — Codex literals must never leak into the shared file.

- Surfaces: `--bg-primary` (canvas) / `--bg-secondary` / `--bg-elevated` / `--bg-hover` / `--bg-inset`
- Text: `--text-primary` / `--text-body` / `--text-secondary` / `--text-muted` — readable content uses `--text-body` / `--text-primary`; secondary/muted are **metadata only**.
- Accent / status: `--accent` (+ `--accent-ink` for on-accent text), `--info`, `--success`, `--warning`, `--error` (+ `*-subtle` opaque washes).
- Code: `--bg-code` is an **always-dark owned surface** (readable in both themes); syntax colors sit on it.
- Type: `--font-family` (host editor), `--font-mono`; scale `--text-xs` … `--text-3xl`.
- Radius / shadow / motion: `--radius-sm` 4px (controls) / `--radius-md` 6px (surfaces) / `--radius-lg` 8px; `--shadow-*`; `--transition-fast/normal`.

**Token discipline (learned the hard way):** a custom property declared on `:root` resolves its `var()` chain *at `:root`* — a theme block that re-values only the underlying token leaves the alias frozen. Theme-dependent tokens must be re-declared as literals in every theme block (see `--header-*`).

### Component vocabulary (markdown-rendered, inside `#markdown-content`)

Requirement scan rows (info-hue id badges), key-entity hairline rows, user-story cards (accent-edged), Given/When/Then stacked scenarios, compact tinted phase headers, task items + capture detail, plan Technical Context grid + Constitution verdict rows (collapsible), research decision cards, checklist report, surface tables (mono headers, row-only borders), file tree and code on the owned dark surface with a language chip. Per-item components stay commentable (the inline "+" line affordance, info hue). Task metadata (the id, `[P]`, `[US#]`) renders as chips ahead of the description, never as brackets inside the sentence; inline code and file references stay quieter than the prose they sit in, with the accent reserved for hover.

### Direction: the Codex system (spec 394)

The viewer reads as a calm operational surface for spec documents — structured data first, prose quieter than identifiers and headings.

- **Shell (Context-First revision)** — one **page-chrome band** (identity left, run facts right — one boundary, never two stacked headers; the facts yield as the pane narrows, identity never does); the **Overview** is the first destination on the vertical **document rail** (a rail entry, not a mode toggle — one selection axis) (selection = lifted surface, completion = rail marks — never one visual for both; action-only steps get no rail entry — the rail lists documents only, and lifecycle actions live in the footer); a one-line **run strip** above the content carries the frequently scanned run facts (replacing the permanent run-facts aside; the status lives in the header badge, not here); a 72ch-capped reading column laid out as a **controlled grid** (fixed reading track + outline track, so gutters are a decision rather than flex leftovers) with its heading TOC on the right — and the outline only takes a column when the region can afford one (~1040px), becoming a disclosure above the document below that; **staleness is document-local** (a notice inside the reading column, never a window-wide band behind the rail); a **floating glass-pill footer** whose primary carries the workflow-derived next action and whose extra commands collapse into "Other actions".
- **Overview = durable-context dossier** — ordered by what a future session needs: one typographic **Intent** statement (approach/area/size beside it) → **Expectations** as a paired fence (must-stay-true | deliberately out of scope) → **Verified** ledger (check · result · evidence command) → numbered **Decisions** → **Coverage** traceability table (requirement → task → test, untraced first) → the run log collapsed at the bottom. Editorial section dividers, not stacked cards.
- **Responsive = container queries** — breakpoints query `.viewer-container`'s inline size (`@container viewer`), not the window, so VS Code split panes collapse correctly (rail → horizontal strip ~900px; compact facts ~560px).
- **Shape** — 6px surfaces, 4px controls, pill badges. The earlier 2px terminal direction is retired.
- **Type** — host fonts; sentence-case buttons; mono microtype reserved for metadata (ids, counts, rail labels, timestamps).
- **Color** — primary fill reserved for the forward action; navigation and secondary actions use surface contrast, not accent fills; semantic hues on their `*-subtle` washes.
- **Motion** — quiet: background/color transitions at 150–200ms, a 1px press settle, the working-state pulse; only running states animate. Always reduced-motion safe (global kill-switch in tokens.css).

### Bans (impeccable + repo rules)

- No accent-flip hover fills or viewfinder/corner-bracket decoration (rejected in the Codex evaluation — competes with dense document content).
- No side-stripe accent borders **except** the Codex-specified user-story card edge and neutral structural edges (blockquote, spec-input).
- No gradient text; no decorative glassmorphism (the footer's backdrop blur is the one sanctioned glass moment).
- Readable text must clear WCAG AA in **both** owned palettes.
- Mono + uppercase is metadata voice only — never buttons or body copy.

## Editorial

This is the taste half of the style guide. The visual half is rendered in Storybook under **Style Guide** (Foundations, Figure, Hero), from the real sources, so what you see there is what ships. Nothing here overrides a token file; it says which token file a surface obeys, and why.

### Three surfaces, one brand

| Surface | Reading face | Colour | Mark | Source of truth |
|---|---|---|---|---|
| **The website**, speckit-companion.dev | Figtree, JetBrains Mono for labels, Instrument Serif italic for one word per heading | Constellation, dark only | chevron wordmark | `website/src/styles/tokens.css`, `website/src/components/LogoMark.astro` |
| **The VS Code extension** | the host editor's font | the user's VS Code theme; captures use a capture palette | none inside the product | [Tokens](#tokens) below (the viewer), `.storybook/capture-theme.ts` (captures) |
| **Content**: articles, figures, carousels, heroes, clips | Geist for reading, JetBrains Mono for metadata | depends on the asset, below | chevron wordmark on product imagery, mascot on illustrated art | this file, the kaiju skills |

Two other identities exist and stay in their lane. Command Center (Geist, void black) never appears in public work. The blog's own display face, Space Grotesk, belongs to the blog's chrome and never to an asset placed in a post.

### What a content asset borrows

- **A figure** (a product screenshot in an article) shows the product, so its chrome is the site's: Constellation tokens and the chevron wordmark. It is read on the blog, so its text is Geist. That is the one deliberate cross. Captures inside a figure are always the violet palette. The mascot stands at the caption. Rules and variations: Style Guide / Figure.
- **A hero** (the image above an article title) is generated art, and it is the one place the brand goes warm: ivory paper, navy ink, black brush lettering, one scarce emerald, the mascot as a caretaker. It carries the "Spec Kit · Companion" lockup with the mascot beside it, and it is the only asset that does. Profile: `create-image/references/branded-editorial-hero.md`, ivory variant.
- **A banner or marketplace asset** still uses the night-forest identity in the [Generated art](#generated-art) section below: near-black navy, cyan glow, scarce emerald, the moss sprite. It predates Constellation and has not been retired.
- **A clip or GIF** is a capture in motion and follows the active capture palette, with Geist for any set type.
- **A carousel slide** is content art and follows the hero's ivory profile, one idea per slide, headline in the brush hand.

### The mascot

The **moss-sprite**: a round fuzzy moss ball with two big glossy black eyes, white catchlights, a tiny smile, and a small two-leaf sprout on its head. It cradles a radiant glowing emerald seedling at its chest (the sprout's leaf bends into a checkmark: spec → grown, verified). Style variants live in `assets/mascot/`; fourteen web-ready poses ship in `website/public/mascot/`. It is the brand's character, never its logo: it appears in scenes (heroes, banners), at the caption of a figure, and on the site's pages. It never merges with the chevron wordmark, and it is never the subject of an image.

### Always

- The chevron wordmark reads "SpecKit Companion", one word, weight 600 or heavier, letter-spacing -0.01em.
- A title names the screen; a caption makes the point; the prose says what to do with it. No sentence appears in two of the three.
- One fixture spec across every figure in an article.
- Outlines on a screenshot are measured from a selector, never placed by eye. Green means "this is where it is", violet means "this is the point", one violet per figure.
- Mono is uppercase and tracked, and it is the only uppercase on the page.
- Emerald is scarce on generated art: one leaf, one check, one pin.
- Generated images ship with a provenance sidecar (generator, model, prompt verbatim, profile, credits).

### Never

- Italics in a figure, a caption, or a title.
- Em dashes anywhere in on-image copy.
- A count in a title or a subtitle unless the author chose it.
- Decorative brackets, viewfinder corners, or hand-drawn callouts on generated art.
- Dimming the rest of a screenshot to point at a region.
- The magenta marketplace icon as a source for new art.
- A light capture inside the dark figure frame, or a dark capture on the README's light set.

### Open

- Two brand generations coexist: Constellation violet (site, captures, figures) and the night forest (banners, marketplace, the [Generated art](#generated-art) section). Nothing says which wins where they meet. Decide before the next marketplace asset is made.
- Figtree or Geist inside a figure. Geist was chosen because the figure is read inside a Geist page; Figtree would match the site to the letter. One swap.

### Where things are decided

| Question | Answer lives in |
|---|---|
| A colour on the site | `website/src/styles/tokens.css` |
| A colour in a capture, clip, or GIF | `.storybook/capture-theme.ts` |
| A colour inside the viewer | `webview/styles/`, described in [Tokens](#tokens) |
| The figure frame | `webview/src/spec-viewer/__stories__/figure.tsx`, shown in Style Guide / Figure |
| A hero or carousel prompt | the kaiju `create-image` profiles, `branded-editorial-hero` and `editorial-brush-marker` |
| Generated banner art | [Generated art](#generated-art) |
| How the writing sounds | the kaiju `writing` skill, `core-voice.md` |
| Which images are stale after a change | `docs/visual-assets.md` |

## Generated art

Reference for any generated art (hero banners, marketplace assets, social cards). Canonical hero: `docs/screenshots/hero.jpg`. Full design system: the [Tokens](#tokens) section above. The mascot: see [The mascot](#the-mascot) under Editorial above.

### Identity in one line

A **bioluminescent night forest rendered as a developer tool**: almost-black navy ground lit by cool cyan-blue ambient glow, with **one scarce emerald accent** reserved for the thing that matters.

### Palette

| Role | Hex |
|---|---|
| Ground (deep / raised) | `#010409` / `#0d1117` |
| Headline text | `#e6edf3` |
| Muted text | `#8b949e` |
| Marketing accent (scarce) | emerald `#3fb950` |
| In-product accent | mint-emerald `#65e6bd` |
| Info blue | `#78bdf7` |

### Story motifs

- **Chain of glowing rounded-rect stage cards**: SPECIFY → PLAN → TASKS → DONE, wired by luminous vines with glowing nodes; completed cards carry checkmarks
- Night-forest scenery: glowing blue mushrooms, firefly particles, moonlit waterfall, mossy foreground
- Soft-glow white wordmark left, pipeline right, mascot bottom-right

### Typography

- **Geist** for the wordmark and captions
- **JetBrains Mono**, uppercase, wide tracking — metadata/chips only, never body copy

### Rules

- Emerald is scarce: only the pipeline, checkmarks, and seedling glow green — everything else stays cool navy/cyan
- No neon spray, no glassmorphism
- **No decorative annotation on generated art.** Brackets, viewfinder corners, and hand-drawn callouts stay off illustrated heroes and diagrams
- **Measured callouts on product screenshots are allowed**, and only the kind `scripts/capture-docs-images.mjs` draws: a single box plus label positioned from a real `getBoundingClientRect` measurement, never from eyeballed coordinates. `docs/screenshots/generated/overview-annotated.png` is the reference. Anything hand-placed is not a measured callout
- The magenta-gradient marketplace `icon.png` is legacy — do not derive new art from it
