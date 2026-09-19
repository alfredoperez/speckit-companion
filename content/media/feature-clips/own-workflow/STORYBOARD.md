# own-workflow

The clip for the pick-a-pipeline guide: a workflow you defined in `speckit.customWorkflows` shows up in Create New Spec next to the two built-ins, you pick it, and the spec the run creates builds its step rail from it.

## Why it exists

The customization story is usually told in settings JSON, which shows the input and never the payoff. This composition shows the payoff twice: your own workflow picked in the same control the two built-ins live in, carrying the description you wrote for it, and then the created spec's pipeline rail leading with the Discussion step that only that workflow declares. Nothing here is drawn: all three shots are real captured UI.

**The picker is a native `<select>`, so only the chosen workflow is ever on screen.** The earlier cut of this clip framed a stack of radio cards and could show all three workflows at once; the shipped form cannot, and a native dropdown's open list is OS chrome with no DOM to capture. So the pick itself carries the beat that the side-by-side shot used to: the dissolve to the picked state runs under the marker while it settles, and the row is seen changing from SpecKit to Discuss First rather than the two being compared.

## Source captures

Three captures share one capture space (1224 x 776 CSS px at DPR 2, so 2448 x 1552 pixels), which is what lets one camera solve every beat.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `ow-choice.png` | Create New Spec with the workflow picker reading SpecKit, the default. No banner under it: both built-ins are installed and stock SpecKit has nothing extra to say. |
| sh1 | `ow-picked.png` | The same form with Discuss First picked, and the banner under the picker carrying that workflow's own description. |
| sh2 | `ow-rail.png` | The created spec in the viewer. The pipeline rail reads Discussion, Specification, Plan, Tasks, with Discussion and Specification both closed. |

Discuss First is the custom workflow: it is the only one of the three whose rail starts with a Discussion step, which is what makes the last beat legible.

## Beats

18.7 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | workflow row, label and picker | Chosen at creation, then every step follows it |
| 6.3 | the picker itself, now reading Discuss First | The one your settings file named, in the same list |
| 9.5 | the banner under the picker | Its description comes along with it |
| 12.9 | pipeline rail on the created spec | Your own phase becomes a step of the run |
| 16.9 | rest | — |

The first three beats hold one camera and move only the marker. The 800 px form column caps the fit at 1.43x and the vertical clamp pins the frame to the top of the capture, so the title, the picker, the banner space beneath it and the Feature Brief label are all in one shot and there is no honest punch-in left to make. Beat 4 is the only camera move: a 1.7x push onto the rail, clamped so the frame never sees past the capture edge.

Cuts: the pick dissolves over 0.4 s at t=6.4, while beat 2's marker is still settling, so the picker is read as Discuss First by the time that caption lands. The created spec dissolves in over 0.7 s at t=12.7 and lands just as the marker settles on the rail. The last dissolve, 0.9 s at t=16.9, returns to frame zero's shot while the camera pulls back to rest, so the loop closes.

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

- Frame zero is the Create New Spec form at rest with the workflow picker in view, which is the pose a reader sees before the clip starts.
- Loop verified: frame 0 and frame 560 are the same rest pose. Mean absolute difference 0.12 per channel out of 255, PSNR 52.9 dB, 431 of 2.1 M pixels differing by more than 8, all of them on text edges. That is H.264 quantization noise, not motion.
- Render: 561 frames, 18.7 s, 2.6 MB at 1836 x 1164, 30 fps.
- `hyperframes check`: 0 errors, 0 warnings, 0 layout issues across 9 samples.
