# SpecKit Companion, editorial style guide

This is the taste half of the style guide. The visual half is rendered in Storybook under **Style Guide** (Foundations, Figure, Hero), from the real sources, so what you see there is what ships. Nothing here overrides a token file; it says which token file a surface obeys, and why.

## Three surfaces, one brand

| Surface | Reading face | Colour | Mark | Source of truth |
|---|---|---|---|---|
| **The website**, speckit-companion.dev | Figtree, JetBrains Mono for labels, Instrument Serif italic for one word per heading | Constellation, dark only | chevron wordmark | `website/src/styles/tokens.css`, `website/src/components/LogoMark.astro` |
| **The VS Code extension** | the host editor's font | the user's VS Code theme; captures use a capture palette | none inside the product | `docs/DESIGN.md` (the viewer), `.storybook/capture-theme.ts` (captures) |
| **Content**: articles, figures, carousels, heroes, clips | Geist for reading, JetBrains Mono for metadata | depends on the asset, below | chevron wordmark on product imagery, mascot on illustrated art | this file, `THEME.md`, the kaiju skills |

Two other identities exist and stay in their lane. Command Center (Geist, void black) never appears in public work. The blog's own display face, Space Grotesk, belongs to the blog's chrome and never to an asset placed in a post.

## What a content asset borrows

- **A figure** (a product screenshot in an article) shows the product, so its chrome is the site's: Constellation tokens and the chevron wordmark. It is read on the blog, so its text is Geist. That is the one deliberate cross. Captures inside a figure are always the violet palette. The mascot stands at the caption. Rules and variations: Style Guide / Figure.
- **A hero** (the image above an article title) is generated art, and it is the one place the brand goes warm: ivory paper, navy ink, black brush lettering, one scarce emerald, the mascot as a caretaker. It carries the "Spec Kit · Companion" lockup with the mascot beside it, and it is the only asset that does. Profile: `create-image/references/branded-editorial-hero.md`, ivory variant.
- **A banner or marketplace asset** still uses the night-forest identity in `THEME.md`: near-black navy, cyan glow, scarce emerald, the moss sprite. It predates Constellation and has not been retired.
- **A clip or GIF** is a capture in motion and follows the active capture palette, with Geist for any set type.
- **A carousel slide** is content art and follows the hero's ivory profile, one idea per slide, headline in the brush hand.

## The mascot

A round moss ball with two big eyes and a two-leaf sprout, cradling a seedling. Fourteen poses ship in `website/public/mascot/`. It is the brand's character, never its logo: it appears in scenes (heroes, banners), at the caption of a figure, and on the site's pages. It never merges with the chevron wordmark, and it is never the subject of an image.

## Always

- The chevron wordmark reads "SpecKit Companion", one word, weight 600 or heavier, letter-spacing -0.01em.
- A title names the screen; a caption makes the point; the prose says what to do with it. No sentence appears in two of the three.
- One fixture spec across every figure in an article.
- Outlines on a screenshot are measured from a selector, never placed by eye. Green means "this is where it is", violet means "this is the point", one violet per figure.
- Mono is uppercase and tracked, and it is the only uppercase on the page.
- Emerald is scarce on generated art: one leaf, one check, one pin.
- Generated images ship with a provenance sidecar (generator, model, prompt verbatim, profile, credits).

## Never

- Italics in a figure, a caption, or a title.
- Em dashes anywhere in on-image copy.
- A count in a title or a subtitle unless the author chose it.
- Decorative brackets, viewfinder corners, or hand-drawn callouts on generated art.
- Dimming the rest of a screenshot to point at a region.
- The magenta marketplace icon as a source for new art.
- A light capture inside the dark figure frame, or a dark capture on the README's light set.

## Open

- Two brand generations coexist: Constellation violet (site, captures, figures) and the night forest (banners, marketplace, THEME.md). Nothing says which wins where they meet. Decide before the next marketplace asset is made.
- Figtree or Geist inside a figure. Geist was chosen because the figure is read inside a Geist page; Figtree would match the site to the letter. One swap.

## Where things are decided

| Question | Answer lives in |
|---|---|
| A colour on the site | `website/src/styles/tokens.css` |
| A colour in a capture, clip, or GIF | `.storybook/capture-theme.ts` |
| A colour inside the viewer | `webview/styles/`, described in `docs/DESIGN.md` |
| The figure frame | `webview/src/spec-viewer/__stories__/figure.tsx`, shown in Style Guide / Figure |
| A hero or carousel prompt | the kaiju `create-image` profiles, `branded-editorial-hero` and `editorial-brush-marker` |
| Generated banner art | `THEME.md` |
| How the writing sounds | the kaiju `writing` skill, `core-voice.md` |
| Which images are stale after a change | `docs/visual-assets.md` |
