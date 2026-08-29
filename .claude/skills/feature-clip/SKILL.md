---
name: feature-clip
description: Build, retime, restyle or re-render a SpecKit Companion feature clip —
  the short looping videos on the landing page and in the docs. Covers the whole
  chain from Storybook capture to the file the site serves.
compatibility: Requires ffmpeg, and npx access for hyperframes
metadata:
  author: alfredo
  source: repo
---

# Feature clip

The landing page and the docs are carried by short looping clips: a product screenshot,
a camera that moves across it, a ring around the region being named, and a caption band.
This skill owns **how this repo makes them**. The composition contract itself — GSAP
timelines, the HyperFrames runtime, keyframes, the CLI — belongs to the upstream
`hyperframes-*` skills. Defer to those for anything about the engine, and use this for
anything about the pipeline.

## The chain

```
capture → compose → storyboard → render → web encode → sync → check
```

Every stage has a command. None of them takes an argument you have to remember.

```bash
npm run clips:new -- <id> "Human name"     # scaffold from _template
npm run clips:capture -- --clips <id>      # shoot the source PNGs from Storybook
(cd media/feature-clips/<id> && npm run render)   # composition -> canonical MP4
npm run clips:render -- <id>               # -> media/web: webm, mp4, poster, 16:9 card
npm run clips:stills                       # hero and accordion crops -> media/web
npm run clips:gifs -- <id>                 # -> docs/screenshots/generated/<id>.gif
npm run clips:sync                         # -> website/public/media
npm run clips:check                        # storyboard drift + manifest
npm run clips:outline -- <id>              # pacing: t, hold and label per beat
npm run clips:scenes -- <id>               # scene and step list, for review
```

`clips:capture` with no `--clips` shoots the documentation images instead: the
`STORIES` list, which feeds `docs/screenshots/generated/`. Both lists live in
`scripts/capture-docs-images.mjs`.

`npm run clips:render -- --list` prints which render file each id resolves to. **Run it
before any full encode.** It is how you catch a stale source before it ships.

## Starting a new clip

`npm run clips:new` copies `media/feature-clips/_template`, substitutes the id, adds a
`CLIP_CAPTURES` stub, and registers the feature in `media/manifest.json`. Do not copy a
neighbouring composition by hand: the template is where the current caption, scrim and
pacing rules live, and a hand copy inherits whichever clip happened to be nearest.

The template renders as-is against a placeholder capture, so `npm run render` works
before you have shot anything. Get it rendering first, then make it real.

## The rules a clip has to hold

- **Open still.** The first beat starts no earlier than `t = 3.0`. Before that the
  camera rests and nothing is marked. The site will not even start playback until the
  frame is fully on screen, so this hold is the first thing anyone sees.
- **Never hold under 3.0s.** A beat's hold is the gap to the next beat's `t`; there is
  no hold constant. Retiming means rewriting the `t` column, in the composition and in
  `STORYBOARD.md`.
- **`maxS` above about 2.2 stops reading as a product** and starts reading as a crop.
- **Captions are a band**, not a pill on the marker. `.lbl` lives in `#anno`, which is a
  sibling of `#stage`, so it is in frame coordinates and never scales with the camera.
  It pins to whichever edge its region sits furthest from.

## Traps

Each of these has already cost someone a session.

- **Rects are measured, not authored.** Every `r: [x, y, w, h]` in `BEATS` is a real
  `getBoundingClientRect` box in **the capture's own CSS pixels**. Captures are DPR 2,
  so a 2448×1552 file is 1224×776 in rect space. Eyeballing a rect produces a clip that
  points at nothing.
- **The encoder picks the newest render, not `<id>.mp4`.** `sourceFor()` sorts
  `renders/*.mp4` by mtime. A stale canonical once shipped three-renders-old labels to
  the site. `--list` shows the choice and warns when a newer take is being preferred.
- **Every tween is `fromTo` with `immediateRender: false`.** The renderer seeks by frame
  in arbitrary order, so a tween without an explicit start pose makes frame zero show
  the last move's "from". Initial state comes only from the `gsap.set` calls.
- **`CUTS` are not retimed with `BEATS`.** Move a beat and the state change that belongs
  to it stays where it was. Retime both, together.
- **A cut before the first beat runs during the opening hold**, which is almost always
  wrong: the hold should already show the state the first caption talks about.
- **The poster is MD5-verified against the WebM's first decoded frame.** That check is
  what catches half-synced media. Never route around it.
- **Labels are mirrored in `STORYBOARD.md` and the check enforces `t` and the label
  text.** `node scripts/clip-storyboard.mjs --apply <id>` writes storyboard label edits
  back into the composition. Rects stay code-owned and are never in the storyboard.
- **Hand-authored compositions have no `BEATS`** and are skipped by the checker by
  design: `make-it-yours`, `overview-engine`, `overview-readme`.
- **An underscore prefix means scaffolding.** `_template` is skipped by the storyboard
  checker and the encoder.

## Retheming

Two seams, and a re-theme almost always needs both.

**The captures.** `.storybook/capture-theme.ts` holds named palettes and one line —
`activeCapturePalette` — that decides which one every story, screenshot and clip frame
renders in. The fifty-odd `--vscode-*` variables are derived from a short set of roles,
so a re-theme is a handful of role edits rather than fifty coordinated ones. The set
currently ships **Constellation Light**, which is why the product reads as a light
surface on the site's near-black ground.

**The composition chrome.** The marker, scrim and caption band a clip draws over the
screenshot live in the `:root` block of its own `index.html`, named by role.

The trap is a composition that is **drawn rather than captured** — `make-it-yours`,
`living-specs-explained`. Those have no screenshot under them, so the capture palette
cannot reach them at all and they have to be re-themed by hand or they end up as the one
dark thing in a light set. The same trap caught the README composite stories, which had
hardcoded a dark theme's neutrals instead of reading the derived variables; they read
the palette now, and new composite chrome must too.

After a re-theme, everything downstream is stale: re-shoot both capture lists, re-render
every composition, then `clips:render`, `clips:stills`, `clips:gifs`, `clips:sync`.

## Where things live

| What | Where |
| --- | --- |
| Compositions | `media/feature-clips/<id>/` |
| Template | `media/feature-clips/_template/` |
| Capture list | `CLIP_CAPTURES` in `scripts/capture-docs-images.mjs` |
| Capture palette | `.storybook/capture-theme.ts` |
| Canonical renders | `media/feature-clips/<id>/renders/` (gitignored) |
| Web outputs | `media/web/` (gitignored) |
| What the site serves | `website/public/media/` |
| Asset registry | `media/manifest.json` |
| Encode settings | `DEFAULTS` in `scripts/render-web-clips.mjs` |

## Encode settings, and why they are what they are

1440 px wide, H.264 CRF 26, VP9 CRF 40. The composition frame is 1836×1164 and the site
paints it into 864 CSS px, which is 1728 device px on a 2× display. The previous 960 px
encode was upscaled almost 2× in the browser on top of a 1.9× downscale in ffmpeg, and
CRF 32 smeared small UI text on the way. Width buys more than quantizer here, which
`media/WEB-RENDERS.md` established with a VMAF sweep before the numbers were raised.

Total bytes are not on the critical path: the `<video>` elements carry `preload="none"`
and only play when their tab is selected, so a visitor fetches the posters plus at most
one clip.
