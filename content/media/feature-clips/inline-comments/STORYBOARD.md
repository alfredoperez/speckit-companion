# inline-comments

The 9 second look at reviewing a spec line by line: a comment pinned under the line it annotates, opened to its full card, and the Refine action that sends it back to the AI. Promoted to `docs/screenshots/generated/inline-comments.gif`, which the README embeds under **Inline Review Comments**.

## Why it exists

The claim in the README is that comments behave like a pull request review and that Refine dispatches the pending ones to your AI for an in-place edit. Collapsed and expanded are two different shapes of the same card, and a still can only show one of them, so the open and the action it reveals have to be a clip. This one stays on a single document the whole time and lets the card do the moving.

## Source captures

Both frames are the `Viewer/InlineComment` story `Several on one document` in `webview/src/spec-viewer/components/InlineComment.stories.tsx`, the same content the README's `inline-comments.png` is captured from, taken once collapsed and once with the first comment expanded. The PNGs are 1836 x 1188, which the composition reads as 918 x 594 CSS px at DPR 2, so every rect in `BEATS` is a real measured element box in that space.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `ic-collapsed.png` | Five requirement lines with three comments, all collapsed: two PENDING ("Name the providers in scope for v1", "How many attempts before lockout?") and one APPLIED ("Say what happens when the link expires"). |
| sh1 | `ic-expanded.png` | The same document with the first comment open: the PENDING card expanded to show the comment body and its Refine, Edit and Delete actions. The two other comments stay collapsed. |

## Beats

13.7 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the first comment row, collapsed, under the line it annotates | Stays with this block when the spec changes |
| 6 | the same comment grown to its open card | It hasn't gone to your AI yet |
| 9 | the action row inside the open card, Refine, Edit and Delete | One prompt built from the notes on this document |
| 12 | rest | — |

`CUTS` has two entries. At t=3.3 the capture hard-cuts from `sh0` to `sh1`, landing exactly on the beat that names the open card, so the expand reads as the click the viewer just watched. At t=8.1 it dissolves back over 0.5 s to `sh0`, which returns the document to its collapsed pose in time for the loop.

The first two beats carry `noZoom`, so the camera never moves between them: only the marker grows from the collapsed row to the open card, and the state cut happens under it. Beat three is the one real camera move, punching in on the actions. `CLAMP` is off here, so the rest framing sits above the capture's top edge and a band of `--clip-ground` shows there. That's invisible on screen because `--clip-ground` is `#101416`, which is exactly the captured surface's own outer colour.

## Render

```
npm run render                 # in this directory
```

Then the standard GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/inline-comments.gif
```

The published file reports those settings back: 960 x 609, a 128 colour global table, `loop forever`, 1.6 MB. It stores 113 images rather than the 129 that 9.2 s at 14 fps implies, because the two beats that hold still compress hard under `-O3`: identical neighbours merged into longer frames, including one 0.43 s and one 0.64 s hold. Total playback time still adds up to 9.2 s.

- Loop verified: frame zero and the final frame are the same collapsed rest pose with no marker and no label, PSNR 49.5 dB (quantization noise only), `loop forever` flag set.
- Frame zero is the collapsed document framed by the rest camera, all three comments visible and closed, which is the pose a reader sees before the GIF starts.
