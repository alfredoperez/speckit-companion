# run-in-flight

The 30 to 60 second demo clip of a run **in flight**: the live pipeline rail and per-phase timing together, not a tour of a finished run. Promoted to `docs/screenshots/generated/run-in-flight.gif`.

## Why it exists

No existing composition shows both halves of what the product is loved for. `step-rail` shows the rail moving through states (including the running one) but stops before the timing payoff; `overview` shows the recorded per-phase timing but only on a settled run. This composition runs the rail forward through four real states and then lands on the run overview, so the timing readout arrives as the consequence of the run the viewer just watched.

## Source captures

All four rail captures are copied from `step-rail/assets/captures/` and the overview capture from `overview/assets/captures/` — real captured UI from the Teamboard fixture stories, never an invented panel. They share one capture space (1224 x 776 CSS px at DPR 2), which is what lets one camera solve every beat.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `step-a1.png` | Specified. Specification checked, Plan and Tasks still locked. |
| sh1 | `step-a3.png` | Planned. Plan checked with its sub-documents, Tasks unlocked next. |
| sh2 | `step-a4.png` | Tasks created. The task list laid out in two phases. |
| sh3 | `step-a5.png` | Implementing. Tasks at 50 percent, one task in progress, actions locked while the step runs. |
| sh4 | `overview-top.png` | Completed. Run overview with per-phase timing: Specify 6m 52s, Plan 8m 2s, Tasks 4m 56s, Implement 34m 45s. |

## Beats

36.0 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | pipeline rail | What's ahead, not just what's done |
| 7.7 | footer action | The forward action is named for the next step |
| 12.5 | pipeline rail (planned) | New documents appear as the step writes them |
| 17.5 | task list | Each line is one unit the run checks off |
| 22.3 | pipeline rail (running, 50%) | Counted from the boxes ticked in tasks.md |
| 27.3 | footer, locked | No way to push a step that's already running |
| 31.9 | run overview timing row | The run you just watched, measured |
| 36.3 | rest | — |

State cuts land just before each beat's camera move; the last two transitions dissolve (0.8 s into the overview, 1.2 s back to frame zero) so the loop closes without a flash.

**Two beats ring empty ground, and the labels on them describe a surface that is not in the capture.** The footer is missing from all four `step-*` captures: the band it occupies in this capture space, roughly y 700 to 770, is bare background in every file. Checked by cropping each capture's bottom band. So beats 2 and 6 here, and the footer beat in `step-rail`, aim at nothing. Their labels were rewritten to phrasings the claim ledger clears, but no label can add what the pixels do not show when the pixels show nothing. Re-shooting the A1 to A5 stories with the footer inside the capture box, and re-measuring those rects, is what fixes it.

## Render

```
npm run render                 # in this directory
```

Then the established GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=12,scale=880:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=12,scale=880:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=45 --loop raw.gif -o docs/screenshots/generated/run-in-flight.gif
```

This clip steps down from the usual 960 px / 14 fps to **880 px / 12 fps at lossy 45**: at 36 s it is the longest clip in the set, and the standard settings landed at 4.6 MB. The step-down brings it to 3.7 MB (412 stored frames) with no visible artifacts at README width.

- Loop verified: frame zero and the final frame are the same rest pose, PSNR 46.6 dB (quantization noise only), `loop forever` flag set.
- Frame zero is the specified-state rail at rest, which is the pose a reader sees before the GIF starts.
- `hyperframes check`: 0 errors, 0 warnings. One info at t=30 s (the longest label overflows its marker box upward) is expected and correct — the label is deliberately allowed to hang outside its marker via `data-layout-allow-occlusion`.
