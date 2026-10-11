# Implementation Plan: Keep the recording tooling here, send the films elsewhere

**Feature**: [recording-tooling-home.spec.md](./recording-tooling-home.spec.md)

## Summary

Three pieces of recording code are brought onto one branch: commit `90b5b159` from `feat/board-run-recording`, the two uncommitted edits in the `board-run` worktree, and the uncommitted edit already in this tree. All three apply cleanly and touch different regions. The film projects were never on `main`, so nothing is deleted. `docs/visual-assets.md` gains a short stills runbook and a fuller recordings section, and a new root `THEME.md` states the site's Constellation look with the values `apps/website/src/styles/tokens.css` holds.

One fix rides along. Every recorded task tick is a string replace that does nothing when the task line is not found, and the film then records an unchanged screen and passes. A shared helper makes a missed tick throw.

## Project Structure

```text
tooling/scripts/
├── board-shots.mjs          # 90b5b159 run-steps film, then the worktree's board-spec-journey film
├── terminal-check.mjs       # this tree's film-session-start, plus the worktree's film-tick-task on RUN_FOLDER
└── lib/
    ├── recording.mjs        # 90b5b159: READ_SECONDS
    └── teamboard-run.mjs    # 90b5b159: writeTeamboardRecord, RECORD_STATES; new tickTask helper
docs/visual-assets.md        # stills runbook, recordings section and table brought up to date
THEME.md                     # new: the marketing look
DESIGN.md                    # one line pointing at THEME.md
CLAUDE.md                    # one line in "Where things are documented"
.vscodeignore                # THEME.md
```

**Structure Decision**: no new script and no new folder. The tick helper lives in `lib/teamboard-run.mjs`, which both capture scripts already import.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No setting or provider is touched. |
| II. Spec-Driven Workflow | PASS. Run through the Companion pipeline. |
| III. Visual and Interactive | PASS. The change makes product footage repeatable. |
| IV. Modular Architecture for Complex Features | PASS. Shared constants and the tick helper stay in `lib/`. |

Re-checked after design: unchanged.
