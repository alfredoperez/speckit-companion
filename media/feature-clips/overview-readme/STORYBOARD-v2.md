# Overview GIF v2. Storyboard

**Status: reviewed, decided, and BUILT. See "As built" and "Decisions" at the end.**

One loop, 26.6 s at 30 fps (798 frames), 1836 x 1164, evolving the v1 composition
in this folder. The v1 measured-rect machinery (capture-pixel rects projected
under a camera, swipes built per resting camera) is reused as is; what changes
is the capture, the camera path, and the label style.

## What v2 says that v1 did not

v1 showed the page assembling and visited two cards. v2 makes one claim first,
then proves it section by section: **this page holds the entire story of a run,
and stock Spec Kit has no such page.** The opening beat establishes the whole
tall page in one view before anything is highlighted; the journey then walks
its sections top to bottom: Run overview, Living specs and working area,
Expectations, Verified, Decisions, Coverage.

## Ground truth

The A6 story (`video-capture-episode-1-·-teamboard--a-6-completed-overview`)
now renders every section after the fixture extension in this commit. One
still per section is in `storyboard-frames/` (captured at 2x device pixels of
the 1224-wide story layout; the card shows the same pixels at 1.34x at rest
and up to about 2x punched in):

- `00-full-dossier.png` the whole page, top to bottom
- `01-intent-and-run-overview.png` intent statement plus the phase strip
- `02-run-overview-strip.png` the phase strip alone
- `03-expectations-fence.png` must-stay-true and out-of-scope columns
- `04-verified.png` five checks with commands and the pass count
- `05-decisions.png` three numbered decisions with WHY and REJECTED
- `06-coverage.png` requirement to task to test, 4/4 traced
- `07-approach-livingspecs-area-size.png` approach, living specs chips, working area, size

## Capture plan (build step, not done yet)

v1 captured the 1224 x 776 story viewport. v2 needs the full scroll height:
one tall capture of the dossier at 1224 CSS wide by about 2550 tall (unclamp
`#content-area` exactly as `storyboard-frames` were made), plus the same
page chrome band at the top so the frame still reads as the product. Every
highlight rect is measured off the captured DOM with getBoundingClientRect,
never eyeballed; rects land in `assets/captures/rects-v2.json`. The camera
pans vertically over the tall capture inside the same 1640 x 1040 card.

## Label style v2 (bigger, light glowing border)

Same pill anatomy as v1 (dot plus text, anchored above its rect), sized up
and edged with light:

- font: Geist 500, **44 px** (v1 was 32), letter-spacing 0.004em
- padding: **16 px 26 px**, radius 12 px
- background: rgba(12,17,19,0.94) as before
- border: **1.5 px solid rgba(127,240,196,0.65)** (v1 was 0.28 alpha)
- glow: box-shadow `0 0 0 1px rgba(127,240,196,0.18), 0 0 30px rgba(127,240,196,0.30), 0 14px 34px rgba(0,0,0,0.5)`
- dot: 11 px, #7ff0c4
- enter: fade up 10 px over 0.34 s; exit: fade over 0.24 s (unchanged)

## Beats

One thing moves at a time: a camera move finishes before a swipe starts, a
swipe finishes before its label enters, labels leave before the next camera
move. Swipes are the v1 marker device (scaleX sweep, lighten blend).

### B0 · 0.00 to 1.00 (1.0 s) · Frame zero
- On screen: top of the finished Overview at rest in the card. Intent
  statement, run overview strip, approach and context row, top of the fence.
- Moves: nothing.
- Label: none.
- Purpose: representative frame zero; the loop's resting pose.

### B1 · 1.00 to 4.40 (3.4 s) · The whole run, one page
- On screen: camera pulls straight back and the entire tall page comes into
  frame inside the card, every section visible small but recognizable.
- Moves: one camera pull-back (1.1 s), then hold.
- Label (bottom center, over the ground, not the card):
  **"The whole run. One page."**
- Purpose: the framing claim lands before any section is highlighted. This
  page is the thing stock Spec Kit does not have.

### B2 · 4.40 to 7.40 (3.0 s) · Run overview
- On screen: camera pushes in to the RUN OVERVIEW strip: Specify 6m 52s,
  Plan 8m 2s, Tasks 4m 56s, Implement 34m 45s, 54m 36s elapsed.
- Moves: camera push (0.85 s); then one swipe across the four phase chips
  left to right; then label.
- Label: **"Every phase, timed"**
- Purpose: the journey starts where the run's shape is visible at a glance.

### B3 · 7.40 to 10.00 (2.6 s) · Living specs and working area
- On screen: small pan down to the approach and context row: LIVING SPECS
  chips (`profiles` FOLDED BACK, `media-storage`) and WORKING AREA
  ("src/api avatar service and the profile page").
- Moves: camera pan (0.6 s); swipe across the chips row; label.
- Label: **"The specs it loaded, and where it worked"**
- Purpose: the run carries its own context: which living specs fed it, which
  got folded back, and the area of the codebase it touched.

### B4 · 10.00 to 13.20 (3.2 s) · Expectations
- On screen: scroll to the fence. Two columns: Must stay true (2 items),
  Deliberately out of scope (3 items).
- Moves: camera scroll (0.8 s); swipe on "Must stay true", second swipe on
  "Deliberately out of scope"; label.
- Label: **"The fence around the work"**
- Purpose: the boundaries the AI was held to, stated, not implied.

### B5 · 13.20 to 16.60 (3.4 s) · Verified
- On screen: scroll to VERIFIED. Five green checks, each with the command
  that produced it, "5 passed" badge, "42 passed, 0 failed".
- Moves: camera scroll (0.8 s); one swipe across the "5 passed" badge and one
  down-sweep along the check column (or across the first command chip);
  label.
- Label: **"Checked, with the command that proves it"**
- Purpose: claims come with evidence; every line names a real command.

### B6 · 16.60 to 20.20 (3.6 s) · Decisions
- On screen: scroll to DECISIONS. Decision 01 "Resize on the server, not in
  the browser." with its WHY and REJECTED lines in frame.
- Moves: camera scroll (0.8 s); swipe across the WHY line, second swipe
  across the REJECTED line; label.
- Label: **"Why, and what was rejected"**
- Purpose: choices future work should not have to rediscover, with the road
  not taken on record.

### B7 · 20.20 to 23.80 (3.6 s) · Coverage
- On screen: scroll to COVERAGE. Four FR rows, task chips, test counts, and
  the "4/4 traced" badge.
- Moves: camera scroll (0.8 s); swipe across the "4/4 traced" badge, second
  swipe across the FR-001 row; label.
- Label: **"Requirement to task to test"**
- Purpose: the traceability claim, closing the journey on proof.

### B8 · 23.80 to 26.60 (2.8 s) · Release and loop
- On screen: camera flies back up to the top-of-page resting pose.
- Moves: label and swipes fade (0.25 s), then one camera move (1.1 s), then
  hold about 0.9 s identical to frame zero so the loop is seamless.
- Label: none.
- Purpose: seamless loop back to B0.

Total: 26.6 s. Within the 20 to 30 s budget without rushing; every label
holds at least 1.4 s. If review wants it tighter, B3 is the beat to fold
away (drop to about 24.0 s); if it wants the "stock Spec Kit has no such
page" claim spelled out, B1's hold stretches to carry a second label line.

## Decisions (reviewed 2026-08-24, all four questions answered)

1. **Living specs placement: KEEP the shared chip beat B3** as storyboarded,
   inside the intent meta row alongside WORKING AREA.
2. **Opening label stays IMPLICIT.** "The whole run. One page." with no
   Spec Kit comparison on-image; the README text beside the GIF carries it.
3. **Header facts strip: YES**, swiped during B1's whole-page hold, reusing
   the 3.4 s rather than adding runtime. Sequenced pull-back first, swipe
   once the camera settles, then the label.
4. **B5 and B6 stay separate beats.** Total stays about 26.6 s. The fixture
   string change (question 3 of the review draft) was accepted as flagged.

## As built (v2, 2026-08-24)

- Timeline shifted slightly from the draft while keeping 26.6 s total:
  B0 0.00, B1 1.00, B2 4.40, B3 7.60, B4 10.55, B5 14.10, B6 17.70,
  B7 21.70, B8 25.10, end 26.60. 798 frames at 30 fps.
- Labels for B2, B3, and B4 sit BELOW their anchors (`.lbl--below`): above
  them they collided with the intent statement, the phase strip, and the
  fence's own identical title. B5, B6, B7 keep the above placement.
- The B3 chips swipe rect is trimmed to the last chip's right edge; the
  chips UL box runs wider than its content.
- One tall capture (1224 x 2430 CSS at device pixel ratio 2, footer hidden,
  scroll container unclamped) replaces v1's slice machinery;
  `assets/captures/rects-v2.json` holds the measured rects. Captures are
  gitignored (`media/.gitignore`), regenerate via a Storybook boot plus the
  unclamp-and-measure pass described under "Capture plan".
- MP4: `npx hyperframes@0.8.12 render` (26.6 s, 1836 x 1164).
- GIF: 960 x 609 at 14 fps, kept the full draft width AND frame rate.
  Pipeline: ffmpeg palettegen (stats_mode=diff, 128 colors) + paletteuse
  (dither=none, diff_mode=rectangle), then gifsicle -O3 --lossy=30.
  Result 3.1 MB, under the 4 MB target with no fps/width step-down; the
  flat dark UI takes dither=none cleanly and lossy=30 shows no visible
  artifacts at README width. Replaced `docs/screenshots/generated/overview.gif`.
- Loop verified: first and last GIF frames are the same rest pose
  (PSNR 43 dB, quantization noise only), `loop forever` flag set.
