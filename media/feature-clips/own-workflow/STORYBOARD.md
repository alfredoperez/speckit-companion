# own-workflow

The clip for the pick-a-pipeline guide: a workflow you defined in `speckit.customWorkflows` shows up in Create New Spec next to the two built-ins, you pick it, and the spec the run creates builds its step rail from it.

## Why it exists

The customization story is usually told in settings JSON, which shows the input and never the payoff. This composition shows the payoff twice: the custom workflow standing in the same list as stock SpecKit and SpecKit Companion, each with its own description, and then the created spec's pipeline rail leading with the Discussion step that only the custom workflow declares. Nothing here is drawn: all three shots are real captured UI.

## Source captures

Three captures share one capture space (1224 x 776 CSS px at DPR 2, so 2448 x 1552 pixels), which is what lets one camera solve every beat.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `ow-choice.png` | Create New Spec with three workflows listed: SpecKit, SpecKit Companion, and Discuss First. SpecKit is selected. |
| sh1 | `ow-picked.png` | The same dialog with Discuss First selected. |
| sh2 | `ow-rail.png` | The created spec in the viewer. The pipeline rail reads Discussion, Specification, Plan, Tasks, with Discussion and Specification both closed. |

Discuss First is the custom workflow: it is the only one of the three whose rail starts with a Discussion step, which is what makes the last beat legible.

## Beats

18.7 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | workflow list, label and all three cards | Chosen at creation, then every step follows it |
| 6.3 | the two built-in workflow cards | Both are there before you configure anything |
| 9.5 | all three workflow cards | The third one came from your settings file |
| 12.9 | pipeline rail on the created spec | Your own phase becomes a step of the run |
| 16.9 | rest | — |

The first three beats hold one camera and move only the marker, because the dialog's cards run nearly the full width of the capture and there is no honest punch-in left to make. Beat 3 widens back out to hold all three cards rather than ringing the picked one, so the selected border is seen moving from the first card to the third instead of disappearing under the marker. Beat 4 is the only camera move: a 1.7x push onto the rail, clamped so the frame never sees past the capture edge.

Cuts: the pick dissolves over 0.3 s at t=7.4, right under the marker handoff, so the selection border moves rather than pops. The created spec dissolves in over 0.7 s at t=10.6 and lands just as the marker settles on the rail. The last dissolve, 0.9 s at t=14.8, returns to frame zero's shot while the camera pulls back to rest, so the loop closes.

## Render

```
npm run render                 # in this directory
```

Then the established GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/own-workflow.gif
```

- Frame zero is the Create New Spec dialog at rest with the workflow list in view, which is the pose a reader sees before the clip starts.
- Loop verified: frame 0 and frame 497 are the same rest pose. Mean absolute difference 0.22 per channel out of 255, PSNR 49.6 dB, 1272 of 2.1 M pixels differing by more than 8, all of them on text edges. That is H.264 quantization noise, not motion.
- Render: 498 frames, 16.6 s, 2.4 MB at 1836 x 1164, 30 fps.
- `hyperframes check`: 0 errors, 0 warnings, 0 layout issues across 9 samples.
