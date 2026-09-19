# spec-viewer

The 10 second look at a spec rendered as a page: the requirements column, the on-page navigation that indexes it, and the pipeline rail with each step's sub-documents hanging off it. Promoted to `docs/screenshots/generated/spec-viewer.gif`, which the README embeds under **Visual Spec Viewer**.

## Why it exists

The README's first feature claim is that specs render as structured pages instead of walls of markdown, and a still can show that the page exists but not how its three parts relate. This clip holds on one finished spec and names them in order, so the reader sees the requirement rows, then the nav that lists them, then the rail those documents hang from. Nothing on screen changes state, which is the point: this is the reading surface, not the run.

## Source captures

One capture, from the Storybook story `A7 · Completed, spec document` in `webview/src/spec-viewer/__stories__/VideoCapture.stories.tsx`, fed by the Teamboard fixture. The PNG is 2448 x 1552, which is the 1224 x 776 capture stage (`STAGE_WIDTH` / `STAGE_HEIGHT` in `__stories__/captureFrame.tsx`) at DPR 2, so every rect in `BEATS` is a real measured element box in that space.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `spec-a7.png` | Completed. The spec document for "Profile photo upload" with the COMPLETED badge, Specification, Plan and Tasks all checked, Checklist under Specification, Research and Data Model under Plan, and the footer offering Archive and Reactivate. |

## Beats

13.75 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the Functional Requirements list, FR-001 through FR-004 | Scan the asks without decoding markdown |
| 6 | the on-page navigation panel, from its heading down to Out of Scope | Jump to the section you came for |
| 9 | the pipeline rail, from the PIPELINE heading down to Tasks | One click to any document the run wrote |
| 12 | rest | — |

`CUTS` is empty. There's one capture and no state change, so nothing cuts and nothing dissolves: the whole clip is one camera and one marker over a single still. The last beat is `rest`, a 0.9 s move back to the identity framing, and that move is what closes the loop.

`CLAMP` is on, so the camera never sees past the edge of the capture. On the rail beat that clamp bites: the fit would push the frame right of the capture's left edge, so the camera holds flush to the edge instead of centring the rail. The `--clip-ground` token therefore never renders in this clip.

## Render

```
npm run render                 # in this directory
```

Then the standard GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/spec-viewer.gif
```

The published file reports those settings back: 960 x 609, a 128 colour global table, `loop forever`, 2.0 MB. It stores 140 images rather than the 141 that 10.1 s at 14 fps implies, because `-O3` merged one identical pair into a single 0.15 s frame; the rest alternate 0.07 s and 0.08 s, which is how 1/14 s rounds to centiseconds.

- Loop verified: frame zero and the final frame are the same full-page rest pose with no marker and no label, PSNR 44.8 dB (quantization noise only), `loop forever` flag set.
- Frame zero is the whole completed spec at the identity camera, filling the frame edge to edge, which is the pose a reader sees before the GIF starts.
