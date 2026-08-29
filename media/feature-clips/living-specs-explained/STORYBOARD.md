# living-specs-explained

The argument for living specs, made as a diagram rather than a tour. It is the one thing in this category nothing else does, and the previous attempt to show it was a whole IDE window shrunk into a column where nothing was legible.

## Why it exists

Every other clip in the set films the product. This one films the *problem*, because the product only makes sense once you have seen what it replaces: Spec Kit writes the spec, the feature ships, the folder is archived, and everything anyone worked out about how that capability behaves goes quiet with it.

A screenshot cannot argue that. A folder going grey and three capabilities lifting out of it and docking beside the code can. So there is no capture under this composition and no camera: every pixel is drawn in `index.html`, which is why it stays sharp at any encode width, re-themes by editing the `:root` block, and can never go stale against a UI change it does not depend on.

It is hand-authored, so it carries no BEATS array and `npm run clips:check` lists it as skipped. This file is the script; the timing lives in the `tl.fromTo` calls.

## What is on screen

No source captures. Two columns, drawn in CSS:

| Side | Shows |
|---|---|
| left | `specs/041-photo-upload/` with `spec.md`, `plan.md` and `tasks.md`, which greys out and takes a FEATURE SHIPPED stamp |
| right | either the colocated tree (capabilities under `src/features`, `src/jobs`, `src/services`) or the central one (three under a `capabilities/` root) |

Three capability chips travel between them. They move on transforms, never on `left`/`top`, because layout properties snap to whole device pixels and stutter under the seek-by-frame renderer.

## Beats

21.5 s at 30 fps, 1836 x 1164.

| t | What happens | Caption |
|---|---|---|
| 0.3 | the folder fills in, one file at a time | Spec Kit writes the spec, and the folder holds everything you worked out |
| 3.9 | FEATURE SHIPPED lands, the folder desaturates and drops back | The feature ships, and the folder goes quiet |
| 6.7 | three `{ }` capability chips lift out of the spent folder | Turn living specs on and each capability keeps one durable spec |
| 9.7 | each chip travels right and hands off to its row in the tree | Kept next to the code it describes |
| 11.7 | coverage counts arrive, last of all | — |
| 13.2 | the `avatar-rendering` row shivers and reads drift | Drift names the files that changed since that spec was last committed |
| 16.2 | the tree crossfades to the central `capabilities/` root | Or keep them all at one root. Both are yours to pick |
| 20.3 | everything clears and the folder comes back up, closing the loop | — |

## Notes

**Coverage counts arrive after the rows, deliberately.** A count exists only where someone has written a `.coverage.md` sibling, so it has to read as something the tree found rather than something the feature grants. The claim ledger is explicit that a missing coverage file is indistinguishable from zero coverage, and no caption here says otherwise.

**Nothing about orphans.** The sidebar does render an Orphans node, but the ledger has no verified row for it, so it stays out of a clip that is making an argument.

**Drift is the star** because it is the fully verified half: it is computed from git, it names the files that changed since the spec was last committed, and it always exits zero. The caption says what it *names*, never that it blocks anything.
