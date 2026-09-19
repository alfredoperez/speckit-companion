# review

Correcting a spec before it turns into code: you disagree with a line, you say what has to change, that goes to your AI, the note stays behind so later you still know what that bit was about, and the side bar opens on where you will go looking for that spec next time. Built for the review tab on the landing page and the review-and-refine guide.

## Why it exists

`inline-comments` shows the comment card as an object: collapsed, then expanded. It stops before the loop closes, so it never films the payoff, which is what happens to the review state when you press Refine. This composition runs the same surface through all four of its real states in order, so the clip reads as a loop rather than a tour: clean document, comment pending, card open, comments applied.

The labels carry two ideas, in that order. First: a spec is the cheapest place to be wrong, so a comment is how you catch a bad requirement while it's still a sentence and not a branch of code. Second: a comment is also a note to yourself. It is written into the spec's own `.spec-context.json` the moment you add it, it is re-anchored when you reopen the document, and it is committable, so a half-finished review resumes next session or on another machine.

The dispatch beat is deliberately narrow. Refine builds one prompt from the pending comments for the document you are looking at and hands it to your AI provider; the dispatched comments are then marked applied. The extension does not read the file back, so no label here says the spec rewrote itself or that your edits were applied. What the fourth beat claims is that the note survived, which is the part that is true.

## The closing movement

The first four beats say the note is still there "later". The last two answer what later looks like: the side bar opens, and the feature you have been commenting on is a row in a tree of every other feature, sorted by where each one stopped, with the steering material underneath it. Ending on the document instead would have left "later" as an assertion. This ends on the place that makes it true.

Two sections, not three. `contributes.views` gates Living Specs behind `speckit.companion.installed` and ships Settings & Feedback hidden, so a fresh install with only the VS Code extension puts exactly Specs and Steering in the activity bar. That is what the closing shot shows. `B4 · All three sections` in `SidebarCapture.stories.tsx` films all three because it is the establishing shot of the whole sidebar; reusing it here would have quietly promised a view the reader may not have.

## Source captures

Five real Storybook renders in the current capture palette, never an invented panel. They share one capture space (1224 x 776 CSS px at DPR 2, so 2448 x 1552 real pixels), which is what lets one camera solve every beat.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `cm-clean.png` | No review. The Specification tab with FR-001 through FR-004 and nothing attached. |
| sh1 | `cm-pending.png` | Two comment cards pinned under FR-001, both collapsed, both reading PENDING. |
| sh2 | `cm-open.png` | The second card expanded: the whole note plus its Refine, Edit and Delete actions. |
| sh3 | `cm-applied.png` | Both cards collapsed again, each with a check glyph and reading APPLIED. |
| sh4 | `cm-sidebar.png` | The same applied document with the side bar open beside it: Specs with Active (3) and Completed (2), the commented feature expanded onto its documents, and Steering beneath. |

## What is real in the closing shot

The Specs view is a native VS Code TreeView with no webview, so the tree in sh4 is the documented recreation (`webview/src/spec-viewer/__stories__/sidebarTree.tsx`), measured against the DevTools snapshots in `docs/reference/sidebar-snapshots/`. Nothing was drawn for this clip. Every row is a fixture row B1 through B4 already use, and every mark is one `specExplorerProvider.ts` really renders:

- **The lifecycle groups and their counts.** Active and Completed, each with a live count, and a group with nothing in it does not appear. Archived is absent here because the fixture has none.
- **The row descriptions.** `12m ago` on the feature the clip has been commenting on, and `T004 · 2h ago` on the one whose last recorded move was a per-task implement finish, which is the one history entry that puts a task id on a row.
- **The document marks under the expanded feature.** Specification done, Plan running, Tasks with no icon at all and a dim "not created". The missing icon is what pulls that label left of its siblings, and it is not faked with a dim one.
- **The Steering rows.** SpecKit Project Files with the constitution, scripts and templates under it, which is what that section lists when a constitution, script or template is present.

The one thing sh4 changes about the document is the product's own doing: at 884 px the viewer drops its right-hand contents column and lays the pipeline out as a tab strip instead of a left rail. That is the real component reflowing, not a second layout drawn for the clip, and it is why the dissolve into sh4 rides a camera move rather than sitting under a still frame.

## Beats

27 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | the two comment cards under FR-001 | Catch the mistake while it's still a sentence |
| 6.6 | the expanded card | In your own words, exactly what has to change |
| 10.2 | the card's Refine / Edit / Delete row | Everything you flagged here goes to your AI at once |
| 13.8 | the state chips on both cards | Later, you still know what that bit was about |
| 17.4 | the Specs tree, Active group through the last Completed row | Find it again, grouped by how far it got |
| 21 | the Steering rows | The ground rules a run inherits, without leaving the editor |
| 24.6 | the whole side bar, held, no marker | — |

No label repeats a word the camera is already showing. The card region reads PENDING and the button row reads Refine, Edit and Delete, so the labels never use any of those; each one says what the region is for instead. The two closing regions are dense with legible words, so both labels were written against that list: the tree already reads Active, Completed, Profile Photo Upload, Tasks, not created and T004, and the steering rows already read SpecKit Project Files, Constitution, Scripts, Templates, so no label uses any of them. Keep it that way when re-wording: if the word is legible in the shot, it is wasted in the label.

Every rect is a measured element box, read off the capture at its own CSS scale. On sh0 to sh3 the card block is x 232 to 879, card one spans y 197 to 220 and card two y 225 to 248 collapsed, y 225 to 319 open, and the action row sits at x 262 to 421, y 293 to 311. On sh4 the side bar column is x 0 to 340, its rows are 22 px tall on a 4 px inset, the Specs pane runs y 32 to 302 with its rows starting at y 60, and the Steering rows run y 330 to 484. Those were read out of the DOM with `getBoundingClientRect`, not off the picture.

The two closing beats resolve to the same 1.9x scale and differ only in vertical position, so the move between them is a straight pan down the column. Both clamp to x = 0 rather than centring the tree, which is deliberate: the document stays half in frame while the tree is being read, so it reads as the side bar of an editor rather than a cutaway to a widget. Their captions sit in the band at the foot of the frame, clear of the pane heading the marker is on, so nothing is lost to the thing explaining it. The final beat carries `noMark`, so it resolves a camera from its rect and then draws no outline and no scrim: the clip simply holds on the whole side bar with nothing pointed at.

State cuts land where the change is worth seeing. The clean-to-pending cut at t=1.0 fires while the camera is still at rest, so the cards simply appear on the page. The pending-to-open cut at t=4.6 fires under a held camera, so the card visibly expands before the camera follows it. The open-to-applied cut at t=12.2 is hidden inside the camera move away from the Refine row. The applied-to-side-bar cut at t=14.9 is the same trick at a bigger scale: it fires 27% into a 1.1 s move, where the camera is travelling fastest, so the reading column's reflow lands under travel rather than under a still frame.

That last one is a hard cut on purpose. It was first built as a 0.7 s dissolve and the dissolve was worse: sh3 and sh4 hold the same words at two different x positions, so a crossfade between them smears every line of the document into a doubled ghost of itself for the length of the fade. A cut has no such window. Under a fast camera move it reads as one frame changing, which is what the three earlier cuts already do.

## Render

```
npm run render                 # in this directory
```

Then the established GIF recipe from `docs/visual-assets.md`:

```
ffmpeg -i <render>.mp4 -vf "fps=14,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128" pal.png
ffmpeg -i <render>.mp4 -i pal.png -lavfi "fps=14,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" raw.gif
gifsicle -O3 --lossy=30 --loop raw.gif -o docs/screenshots/generated/review.gif
```

- Frame zero is the clean Specification tab at 1:1, which is the pose a reader sees before the clip plays and the poster the site serves.
- **This loop does not close, on purpose.** Every other composition ends where it began so the seam is invisible; this one ends on the side bar, because returning to the document would undo the point of the closing movement. The site plays it with `loop`, so the seam is a cut from the held side bar back to the clean document at 1:1. Both are calm full-frame poses at the same scale, which is the gentlest form that cut can take, and it reads as the story starting over rather than as a glitch. If a surface ever needs a seamless loop out of this clip, the fix is a different composition, not a beat appended here.
- `node scripts/clip-storyboard.mjs --check` reports this composition in sync.
