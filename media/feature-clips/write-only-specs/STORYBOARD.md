# write-only-specs

A 40-second typographic promo for the blog article **"I Wrote 238 Specs and Never Read One Again"**. It promotes a published article, not a product surface, so like `make-it-yours` it is typographic and reads no capture. Silent, clean loop, published to `media/web/write-only-specs.{mp4,webm}` and copied into the vault as `VID-write-only-specs.*`.

## Why it exists

The article ships with a hero image (`IMG-hero-write-only-specs.png`: marker lettering on warm ivory, a long tangled ink line through closed boxes, one short emerald path with the mascot at its start). This clip is that hero, unrolled in time: the numbers land first, the confession undercuts them, the tangle draws the cost of specs nothing reads, and the one emerald line is the fix. Every number on screen is the article's own — 94 spec folders, 238 files, 15,225 lines, 14 living specs — exact, never rounded.

## Art direction

The article's ivory family, sampled from the hero: ground `#faf5ea`, near-black ink `#171512` (soft ink `#46423a` for the quiet lines), and exactly **one** emerald accent motif, `#1f7a3d` — the short living path. Everything else on screen is ink on ivory.

Headline face is **Permanent Marker** (Google Fonts, Apache-2.0 OFL-family license), vendored as `assets/fonts/PermanentMarker-Regular.ttf` — never a runtime Google Fonts URL. Geist (already vendored by the template) carries the eyebrow and the lockup meta lines. Zero em dashes anywhere on screen. "Spec Kit" is two words in the lockup.

The mascot on the close is the real asset `assets/mascot/poses/mascot-pointing-1788108771000.png` (copied here as `assets/mascot-pointing.png`), placed as an `<img>` with alpha, not redrawn.

## Beats

40.0 s at 30 fps, 1920 x 1080. Frame zero is bare ivory and so is the final frame: the loop closes on stillness.

| t | Beat |
|---|---|
| 0.0 | The numbers stamp in one per beat, like rubber stamps: `94 spec folders` `238 files` `15,225 lines` |
| 4.5 | A beat of stillness, then the confession small under the numbers: `I never reopened one.` |
| 9.0 | Wipe to a single centered line: `I thought that was MY filing problem.` |
| 15.5 | A long tangled ink line draws itself through small closed boxes (the hero's long-path motif); beneath: `My AI never read them either.` then `It re-read the whole codebase. Every session.` |
| 23.0 | The ink clears. Two stamps: `A spec that nothing reads isn't documentation.` beat `It's exhaust.` |
| 29.0 | A thick emerald short path draws left to right through one open box: `14 living specs load first.` then `Code is read only to locate.` |
| 35.5 | Close lockup over the path, mascot fades in at the path start pointing along it: `NEW ON THE BLOG` · `I Wrote 238 Specs and Never Read One Again` · `Spec Kit · Companion` · `speckit-companion.dev` |
| 39.5 | Fade to bare ivory; frame 0 and the final frame match for the loop |

Both ink draws (the tangle and the emerald path) are `stroke-dashoffset` tweens over lengths read from the paths at load, so they seek identically in any frame order. Stamps land with `power3.in` — accelerating the whole way in is what makes them read as stamps rather than fades.

## Render

```
npm run render                                    # in this directory
node scripts/render-web-clips.mjs write-only-specs  # from the repo root
```

- Canonical render: `renders/write-only-specs.mp4`, 1920x1080, 30 fps, 1200 frames, 40.0 s, H.264 yuv420p, 1.14 MB.
- Web encodes: WebM 386 KB, MP4 304 KB, poster 5 KB (`poster == frame 0` verified by the encoder).
- Loop verified: frame 0 and frame 1199 are pixel-identical (ffmpeg PSNR reports infinity on the pair).
- `hyperframes check`: 0 errors, 0 warnings across lint, runtime, layout and motion; 4/4 text checks pass WCAG AA.
- The composition writes its timeline as explicit calls at literal times rather than a `BEATS` array, so `scripts/clip-storyboard.mjs` skips it and this table is read by people, not by the script.
