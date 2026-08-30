# overview

The landing page's **first tab**, so the first moving thing anyone sees: a fast, continuous read down the whole Overview page of a completed run. Ten regions in 23.5 seconds, top of the page to the bottom of the coverage table. Promoted to `docs/screenshots/generated/overview.gif`.

## Why it exists

The claim is that a finished run leaves one page holding its whole story. The clip that used to sit here made a third of that claim: four beats, three labels, ten seconds, and it never moved past the intent statement and the card under it, so a reader met the product at the shallowest point of its best page. This version walks the page the way someone reading a stranger's run actually walks it, and it goes at reading speed rather than presentation speed: 2.1 s a beat against 2.5 s in the clip it replaces and 3.2 to 5.0 s everywhere else in the set. The camera move starts on the same frame the outgoing label begins its fade, so travel overlaps the tail of each hold and the whole thing reads as one scroll rather than ten slides.

It is the shortest full-page tour in the set. `overview-readme` covers the same page in 29.5 s with an establishing pull-back and a closing end card; `coverage` stops on the last section alone; `run-in-flight` reaches this page only in its final beat, as the payoff of a run it watched happen.

## Source captures

One capture, one camera, no state changes. The whole dossier is a single tall image: the `Video Capture/Episode 1 · Teamboard` A6c story with the Overview's scroll container opened out and the floating action footer hidden, screen-grabbed at 1224 x 2430 CSS px at device pixel ratio 2 (2448 x 4860 in the file). It lives in this composition's own `assets/captures/`, is gitignored, and is re-shot with `node scripts/capture-docs-images.mjs --clips overview`.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `overview-tall.png` | Completed. "Profile photo upload", COMPLETED badge, the pipeline rail with Specification, Plan and Tasks all checked, and the entire dossier in one image: intent, the run overview strip (Specify 6m 52s, Plan 8m 2s, Tasks 4m 56s, Implement 34m 45s, 54m 36s elapsed), the approach and living specs card beside working area and size, the expectations fence in two columns, five verified checks each with the command it ran, three numbered decisions with their WHY and REJECTED lines, and the coverage table with a "4/4 traced" badge. |

The 2430 px height is a contract shared with `overview-readme` and `overview-engine`: all three read the same A6c story, and every rect in all three is measured in that space. Changing the story's `parameters.capture` height silently aims every camera move in three compositions at the wrong element.

At scale 1 the page is 1836 x 3645 frame px, so the frame shows 776 CSS px of it at a time, which is exactly the height of the ordinary 1224 x 776 clip captures. Scale 1 is therefore the page at natural reading size, and the camera travels down it.

## Beats

34.9 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 1.6 | intent kicker and statement | What the work was actually for |
| 4.6 | run overview strip, heading through the four phase chips | A time only where both ends were recorded |
| 7.6 | approach label and paragraph, left of the meta card | The shape it took, without reading the diff |
| 10.6 | working area label and paragraph, right column | Which corner of the codebase it changed |
| 13.6 | size label and paragraph, right column | How big the run judged it, before starting |
| 16.6 | living specs block and its chip row, left of the meta card | The standing knowledge it loaded before drafting |
| 19.6 | the whole expectations section, head and both fence columns | What it held to, and what it left alone |
| 22.6 | the whole verified section, head and all five checks with their commands | Each claim carries the command that produced it |
| 25.6 | decisions head through decision 02, both REJECTED lines in frame | The losing option, kept so nobody argues it twice |
| 28.6 | the whole coverage section, head through the FR-004 row | Gaps sort to the top, when there are any |
| 31.6 | rest | — |

Every region is a real element box measured with `getBoundingClientRect` against the capture box, in the capture's own CSS pixels, taken off the live A6c story rather than read off the image. The selectors, in beat order: `.dossier-intent > .dossier-kicker` united with `.dossier-intent__statement`; `.dossier-timing`; the label and paragraph inside `.dossier-intent__approach`; the first and then the second label-and-paragraph pair inside `.dossier-intent__context`; `.dossier-intent__living-specs`; and the four sections `section[aria-label="Expectations"]`, `[aria-label="Verified"]`, `[aria-label="Decisions"]` (united with its first two decisions) and `[aria-label="Coverage"]`.

The camera solves each one with `camFit` at `pad` 130 and `maxS` 1.9. The six full-width sections are width-limited by the 776 px reading column and settle at scale 1.35 (1.24 for verified, which is the tallest section on the page), so those six beats hold one steady reading scale and the clip only travels. The four beats inside the meta card punch to 1.9, which is the one place the page needs a closer look. `CLAMP` is on and generalised to the capture's real height, so the frame never sees past the page: the intent beat pins to the top edge and the two right-column beats pin to the right edge.

The last beat has no rect. It is `rest: true` with a 1.3 s move, longer than the 0.72 s used elsewhere because it travels the full height of the page back to the opening pose while the marker and label fade out under it.

## State cuts and dissolves

The `CUTS` array is empty. There is one capture on screen from the first frame to the last, so there are no state cuts and no dissolves. The only transitions are the ten camera moves and the marker handoff, which clears the outline for 0.24 s while the camera travels rather than morphing it between regions.

Frame zero is the top of the page at scale 1, unannotated and unzoomed: the header, the intent statement, the run overview strip, the meta card and the first hairline of the expectations section, which is what the viewer shows on opening. The clip closes on the same pose.

## Not filmed

Nothing on the ten-region list was dropped. All ten are inside the single A6c capture and all ten are filmed.

Two things about this page are deliberately outside the clip. The floating action footer is hidden in the A6c story, so no footer beat is possible here; `run-in-flight` and `step-rail` are where footer state belongs, and both of those record the same footer's absence from their own captures. The collapsed "Run log and 6 task records" disclosure at the foot of the page is in the capture but closed, so there is nothing behind it to film; opening it needs a new story, and the `coverage` composition is the one that would grow it.

## Render

```
npm run render                 # in this directory
```

Then the GIF recipe from `docs/visual-assets.md`, at this composition's stepped-down settings, which is what the published file was made with:

```
ffmpeg -i <render>.mp4 -vf "fps=12,scale=880:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=12,scale=880:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=45 --loop raw.gif -o docs/screenshots/generated/overview.gif
```

This clip steps down from the usual 960 px / 14 fps at lossy 30 to **880 px / 12 fps at lossy 45**, the same exception `run-in-flight` takes and for the same reason. Almost every frame here is a camera move, so nothing between beats compresses away: the standard settings landed at 4.3 MB. The step-down brings it to 3.2 MB with no artifacts at README width, and the monospaced command chips in the verified section, which are the tightest type anywhere in the clip, stay readable.

Read back off the published file: 880 x 558, 128 colour global table, 281 stored frames, `loop forever` flag set, 3,345,658 bytes.

`docs/screenshots/generated/overview.gif` is the only published output, and the filename is referenced from the root README. Overwrite it in place; renaming it retroactively 404s the published Marketplace listing.

- Loop verified. The final beat returns the camera to `REST` and the marker and label fade out at 21.6, so the last 0.6 s holds the same pose the clip opens on. Measured on the render: first frame against last, PSNR 47.8 dB, which is quantization noise only. On the published GIF the same pair reads 45.8 dB.
- Frame zero is the completed Overview at rest, at the top of the page, camera at scale 1, marker hidden.
- `hyperframes check`: 0 errors, 0 warnings. Lint, runtime, motion and layout all clean across 9 sampled frames.
