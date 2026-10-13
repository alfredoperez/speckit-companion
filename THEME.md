# Theme: the marketing look

The look anything promotional takes when it should match the site: a film, a social image, a slide. It is called Constellation. It is dark only.

**The source is `apps/website/src/styles/tokens.css`.** Every value below is copied from it. When the two disagree, the stylesheet is right and this file is out of date.

**What this does not cover.** The spec viewer's own colours, the taste rules for figures and captures, and the older night-forest look that banners and the Marketplace listing still use are all in [`DESIGN.md`](DESIGN.md). A picture of Claude Code uses the terminal check's `claude` look, described in the `shots` skill (`.claude/skills/shots/SKILL.md`).

## Colour

| Role | Token | Value |
| --- | --- | --- |
| Ground, the page | `--ground` | `#0a0913` |
| Panel, a raised surface | `--panel` | `#0d0b1a` |
| Rule, a hairline | `--rule` | `#1d1930` |
| Card border | `--border-card` | `#221e35` |
| Panel border | `--border-panel` | `#2a2545` |
| Strong border | `--border-strong` | `#3a3357` |
| Headline text | `--text-primary` | `#edeaf6` |
| Body text | `--text-body` | `#b6b0d2` |
| Quiet text | `--text-muted` | `#9d97bd` |
| Dim text, labels only | `--text-dim` | `#6f6994` |
| Text on an accent fill | `--on-accent` | `#ffffff` |
| Error text | `--text-error` | `#f5a3ad` |
| Accent, the violet | `--accent` | `#a78bfa` |
| Accent, hovered | `--accent-hover` | `#c4b5fd` |
| Accent, a solid fill | `--accent-solid` | `#8b5cf6` |
| Mascot green | `--green` | `#7cc98a` |
| Leaf green | `--green-leaf` | `#a5df6c` |

Violet is the one accent. The two greens belong to the mascot and to things that grow from it, never to buttons or links. An accent border is the accent at 25% (`--border-accent`) or 50% (`--border-accent-strong`).

Two gradients frame a product picture: `--demo-frame` is `linear-gradient(160deg, #8b6cf6 0%, #3b2a7a 30%, #241c50 60%, #4c3a96 100%)` and `--demo-fill` is `linear-gradient(180deg, #1d1642 0%, #120e2c 55%, #0d0b1e 100%)`.

## Type

Three families, loaded from Google Fonts in `apps/website/src/components/BaseLayout.astro`.

| Role | Family | Weights | Use |
| --- | --- | --- | --- |
| Headlines and body | Figtree | 400, 500, 600, 800 | Everything that is read |
| Labels | JetBrains Mono | 400, 500 | Eyebrows, numbers, controls, code |
| The accent word | Instrument Serif, italic | 400 | At most one word in a heading |

A display headline is 60px at line height 1.1 and letter spacing -0.03em. A section heading is 34px. Body is 16px at line height 1.65. The wordmark is the moss mark and "SpecKit Companion", weight 600 or heavier, letter spacing -0.01em.

## Shape and light

- Corners: a framed picture 28px, a card 12px, a small card 10px, a button 9px, a pill 999px.
- A framed picture glows: `--glow-frame` is `0 0 90px` of the solid accent at 25%. A card glows less: `--glow-card` is `0 0 50px` at 12%.
- A lifted thing drops a plain shadow: `--shadow-lift` is `0 30px 70px rgb(0 0 0 / 0.55)`.

## The mascot and the mark

The mascot is a moss sprite: a round moss ball with two big eyes and a sprout, holding a glowing seedling whose leaf bends into a checkmark. `DESIGN.md` has the full description and the rules for where it may appear.

- The mark: `assets/icons/moss.svg` from 24px up, `assets/icons/moss-16.svg` at 16px, `assets/icons/moss-mono.svg` where one colour is all there is.
- The seedling alone: `assets/icons/seedling.svg`.
- Painted style references: `assets/mascot/mascot-vector-glow.png`, `mascot-clay.png`, `mascot-sketch.png` and `mascot-hero-dark.png`.
- Ready-made poses: `apps/website/public/mascot/<pose>-{128,256,512}.{png,webp}`, listed in `apps/website/public/mascot/manifest.json`. `tending` is the hero pose.

## Motifs

All of these are drawn on the landing page, `apps/website/src/pages/index.astro`.

- **A dot grid.** One-pixel accent dots at 7% on a 26px grid, behind the hero (`--hero-grid`).
- **Violet glow.** Behind a framed picture, under a card, and rising from the foot of the page.
- **Spores.** A few small drifting points of light, violet and leaf green.
- **The stem.** A vine that grows down the left edge as the page is read, with a leaf for each thing finished. The leaf is the checkmark.
- **Lightwells.** Painted scenes behind a section, built by `tooling/scripts/build-lightwell.mjs`.
