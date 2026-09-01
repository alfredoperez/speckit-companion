# write-only-specs

A 26-second typographic promo for the blog article **"I Wrote 238 Specs and Never Read One Again"**. It promotes a published article, not a product surface, so like `make-it-yours` it is typographic and reads no capture. Silent, clean loop, published to `media/web/write-only-specs.{mp4,webm}` and copied into the vault as `VID-write-only-specs.*`.

## Why it exists

The article ships with a hero image (`IMG-hero-write-only-specs.png`: marker lettering on warm ivory, a long tangled ink line through closed boxes, one short emerald path with the mascot at its start). This clip is that hero, unrolled in time: the hook lands first, the numbers pile up fast, the tangle draws the cost of specs nothing reads, and the one emerald line is the fix. Every number on screen is the article's own — 94 folders, 238 files, 15,225 lines, 14 living specs — exact, never rounded.

**Frame zero is the fully-stamped hook, not bare ivory.** It is also the web poster: people scrolling read `I wrote 238 specs.` before a single frame plays, and the loop closes on that same frame.

## Art direction

The article's ivory family, sampled from the hero: ground `#faf5ea`, near-black ink `#171512` (soft ink `#46423a` for the quiet lines), and exactly **one** emerald accent motif, `#1f7a3d` — the short living path. Everything else on screen is ink on ivory.

Headline face is **Permanent Marker** (Google Fonts, Apache-2.0 license), vendored as `assets/fonts/PermanentMarker-Regular.ttf` — never a runtime Google Fonts URL. Geist (already vendored by the template) carries the eyebrow and the lockup meta lines. Zero em dashes anywhere on screen; contractions are the author's voice and stay exactly as written. "Spec Kit" is two words in the lockup.

The mascot on the close is the real asset `assets/mascot/poses/mascot-pointing-1788108771000.png` (copied here as `assets/mascot-pointing.png`), placed as an `<img>` with alpha, not redrawn.

## Beats

26.0 s at 30 fps, 1920 x 1080.

| t | Beat |
|---|---|
| 0.0 | Frame 0 already shows the hook fully stamped: `I wrote 238 specs.` then a stamp beneath it: `I never read one again.` |
| 3.0 | Fast stamps, tight rhythm: `94 folders.` `238 files.` `15,225 lines.` then `Reopened: zero.` |
| 7.5 | Wipe to a single centered line: `I thought that was MY filing problem.` |
| 10.5 | The tangled ink line draws fast through the closed boxes; beneath: `My AI never read them either.` then `It re-read the codebase. Every session.` |
| 15.5 | The ink clears. Two stamps: `A spec that nothing reads isn't documentation.` beat `It's exhaust.` |
| 19.5 | The emerald short path cuts left to right through the open box: `14 living specs load first.` |
| 22.5 | Close lockup over the path, mascot fades in at the path start pointing along it: `NEW ON THE BLOG` · `I Wrote 238 Specs and Never Read One Again` · `Spec Kit · Companion` · `speckit-companion.dev` |
| 25.2 | Hard snap back to the frame-0 hook state; the loop closes on the hook, not on blank ivory |

Both ink draws (the tangle and the emerald path) are `stroke-dashoffset` tweens over lengths read from the paths at load, so they seek identically in any frame order. Stamps land with `power3.in` — accelerating the whole way in is what makes them read as stamps rather than fades.

## Render

```
npm run render                                    # in this directory
node scripts/render-web-clips.mjs write-only-specs  # from the repo root
```

- Canonical render: `renders/write-only-specs.mp4`, 1920x1080, 30 fps, 780 frames, 26.0 s, H.264 yuv420p, 0.93 MB.
- Web encodes: WebM 350 KB, MP4 273 KB, poster 63 KB (`poster == frame 0` verified by the encoder; the poster shows the stamped hook).
- Loop verified: frame 0 and the final frame are the same authored state; ffmpeg PSNR on the encoded pair is 58.3 dB (quantization noise only).
- `hyperframes check`: 0 errors, 0 warnings across lint, runtime, layout and motion; 4/4 text checks pass WCAG AA.
- The composition writes its timeline as explicit calls at literal times rather than a `BEATS` array, so `scripts/clip-storyboard.mjs` skips it and this table is read by people, not by the script.

## History

The first cut ran 40.0 s and both looped and postered on bare ivory. Author feedback: too slow, and the hook must be on screen at frame 0 because frame 0 is the poster and people are scrolling. This cut is 26.0 s, opens on the hook already stamped, tightens every beat, trims `whole` from the re-read line, and drops `Code is read only to locate.` (article detail, not scroll material). The loop now closes on the hook instead of blank ivory.
