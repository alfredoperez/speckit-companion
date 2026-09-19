# coverage

A 7.9 second pass over the coverage table at the foot of a completed run's Overview: the requirement-to-task-to-test grid as a whole, then one row read down to its task chips and its test count. It renders to this project's own `renders/`; it is not promoted to `docs/screenshots/generated/`, and no README or doc page embeds it. `media/manifest.json` records it as `shipped` with `readmeGif` and `docsStill` both null, and names its web outputs for the site.

## Why it exists

It is the only composition that stops on the coverage table. `overview` tours the top of the page and `overview-readme` tours the whole page, so in both the coverage grid goes past in a few seconds on the way somewhere else. This clip does nothing but that table, which is what a page needs when the claim being made is traceability rather than "here is the Overview".

## Source captures

One capture, one camera, no state changes. It is a screen grab of the `Video Capture/Episode 1 · Teamboard` completed-Overview story scrolled to the coverage section, taken at 1224 x 776 CSS px at device pixel ratio 2, so the file is 2448 x 1552. It is gitignored and re-shot from the Storybook fixture story.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `overview-coverage.png` | Completed. "Profile photo upload", COMPLETED badge, the pipeline rail with Specification, Plan and Tasks all checked, and the Overview scrolled to COVERAGE: "Requirement → task → test" with a 4/4 traced badge and four rows, FR-001 to FR-004, each with its delivery task chips and its evidence test count. |

## Beats

10.8 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the coverage table, column headings down through the FR-004 row | Without it you take the run's word for it |
| 6 | the FR-002 row, its T002 chip and its 2 tests evidence | Where one ask got built and what exercises it |
| 9 | rest | — |

The second beat's rectangle sits inside the first one's, so the clip reads as one punch-in rather than a move across the page. The last beat has no rect: it is `rest: true` with a 0.9 s move back to the identity framing, and the marker and label fade out under it.

`CLAMP` is on, so the camera never sees past the edge of the capture and `--clip-ground` never renders.

## State cuts and dissolves

None. The `CUTS` array is empty, because there is one capture on screen from the first frame to the last. The only transitions are the two camera moves and the marker handoff, which clears the outline while the camera travels rather than morphing it between regions.

Frame zero is the capture at 1:1 with no marker and no scrim, which is the pose the closing rest beat returns to.

## Render

```
npm run render                 # in this directory
```

There is no published GIF for this composition, so there are no as-shipped encode settings to record. If it is ever promoted, the standard recipe from `docs/visual-assets.md` applies:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/coverage.gif
```

`renders/` is gitignored, so the MP4 there is a local artifact rebuilt by `npm run render`, not something a clone starts with.
