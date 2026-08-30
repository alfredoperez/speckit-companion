# __ID__

One line on what this clip is for, in the voice of the landing page rather than the codebase. What claim does it make, and to whom.

## Why it exists

Two or three sentences on why this clip earns its place next to the others: what it shows that no other composition in the set shows, and what it deliberately leaves to a neighbour. Name the pacing choice here too, because the next person to open this file will want to know whether the timing was considered or inherited.

## Source captures

Where the pixels come from. Name the Storybook story, the capture size in CSS pixels, and the device pixel ratio, because every rect in `index.html` is measured in that space and changing the story's `parameters.capture` silently aims every camera move at the wrong element.

Re-shoot with `npm run clips:capture -- --clips __ID__`.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `placeholder.png` | Replace with the real capture and describe exactly what is on screen, including the numbers, so a reader can tell a stale render from a current one. |

## Beats

9.9 s at 30 fps, 1836 x 1164.

The `t` and `Label` columns are checked against `index.html` by `npm run clips:check`. Edit a label here and run `node scripts/clip-storyboard.mjs --apply __ID__` to write it back into the composition. Rects stay code-owned: they are measured, not authored, so they live only in `index.html`.

| t | Region | Label |
|---|---|---|
| 3 | the first region, named the way you would point at it | The first thing worth naming on this screen |
| 6 | the second region | The second thing, once the first has landed |
| 9 | rest | — |

## Notes

Anything a future editor would otherwise have to rediscover: why a beat clamps where it does, why two regions resolve to the same scale, why a cut lands where it lands.
