# Tasks: SpecKit Companion mod for Claude Code

**Plan**: [plan.md](./plan.md) · **Spec**: [claude-code-mod.spec.md](./claude-code-mod.spec.md)

> **Scale note**: about 20 files in three areas: the Copilot board's reader (refactor), the new plugin, and docs plus CI. Every story draws from `hooks/register.js`, the one file a hooks module allows for `$` calls, so the story phases run in order rather than side by side.

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Plugin skeleton: manifest, `hooks.json` naming `./register.js`, and a `.gitignore` for the types Claude Code writes · apps/claude-mod/.claude-plugin/plugin.json, apps/claude-mod/hooks/hooks.json, apps/claude-mod/.gitignore
- [x] **T002** [P] [US5] Repo-root marketplace listing the plugin, and keep the plugin out of the `.vsix` · .claude-plugin/marketplace.json, .vscodeignore

## Phase 2: Foundational

**Wave 1:**

- [x] **T003** Move the board's pure rules out of `specs-core.mjs` into a pure module: status labels, step badges, the file-only fallback, spec-file naming, settings parsing, `buildSpecRow`, `sortSpecs`, `findSpec`, `currentTask`, `phaseTimings`, re-exporting the task parser · apps/copilot-canvas/spec-rules.mjs

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T004** [P] Rewire the board to the shared rules: `specs-core.mjs` keeps only IO and re-exports the moved names; `overview.mjs` reads step times from `phaseTimings` and `PIPELINE_STEPS` from the rules, ending the import cycle · apps/copilot-canvas/specs-core.mjs, apps/copilot-canvas/overview.mjs
- [x] **T005** [P] Build step: bundle the rules into the plugin and generate the demo fixture map; root scripts `mod:build` and `test:mod`, and `test:canvas` rebuilds the mod bundle too · apps/claude-mod/build.mjs, apps/claude-mod/hooks/vendor/board-rules.mjs, apps/claude-mod/tests/fixtures/demo-specs.js, package.json

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T006** [P] Direct unit tests for `phaseTimings`, `buildSpecRow` and `sortSpecs`, and the canvas suites stay green · apps/copilot-canvas/tests/core.test.mjs
- [x] **T007** [P] Pure view logic: `bandLine`, `paneModel`, `listText`, `defaultFollow` · apps/claude-mod/hooks/board.js
- [x] **T008** [P] Hooks module core: scan spec folders through `$.fs`, read the followed spec, keep the followed id and the hand-picked id in `$.store`, refresh after tool calls and on a 3 second timer, rescan after a turn while following automatically · apps/claude-mod/hooks/register.js

## Phase 3: User Story 1 - See where the run stands (P1)

Files: apps/claude-mod/hooks/register.js (band hook), apps/claude-mod/tests/band.test.ts

### Tests

- [x] **T009** [US1] Band text for in-flight, next, finished and empty cases, and the band drawn from a real fixture record · apps/claude-mod/tests/band.test.ts

### Implementation

- [x] **T010** [US1] Draw the band above the prompt from `bandLine`, keeping what later mods draw · apps/claude-mod/hooks/register.js

**Checkpoint**: the band shows the followed spec's state and updates when a task is ticked.

## Phase 4: User Story 2 - Follow the run in a pane (P1)

Files: apps/claude-mod/hooks/register.js (pane hook), apps/claude-mod/tests/pane.test.ts

### Tests

- [x] **T011** [US2] Pane draws title, steps with times, total and tasks for a fixture; terminal and desktop both validate · apps/claude-mod/tests/pane.test.ts

### Implementation

- [x] **T012** [US2] Pane `speckit-companion`: a Run view (steps, times, tasks by phase) and a Specs view (one button per recent spec, plus Auto); open it at session start when something draws · apps/claude-mod/hooks/register.js

**Checkpoint**: the pane shows the followed spec's pipeline, times and tasks, and switches spec from its Specs view.

## Phase 5: User Story 3 - Pick the spec the pane follows (P2)

Files: apps/claude-mod/hooks/register.js (`/spec` command), apps/claude-mod/tests/spec-command.test.ts

### Tests

- [x] **T013** [US3] `/spec <number>`, `/spec <name>`, `/spec auto` and a no-match query; the pick is stored per project · apps/claude-mod/tests/spec-command.test.ts

### Implementation

- [x] **T014** [US3] Register `/spec` (with `immediate`) and handle its forms: follow, auto, no match, open the pane where something draws · apps/claude-mod/hooks/register.js

**Checkpoint**: `/spec` switches the band and pane in one command.

## Phase 6: User Story 4 - Text answer where nothing draws (P2)

Files: apps/claude-mod/hooks/register.js (fallback branch), apps/claude-mod/tests/fallback.test.ts

### Tests

- [x] **T015** [US4] With no drawing surface, `/spec` replies with the followed spec, its band line and the recent list; `/spec 0` confirms the switch · apps/claude-mod/tests/fallback.test.ts

### Implementation

- [x] **T016** [US4] Text replies from `listText` when `$.session.surfaces()` has neither terminal nor desktop · apps/claude-mod/hooks/register.js

**Checkpoint**: `claude -p "/spec"` prints a useful answer.

## Phase 7: User Story 5 - Install from this repo (P3)

Files: apps/claude-mod/README.md, apps/website/src/content/docs/docs/guides/claude-code.mdx

**Wave 1 — independent (different files):**

- [x] **T017** [P] [US5] Plugin README: install, what it shows, `/spec`, the Claude Code version it was tested on, how to develop and test · apps/claude-mod/README.md
- [x] **T018** [P] [US5] Site guide page for the mod · apps/website/src/content/docs/docs/guides/claude-code.mdx

**Checkpoint**: a reader can install the mod from the two commands on the page.

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [x] **T019** [P] CI staleness check covers the mod bundle and fixtures · .github/workflows/ci.yml
- [x] **T020** [P] Changelog, doc map, architecture, repo map and release-qa surface map name the new app · CHANGELOG.md, docs/doc-sync.md, docs/architecture.md, CLAUDE.md, .claude/skills/release-qa/surface-map.yml

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T021** Validate against Success Criteria: `claude plugin validate --strict ./apps/claude-mod`, `claude plugin test` in the plugin, `npm run test:canvas`, `npm run compile && npm test`, a `claude -p "/spec"` run in a folder with the demo specs, and the staleness diff · (no file)

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish. US5's docs only need the behaviour settled, so they can start once US4 is done.
- Setup: one wave (T001, T002).
- Foundational: T003, then T004 and T005 together, then T006, T007 and T008 together.
- US1 to US4 each run tests then implementation, in order, because each adds to `register.js`.
- US5: T017 and T018 together.
- Polish: T019 and T020 together, then T021.
