# overview-readme

The long-form loop over the whole Overview page of a completed run: established in one view, then walked section by section, closing on an end card. **It no longer publishes.** `docs/screenshots/generated/overview.gif`, the root README's opening image, is now rendered from the sibling `overview` composition, which walks the same page in ten beats at 23.5 s instead of nine at 29.5 s. This one is kept as the slower cut, with the establishing pull-back and the end card that the faster one has no room for.

`STORYBOARD-v2.md` beside this file is the design and build log for the same composition, including the review decisions and the two as-built addenda. This file is the current shape: source captures, the beat table, the cuts, the encode, and the loop check.

## Why it exists

The claim the README leads with is that a finished run leaves one page holding its whole story, and stock Spec Kit has no such page. A still can't carry that, because the page is taller than any frame worth putting in a README. So the clip pulls back until the entire page fits, makes the claim once, and then proves it section by section: run timing, the living specs it loaded and where it worked, the fence, the checks with their commands, the decisions with what was rejected, and the requirement to task to test table. The sibling `overview-engine` cut reuses this machinery with fewer beats and labels written from the capture angle for the spec-kit extension README.

## Source captures

One tall capture, one camera, no state changes. The page was screen-grabbed at 1224 x 2430 CSS px at device pixel ratio 2 (2448 x 4860 in the file) from the `Video Capture/Episode 1 · Teamboard` A6 completed-overview story with the footer hidden and the scroll container unclamped, so the whole dossier is one image. It's gitignored and re-shot from the Storybook fixture story; the measured element boxes it goes with live in `assets/captures/rects-v2.json`.

| Shot | File | State on screen |
|---|---|---|
| page | `overview-tall.png` | Completed. "Profile photo upload", COMPLETED badge, header facts strip reading 6/6 tasks, 4/4 traced, 5 checks, 55m elapsed. Below it the full page: intent, run overview (Specify 6m 52s, Plan 8m 2s, Tasks 4m 56s, Implement 34m 45s, 54m 36s elapsed), the approach card with living specs `profiles` FOLDED BACK and `media-storage` plus working area and size, the expectations fence in two columns, five verified checks each with its command and a "5 passed" badge, three numbered decisions with WHY and REJECTED, and the coverage table with a "4/4 traced" badge. |
| endcard | `assets/icons/mascot.png` | Not a product capture. The luminance-keyed mascot, tracked in git, used once in the closing card beside the product name. |

`assets/captures/` also holds `overview-full.png`, `overview-blank.png` and `rects.json`. Nothing in `index.html` references them; they're leftovers from the v1 build.

The tracked stills in `storyboard-frames/` are the ground truth for what each section contains, one file per section, captured from the same story.

The capture sits inside a card: interior 1640 x 1040 at (98, 62) in the 1836 x 1164 frame, so at rest the page fills the card edge to edge and the camera pans and zooms within it.

## Beats

29.5 s at 30 fps, 1836 x 1164.

This composition has **no `BEATS` array and no `CUTS` array**. Its beats are written as explicit `camTo` / `sweep` / `lblIn` / `beatOut` calls at literal times, and the beat map is a comment above the timeline. The table below mirrors that map one row per beat, in order, with the labels verbatim from the `.lbl` elements. Anything that parses `BEATS` out of `index.html` will find nothing here.

The `t` column is the beat's first event, which is the previous beat's annotations leaving. The camera move starts 0.06 s later.

| t | Region | Label |
|---|---|---|
| 0.00 | card at rest on the top of the page | — |
| 1.00 | pull back until the whole page fits the card; header facts strip | The whole run. One page. |
| 4.40 | run overview section, swiping the four phase chips | Every phase, timed |
| 7.60 | approach card, swiping the living specs chips row | The specs it loaded, and where it worked |
| 10.55 | expectations section, swiping both column headings | The fence around the work |
| 14.10 | verified section, swiping the pass badge then the first command chip | Checked, with the command that proves it |
| 17.70 | decisions header through decision 02, swiping decision 01's two WHY lines then its REJECTED line | Why, and what was rejected |
| 21.70 | coverage section, swiping the traced badge then the FR-001 row | Requirement to task to test |
| 25.10 | full frame end card over the clip's own ground | And that is not all |
| 28.60 | rest | — |

One thing moves at a time. The camera move finishes, then the swipes run, then the label enters, then the label and swipes leave before the next move. Swipe starts, in order: 2.22 header facts; 5.42 phase chips; 8.37 living specs chips; 11.52 and 11.95 the two fence headings; 15.07 and 15.50 the pass badge and the command chip; 18.67, 19.12 and 19.50 the WHY and REJECTED lines; 22.67 and 23.10 the traced badge and the FR-001 row.

The end card carries three teaser chips under its lead line, reading "Living specs", "Fast path for small changes" and "Your own workflows", then the mascot beside "Spec Kit Companion". It enters as one unit, a 24 px fade up over 0.70 s starting at 25.40, and then holds still.

Labels for the run overview, approach and fence beats sit below their anchors (`.lbl--below`); above them they collided with the intent statement, the phase strip and the fence's own heading. The opening label is anchored to nothing and rests near the foot of the frame.

Every region is a measured element box from the captured DOM, in the capture's own CSS pixels, projected into frame coordinates under whichever camera will be holding still when its swipe runs. The living specs swipe is trimmed to the last chip's right edge, because the list box runs wider than its content.

## State cuts and dissolves

There's no `CUTS` array, because there's only one capture and it's on screen the whole time. The two hard cuts are camera and card moves given a sub-frame duration, which at 30 fps lands no blend frame:

- 27.00, 0.02 s: behind the opaque end card, the camera snaps from the coverage framing back to `REST`. Invisible, because the card covers the frame.
- 28.60, 0.02 s: the end card cuts away, revealing the rest pose. This is the loop's return.

Everything else is a tween: camera moves on `power3.inOut`, swipes as a `scaleX` sweep in `lighten` blend mode, labels fading up 10 px over 0.34 s and out over 0.24 s.

## Render

```
npm run render                 # in this directory, writes to renders/
```

Then the standard GIF recipe from `docs/visual-assets.md`, which is what the published file was actually made with:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/overview.gif
```

No step-down was needed. The flat dark UI takes `dither=none` cleanly and lossy 30 shows no artifacts at README width. Read back off the published file: 960 x 609, 128 colour global table, 392 stored frames, 29.5 s of total delay, `loop forever` flag set, 3,067,622 bytes. The static end card compresses to almost nothing, which is why adding it made the file smaller than the 26.6 s build it replaced.

`docs/screenshots/generated/overview.gif` is the only published output. Overwrite it in place; the filename is referenced from the README and renaming it breaks the published Marketplace listing.

- Loop verified. First decoded frame against last, PSNR 43.7 dB, which is quantization noise only.
- Cut verified frame by frame. Decoded frame 401 is still the end card and frame 402 is the clean rest pose: measured against frame zero those read 21.0 dB then 43.7 dB, one step, so no blend or ghost frame lands on the cut.
- Frame zero is the top of the completed Overview at rest inside the card, unannotated, camera at scale 1. Brand goes at the end and never the start, so the mascot and product name appear only in the closing card. That's a standing decision, not an accident of ordering.
- No `hyperframes check` result has been recorded for this composition. The engine cut that reuses its machinery is recorded as passing clean.
