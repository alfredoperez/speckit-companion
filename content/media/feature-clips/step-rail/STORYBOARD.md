# step-rail

The pipeline rail and the next-step button, watched together as one run moves from specified to implementing. It renders to this project's own `renders/`; it isn't promoted to `docs/screenshots/generated/`, and nothing in the README or the docs embeds it.

## Why it exists

It's the composition that shows the rail as a state machine rather than a picture: the same two regions, the rail on the left and the action in the footer, re-read against four real captures of the same spec at four different points. It stops at the implementing state and never reaches the timing payoff, which is what `run-in-flight` was later built to add. `run-in-flight` copies all four of these captures out of `step-rail/assets/captures/`, so anything that invalidates them invalidates both clips.

## Source captures

Four captures of the same fixture spec from `Video Capture/Episode 1 · Teamboard` (`VideoCapture.stories.tsx`), all at 1224 x 776 CSS px and DPR 2, so each file is 2448 x 1552. One capture space for all four is what lets a single camera solve every beat, and it's why a state cut can land mid-move without the frame jumping.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `step-a1.png` | A1, specified. Specification checked, Plan and Tasks still locked, footer reads "Next: Plan" with Regenerate and Plan. |
| sh1 | `step-a3.png` | A3, planned. Plan checked and expanded onto Research and Data Model, Tasks still open on the rail, footer reads "Next: Tasks". |
| sh2 | `step-a4.png` | A4, tasks created. Tasks checked on the rail, six tasks laid out in two phases with none checked, footer reads "Next: Implement". |
| sh3 | `step-a5.png` | A5, implementing. Tasks at 50%, T004 in progress, footer replaced by "Step running, actions unlock when it settles". |

## Beats

14.3 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the pipeline rail, from the PIPELINE heading down through Tasks | Grey means its document doesn't exist yet |
| 6 | the footer action, bottom right | The forward action is named for the next step |
| 9.7 | the pipeline rail again, now on the implementing capture | Counted from the boxes ticked in tasks.md |
| 12.7 | rest | — |

Beats 0 and 2 name the identical rectangle. The camera goes back to the same framing it opened on, so the only thing that has changed between the two readings is the capture underneath, which is the argument the clip is making.

**Two beats ring empty ground, and the labels on them describe a surface that is not in the capture.** The footer is missing from all four `step-*` captures: the band it occupies in this capture space, roughly y 700 to 770, is bare background in every file. Checked by cropping each capture's bottom band. So the footer beat here, and beats 2 and 6 in `run-in-flight`, aim at nothing. Their labels were rewritten to phrasings the claim ledger clears, but no label can add what the pixels do not show when the pixels show nothing. Re-shooting the A1 to A5 stories with the footer inside the capture box, and re-measuring those rects, is what fixes it.

## State cuts and dissolves

Four entries in `CUTS`, three hard and one dissolve.

Two of the hard cuts, at 4.4 s and 5.5 s, land while the camera is parked on the footer, which it reaches at 3.75 s and doesn't leave until 6.6 s. The button relabels from Plan to Tasks to Implement inside a frame that never moves.

The third hard cut, at 7.15 s, lands during the move back to the rail (6.6 s to 7.45 s), roughly at the moment the marker settles onto the implementing rail at 7.16 s, so the "Live percent" label arrives on a rail that has already switched to the running state.

The last transition, at 9.2 s, is a 0.9 s dissolve from the implementing capture back to the specified one, running under the camera's 0.9 s return to rest. Both finish at 10.1 s, leaving 0.7 s of hold before the loop closes.

## Render

```
npm run render                 # in this directory
```

There is no published GIF for this composition, so there are no as-shipped encode settings to record. If it's ever promoted, the standard recipe from `docs/visual-assets.md` applies:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/step-rail.gif
```

The MP4 in `renders/` is 1836 x 1164, 30 fps, 324 frames, 10.8 s. `renders/` is gitignored, so that file is a local artifact rebuilt by `npm run render`, not something a clone starts with.

- Loop verified on the MP4 render: frame 0 and frame 323 are the same rest pose, PSNR 47.1 dB on the worst channel (encode noise only).
- Frame zero is the specified-state viewer at 1:1 with no marker and no scrim: Specification checked, Plan and Tasks locked, and the footer offering Plan. That's the pose a reader sees before the loop starts, and it's the frame the closing dissolve returns to.
- `hyperframes check` (0.8.12): 0 errors, 0 warnings across lint, runtime, motion and layout; 0 layout issues across 9 samples. No text checks run, since every word on screen is inside the captures rather than in the composition's own chrome.
