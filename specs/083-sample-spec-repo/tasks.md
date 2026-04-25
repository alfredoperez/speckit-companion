# Tasks: Sample Spec Pointers in README

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-25

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Add Sample Specs section to README — `README.md` | R001, R002, R003, R004, R005
  - **Do**: Insert a new `## Sample Specs` section in `README.md` between the **Getting Started** section (ends ~line 115) and the **Supported AI Providers** heading (~line 117). The section MUST contain:
    - A heading: `## Sample Specs`
    - A 1–2 sentence intro that frames the section as "what good looks like" with examples drawn from this repo
    - A bullet list with these three entries (each a clickable relative link + one-line annotation):
      - [`specs/008-spec-viewer-ux/`](./specs/008-spec-viewer-ux/) — full SpecKit flow: spec, plan, research, data model, quickstart, tasks, checklists, contracts
      - [`specs/065-multi-select-specs/`](./specs/065-multi-select-specs/) — minimal SDD flow: spec + plan + tasks for a small UX change
      - [`specs/051-explorer-viewer-fixes/`](./specs/051-explorer-viewer-fixes/) — minimal SDD flow: spec + plan + tasks for a focused bug-fix bundle
  - **Verify**: `npm run compile` passes (sanity check; README change shouldn't affect the build). Visually scan the section: heading renders, all three relative links resolve to existing directories under `specs/`, one-line annotations make the full-vs-minimal contrast obvious.
  - **Leverage**: existing README sections like **Getting Started** (line 111) and **Acknowledgments** (line 472) for tone — short, declarative, no marketing fluff.
