# claude-code-run

Follow a Spec Kit run inside Claude Code. One claim: you keep typing the commands you already use, and the mod shows where the run stands.

## Why it exists

A trial of the video terminal player. Nothing here is a screen recording: the screens are real Claude Code captures, one per state of a run, and the typing and the swaps between them are animated on top. A fourteen-minute run plays in twenty seconds.

## Source captures

`node tooling/video/terminal-player/capture-run.mjs` writes one cell grid per state to `.terminal-check/video-clear-completed/`, at 120 columns by 38 rows. `npm run build` in this folder copies the frames the script names into `assets/terminal/frames/` and bundles them with the player. The spec on screen is the fixture under `tooling/video/terminal-player/fixtures/clear-completed/`.

| Frame | State on screen |
|---|---|
| `idle` | Claude Code at an empty prompt, no band, no pane |
| `specifying`, `specified` | band appears, pane opens, Specify running then done in 2m |
| `planning`, `planned` | Plan running, then done in 3m |
| `tasking`, `tasked` | Tasks running, then five tasks at 0/5 |
| `focus-plan`, `open-plan` | focus on the Plan step, then plan.md open inside the pane |
| `implementing`, `tick-1` to `tick-5`, `done` | Implement running, the bar filling one task at a time, then Completed |

## Beats

23.8 s at 30 fps, 1920 x 1080. The times come from `terminal-script.json`; the composition reads them from the player, so editing the script moves the camera and the captions with it.

| t | What happens | Caption |
|---|---|---|
| 0.0 | Headline and the four steps are on screen. The prompt types `/speckit-specify …`, camera close on the prompt | Type the command you already use. |
| 2.7 | Camera pulls back. The band appears and the pane opens | A band and a pane appear. Each step ticks green. |
| 4.7 | `/speckit-plan`, then `/speckit-tasks`, each with a spinner and a tick | same |
| 9.6 | Camera moves to the pane. Enter opens plan.md, then `o` | Open a step to read its document. Press o for your editor. |
| 14.2 | `/speckit-implement`. Tasks tick one by one and the bar fills | The task bar fills as tasks are ticked. |
| 20.5 | End card: the install command types itself | — |

## Notes

The transcript lines on the left ("Wrote specs/…", the spinner) are scripted, not captured. The band, the pane and the prompt chrome are captured. The capture script hides three things that belong to the capture machine: the temp folder path, tmux's hint line and Claude Code's passing effort notice.
