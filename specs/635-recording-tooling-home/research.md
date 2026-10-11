# Research: Keep the recording tooling here, send the films elsewhere

## How the side branch's work comes over

**Decision**: apply only the patch of `90b5b159`, then the two worktree diffs on top.

**Rationale**: the three script files on `main` are byte-identical to that commit's parent, so the patch applies without conflict. The docs hunks land at a two-line offset. The worktree diff of `board-shots.mjs` is based on exactly what the commit produces. The worktree diff of `terminal-check.mjs` and this tree's edit touch different regions.

**Alternatives considered**: merging the branch. Rejected, because the branch also holds three film commits and is behind `main`, so a merge would bring the films in and a diff against `main` would undo newer work.

## Which of the two worktree edits to keep

**Decision**: keep both.

**Rationale**: both are recording code, not film code. The board journey is the footage the Copilot film is built on. The terminal edit moves the task-ticking film onto the same spec the board walkthrough uses, so the two can be cut together. Every symbol they need exists on `main` or arrives with `90b5b159`.

**Alternatives considered**: dropping the terminal edit to keep the older two-task film on the demo spec. Rejected: it would leave the two surfaces filming different specs.

## A tick that finds nothing

**Decision**: one `tickTask(file, id)` helper in `lib/teamboard-run.mjs` that throws when the task line is missing, used by every recorded tick.

**Rationale**: a recorded step must fail when the thing it films is absent. Today a renamed task id would produce a film of nothing and a passing run.

**Alternatives considered**: asserting the count on screen after each tick. Stronger, but each surface reads its count differently and the terminal film runs against a live session. The file-level check catches the real failure with four lines.

## Where the look lives

**Decision**: a new root `THEME.md` that states the Constellation values, and one line in `DESIGN.md` pointing to it.

**Rationale**: the issue asks for one file the image and video skills can point at. `DESIGN.md` holds rules and history for three surfaces; a skill needs the values alone. `THEME.md` names `apps/website/src/styles/tokens.css` as the source and repeats no rule `DESIGN.md` already states.

**Alternatives considered**: a section inside `DESIGN.md`. Rejected because that file already carries an older night-forest palette for banners and says nothing decides which wins. `THEME.md` does not settle that either: it covers work that should match the site, and says so.

## What is not run here

**Decision**: run `npm run record:board` and `node --check` on each touched script. Do not run `npm run record` or `npm run record:terminal`.

**Rationale**: those two need a real editor window and a real assistant session. Both are run once in release QA.
