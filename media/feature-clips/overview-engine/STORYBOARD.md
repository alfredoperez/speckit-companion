# Overview GIF, engine cut. Storyboard

**Status: BUILT (2026-08-24).** This is the shorter, engine-angled variant of
`../overview-readme/` for the engine README (`speckit-extension/README.md`).
That README tells the CAPTURE story: your existing Spec Kit commands run
unchanged, the extension records everything, and the record becomes this page.
The labels here speak from that angle; the readme cut's labels speak from the
"this page exists" angle.

One loop, 16.5 s at 30 fps (495 frames), 1836 x 1164, reusing the
overview-readme composition machinery unchanged: same card geometry, same
measured-rect projection, same 44 px glowing label style, same one-thing-moves-
at-a-time rule, same seamless loop back to the frame-zero rest pose.

## What is reused, what is not

- `assets/captures/overview-tall.png` and `rects-v2.json` are copies of the
  overview-readme capture (gitignored; regenerate exactly as described in
  `../overview-readme/STORYBOARD-v2.md` under "Capture plan").
- `assets/icons/mascot.png` is the same luminance-keyed mascot.
- Dropped from the readme cut: the header-facts swipe, the living-specs beat,
  the expectations beat, the decisions beat, and the teaser chips on the end
  card. Four content beats remain, plus a sign-off end card.

## Beats (as built)

- **B0 · 0.00 to 0.70** · Frame zero: top of the finished Overview at rest.
- **B1 · 0.70 to 3.45** · Camera pulls back until the whole tall page fits.
  Label (free, bottom center): **"Your run, recorded"**. No swipe: the claim
  is the page itself.
- **B2 · 3.45 to 6.75** · Push in to RUN OVERVIEW; swipe the four phase chips.
  Label (below): **"Every phase, timed automatically"**.
- **B3 · 6.75 to 10.30** · Scroll to VERIFIED; swipe the "5 passed" badge,
  then the first command chip. Label: **"Checks captured with their commands"**.
- **B4 · 10.30 to 13.85** · Scroll to COVERAGE; swipe the "4/4 traced" badge,
  then the FR-001 row. Label: **"Requirements traced to tests"**.
- **B5 · 13.85 to 15.95** · Sign-off end card enters as ONE unit (fade up
  24 px over 0.70 s) on the piece's own dark ground: lead line **"Recorded by
  the companion extension"** in the 44 px glowing label style, then the mascot
  at 88 px beside **"Spec Kit Companion"** (two words: the standing on-image
  branding rule). Behind the opaque card the camera snaps home at 15.15 in
  0.02 s.
- **B6 · 15.95 to 16.50** · Hard cut (0.02 s) to the rest pose; the tail
  matches frame zero so the loop is seamless.

## Render pipeline (same as overview-readme)

- MP4: `npx hyperframes@0.8.12 render` (16.5 s, 1836 x 1164). `hyperframes
  check` passes clean (lint, runtime, layout, motion, contrast).
- GIF: 960 x 609 at 14 fps. ffmpeg palettegen (stats_mode=diff, 128 colors) +
  paletteuse (dither=none, diff_mode=rectangle), then gifsicle -O3 --lossy=30.
  Result 1.7 MB (224 stored frames, loop forever flag set). Copied to
  `docs/screenshots/generated/overview-engine.gif`, referenced from the engine
  README's Traceability section by absolute raw.githubusercontent URL.
- Loop verified: last GIF frame vs frame zero PSNR 43 dB (quantization noise
  only). Cut verified frame by frame: end card through 15.93, clean rest pose
  from 16.00, no blend or ghost frame.
