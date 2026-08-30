# workflow-documents

## The clip this directory was supposed to hold, and why it is not here yet

This composition was commissioned as the clip for the custom-command guide: a run of `speckit.customCommands` showing where a command you defined actually surfaces. It is not that clip, because the state it needs was never captured. Read this section before wiring the output into any page.

Two surfaces carry a custom command. The "Run SpecKit Custom Command" quick pick is `vscode.window.showQuickPick` (`src/features/specs/specCommands.ts:837` registerCustomCommand), which is native VS Code chrome with no webview and no DOM, so no Storybook story can mount it and the capture story says so outright. The capturable fallback is the viewer footer's collapsed "Other actions" menu, built from the same setting by `optionalCommands.ts` and rendered by `CatalogFooter.tsx`. Stories F1, F2 and F3 in `webview/src/spec-viewer/__stories__/ClipCapture.stories.tsx` exist to shoot exactly that: menu closed on Plan, menu open on Plan, menu open on Tasks, so that the phase scoping of a command reads as the difference between the last two.

Neither surface is in the three files on disk.

- `cc-closed.png` and `cc-open-plan.png` are byte-identical (both md5 `7a4cbc8cd62213c3e4fc0e554c648bae`). The F2 story's click into "Other actions" never landed, so F1 and F2 produced the same image.
- No footer renders in any of the three captures at all. The band the footer occupies in this capture space, roughly y 700 to 770, is empty ground in all three files. The menu is not merely closed: the control that opens it is not on screen.

So the custom-command surface could not be filmed, and nothing here draws a substitute for it. The three PNGs are real Storybook renders of the real spec viewer; they are just renders of a different thing than was asked for. Re-shooting F1 to F3 so the footer is inside the capture box, and so the F2 click lands, is what unblocks the real clip. Until then this composition films only what those pixels honestly show.

Two further notes for whoever cuts the real version. The directory name is itself a claim the ledger forbids: "Custom commands appear in the viewer toolbar" is on the never-say list, because they render inside a collapsed menu in the footer and only in some states. Nothing on screen here says "toolbar" and nothing in the replacement should either. And the captures are real webview renders, not a recreation of native VS Code chrome, so the sidebar precedent does not apply to this composition.

## What this composition is instead

The two distinct captures differ in which phase document the viewer has open. That difference is a real, cleared claim: the viewer builds its document list and step rail from the workflow the spec recorded, so the phases and sub-documents on screen are the ones that workflow declared. The clip films the switch from the Plan document to the Tasks document and the three things that change with it: the nav highlight, the document body, and the On this page outline.

No label mentions custom commands, because none of them is on screen. Each one explains what the region it rings is for, rather than reading back a word the region already prints.

## Source captures

Both files are real captures of the spec viewer from `ClipCapture.stories.tsx`, written by `node scripts/capture-docs-images.mjs --clips`. They share one capture space, 1224 x 776 CSS px at DPR 2 (2448 x 1552 pixels), which is what lets one camera solve every beat. Neither is a recreation.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `cc-closed.png` | Plan document open. Plan highlighted in the nav with Research and Data Model under it. On this page lists Shape of the change, Constraints, Risks. |
| sh1 | `cc-open-tasks.png` | Tasks document open. Tasks highlighted in the nav. Body is Phase 1 Service with T001 to T004 and Phase 2 Page and proof with T005 and T006. On this page lists Service, Page and proof. |

`cc-open-plan.png` is unused: it is byte-for-byte the same file as `cc-closed.png`, and loading it as a third shot would imply a state change that does not exist.

## Beats

19.0 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | nav, Plan row and its sub-documents | The files a step wrote stay with it |
| 7.2 | nav column, Specification through Tasks | Switch documents without opening a single file |
| 11.4 | task list, both phase blocks | The bracket noise is lifted out of the line |
| 15.4 | On this page outline | The index follows whichever document you open |
| 18.8 | rest | — |

The hard cut lands at 5.0, two tenths before beat 2's camera move, so the highlight jump reads while the camera is still settled on the nav. The loop closes with a 1.2 s dissolve at 17.0 back to sh0, finishing at 18.2 and holding the rest pose for the last 0.8 s.

Beat 4's label is flipped to the marker's right edge so it stays inside the frame at that punch-in.

## Render

```
npm run render                 # in this directory
```

Then the established GIF recipe from `docs/visual-assets.md`, at the standard settings for a clip of this length:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o <target>.gif
```

No GIF target is named on purpose. This clip is not the custom-command clip, so it is not promoted into `docs/screenshots/generated/` and nothing published points at it.

- Loop verified: frame zero and the final frame (569) are the same rest pose, the full Plan-document surface at scale 1 with no marker and no label. PSNR 48.7 dB, and the residual is codec quantization spread evenly over text edges across the whole frame, not a localized leftover. Frames 555 and 569 differ by a max of 11 on one channel, so the tail is genuinely held.
- Frame zero is that rest pose, which is what a reader sees before the clip plays.
- `npm run check`: 0 errors, 0 warnings across lint, runtime, layout (9 samples), and motion.
- `node scripts/clip-storyboard.mjs --check`: in sync, 5 beats, 2 cuts, 4 labels.
