# Carousel — Copilot users (US and India)

Five-slide social carousel aimed at developers already using GitHub Copilot. Sits alongside the other non-packaged art under `assets/`; **excluded from the `.vsix`** (see `.vscodeignore`).

## Regenerate

```
node assets/social/carousel-copilot/render.mjs
```

Writes `slides/slide-1.png` … `slide-5.png` at 1080 x 1350 (4:5 portrait, the tallest slot LinkedIn and Instagram both render full-bleed) at device pixel ratio 2. Never hand-edit a slide PNG — change `deck.html` and re-run, the same rule the generated screenshots follow.

## Composition rule

Every product image on these slides is a **real capture** out of `docs/screenshots/generated/` — `spec-viewer.png`, `overview.png`, `pipeline-stats.png`, `specs-sidebar.png`, `living-specs-pair.png`. Nothing here draws a mock UI. When those captures are regenerated, re-run this script so the carousel follows.

## Art direction

Derived from `speckit-extension/assets/HERO-PROMPT.md`, the repo's codified brand direction:

- Ground `#0F0F13`, faint blueprint grid of thin `#2A2A3A` lines.
- Blue glow `#60A5FA` / `#3B82F6` behind the focal area.
- Exactly **one** yellow accent `#FACC15` per slide — the marker highlight on the phrase that carries the slide, and the `Done` pill.
- **Absolutely no purple or violet.**
- Geometric sans throughout; the product name in on-image copy is "Spec Kit Companion", two words.
- No em dashes in on-screen copy.

## The five slides

| # | Role | Copy |
|---|---|---|
| 1 | Hook, names the audience | "Copilot writes the code. **You never see the plan.**" plus the Specify / Plan / Tasks / Done pill row |
| 2 | Visualization payoff | "Every phase, **timed as it ran**" over the run overview |
| 3 | Proof | The 60–68% leaner-specs stat, sourced from `docs/configuration.md#workflow-choice` |
| 4 | Customization | Swap the pipeline, shape commands, pick the assistant — Copilot named first |
| 5 | Close | "See and steer **everything your AI builds**", with the Marketplace search term |

## Audience notes

Written for the US and India Copilot audiences: no idioms, no regional pricing or currency, and the call to action is a Marketplace search rather than a link, so it works when the post strips URLs. The stat is the only number claimed, and it cites the same source of truth the README and Marketplace listing quote — change it there first.
