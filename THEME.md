# SpecKit Companion — Visual Theme

Reference for any generated art (hero banners, marketplace assets, social cards). Canonical hero: `docs/screenshots/hero.jpg`. Full design system: `docs/DESIGN.md`.

## Identity in one line

A **bioluminescent night forest rendered as a developer tool**: almost-black navy ground lit by cool cyan-blue ambient glow, with **one scarce emerald accent** reserved for the thing that matters.

## Palette

| Role | Hex |
|---|---|
| Ground (deep / raised) | `#010409` / `#0d1117` |
| Headline text | `#e6edf3` |
| Muted text | `#8b949e` |
| Marketing accent (scarce) | emerald `#3fb950` |
| In-product accent | mint-emerald `#65e6bd` |
| Info blue | `#78bdf7` |

## Mascot

The **moss-sprite**: a round fuzzy moss ball with two big glossy black eyes, white catchlights, a tiny smile, and a small two-leaf sprout on its head. It **cradles a radiant glowing emerald seedling** at its chest (the sprout's leaf bends into a checkmark: spec → grown, verified). Style variants in `assets/mascot/`.

## Story motifs

- **Chain of glowing rounded-rect stage cards**: SPECIFY → PLAN → TASKS → DONE, wired by luminous vines with glowing nodes; completed cards carry checkmarks
- Night-forest scenery: glowing blue mushrooms, firefly particles, moonlit waterfall, mossy foreground
- Soft-glow white wordmark left, pipeline right, mascot bottom-right

## Typography

- **Geist** for the wordmark and captions
- **JetBrains Mono**, uppercase, wide tracking — metadata/chips only, never body copy

## Rules

- Emerald is scarce: only the pipeline, checkmarks, and seedling glow green — everything else stays cool navy/cyan
- No neon spray, no glassmorphism
- **No decorative annotation on generated art.** Brackets, viewfinder corners, and hand-drawn callouts stay off illustrated heroes and diagrams
- **Measured callouts on product screenshots are allowed**, and only the kind `scripts/capture-docs-images.mjs` draws: a single box plus label positioned from a real `getBoundingClientRect` measurement, never from eyeballed coordinates. `docs/screenshots/generated/overview-annotated.png` is the reference. Anything hand-placed is not a measured callout
- The magenta-gradient marketplace `icon.png` is legacy — do not derive new art from it
