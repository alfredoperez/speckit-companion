# specs-sidebar

A short loop over the Specs tree: the features it lists, the documents each one has produced, what hasn't been created yet, and how far the last run got. Promoted to `docs/screenshots/generated/specs-sidebar.gif`, which the root README embeds under "A sidebar that scales".

## Why it exists

That README section had a still (`docs/screenshots/generated/specs-sidebar.png`) and nothing that pointed at anything in it. The `597-activation-funnel` research decision was to render the three existing compositions (`spec-viewer`, `inline-comments`, `specs-sidebar`) and swap the stills for GIFs, leaving the referenced PNGs in place so no published Marketplace listing 404s. This clip is that swap for the sidebar: the same capture, held still, with a marker walking three rows so the reader is told what the tree is saying instead of decoding a dense screenshot.

One caveat carried over from `docs/visual-assets.md`: the Specs view is a native VS Code TreeView and can't be storybooked, so the capture under this clip is `sidebarTree.tsx`'s presentational recreation, measured off the DevTools snapshots in `docs/reference/sidebar-snapshots/`. When the icon or state logic in `src/features/specs/specExplorerProvider.ts` changes, the recreation has to be updated by hand and this clip re-rendered.

## Source captures

One capture, no state changes. It comes from the `B4 · All three sections` story in `SidebarCapture.stories.tsx` (`video-capture-specs-sidebar-recreation--b-4-full-sidebar`), at 340 x 776 CSS px and DPR 2, so the file is 680 x 1552. It's byte-identical to the published `docs/screenshots/generated/specs-sidebar.png`: same md5, same story, same capture pass.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `sb-b4.png` | The full sidebar: Specs with Active (3) and Completed (2), Profile Photo Upload expanded onto its documents, then the Living Specs and Steering sections beneath. |

The sidebar is 340 CSS px wide and the frame is 1836, so the capture is scaled 5.4x to fill the width and only its top band fits the 1164 px height. What the clip actually shows is capture rows y 8 through 223: the SpecKit title down to Member Status Badges, with Export Directory List cut off at the bottom edge. The Living Specs and Steering sections are in the file but never in frame.

## Beats

13.5 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the expanded spec and its three document rows | Read straight from the files in your repo |
| 6 | the Tasks row, reading "not created" | See what a spec still owes |
| 9 | the next spec's row, reading "T004 · 2h ago" | Otherwise you'd open each spec to find out |
| 12 | rest | — |

Every beat carries `noZoom`, so all four resolve to the same rest camera: the camera never moves in this clip. The capture is already magnified 5.4x by the fit, so the punch-in the other compositions do with a camera move is baked into the framing here, and only the marker and its label ever animate.

## State cuts and dissolves

`CUTS` is empty. There is one capture, so there are no cuts and no dissolves, and nothing under the annotation ever changes.

## Render

```
npm run render                 # in this directory
```

Then the standard GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/specs-sidebar.gif
```

The published file matches those settings where they're readable off it: 960 x 609, 14 fps (7 and 8 centisecond delays alternating), a 128-colour global table, `loop forever`, 110 stored images after `-O3` merges the held frames, 9.43 s of summed delay against the composition's 9.4 s, 858 KB. No step-down was needed; at 9.4 s with a mostly static frame, the standard settings land well under the size target.

- Loop verified on the published GIF: frame 0 and frame 109 are the same rest pose, PSNR 47.4 dB on the worst channel (quantization noise only), `loop forever` set. The same first-to-last comparison on the MP4 render is 56.1 dB.
- Frame zero is the sidebar at rest with no marker and no scrim: the SpecKit title, Specs, Active (3), Profile Photo Upload expanded onto Specification, Requirements, Plan and Tasks, then Member Status Badges. That's the pose a reader sees before the GIF starts.
- `hyperframes check` (0.8.12): 0 errors, 0 warnings across lint, runtime, motion and layout; 0 layout issues across 9 samples. No text checks run, since every word on screen is inside the capture rather than in the composition's own chrome.
