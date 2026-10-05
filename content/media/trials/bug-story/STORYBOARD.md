# bug-story

A bug, told as one story. One claim: a bug has one page that tells it in order, and the page says so when a fix does not hold.

## Why it exists

A trial of the second look: real screenshots, one camera, a mark on the region being named, a caption under it. No new capture was taken for it.

## Source captures

All four are pictures already in the repo, taken by `npm run shots` in a real window with Quiet Light at 2x.

| Shot | File | State on screen |
|---|---|---|
| panes | `docs/screenshots/live-bugs-ideas-panes.png` | Specs, Bugs and Ideas panes; cartTotal under Verified |
| new | `apps/website/public/changelog/new-bug.png` | New Bug form, "The export button does nothing on Safari." |
| story | `apps/website/public/changelog/bug-story.png` | cartTotal bug, VERIFIED, four ticked tabs, What was wrong |
| failed | `apps/website/public/changelog/bug-story-failed.png` | promo code bug, FAILED, the verification table |

## Beats

18 s at 30 fps, 1920 x 1080. The `STORY` array at the top of the script in `index.html` is the storyboard as data: one row per station, with the region the camera frames and the region the mark names, in the screenshot's own pixels.

| t | Region | Caption |
|---|---|---|
| 0.0 | the Bugs pane, mark on the verified bug | Bugs get their own pane, sorted by where they stand. |
| 3.3 | the New Bug form, then the Assess bug button | Describe what goes wrong. Your assistant assesses it. |
| 6.5 | the four tabs of the bug page | One page tells it in order: story, assessment, fix, test. |
| 9.0 | What was wrong | What was wrong, in plain words, with the evidence. |
| 11.4 | the FAILED badge, then the failing row | And when a fix does not hold, the story says which check failed. |
| 15.0 | end card | — |

## Notes

The camera never zooms a screenshot past 1.3x, which is where 2x captures start to look soft at 1080p.
