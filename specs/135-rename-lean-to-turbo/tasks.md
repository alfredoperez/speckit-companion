# Tasks: Rename the "lean" template profile to "turbo"

**Input**: [plan.md](./plan.md), [spec.md](./spec.md)
**Branch**: `135-rename-lean-to-turbo`

## Setup

- [x] **T001** Create feature branch `135-rename-lean-to-turbo` from `main`

## Foundational (types first — the compiler surfaces every dependent site)

- [x] **T002** Rename `profile` type `'standard' | 'lean'` → `'standard' | 'turbo'` and update the doc comment in `src/core/types/specContext.ts` (FR-005)
- [x] **T003** [P] Update `profile` enum `["standard", "lean"]` → `["standard", "turbo"]` in `src/core/types/spec-context.schema.json` (FR-005, SC-005)

## Core work — VS Code extension logic

- [x] **T004** Rename `LEAN_COMMAND_BY_STOCK` → `TURBO_COMMAND_BY_STOCK`, all `'lean'` comparisons → `'turbo'`, `seedProfileForNewSpec` return type, and comments in `src/features/specs/profileDispatch.ts` (FR-001, FR-005)
- [x] **T005** Update `TemplateProfile = 'standard' | 'turbo' | 'off'`, make `companion-turbo` the trimmed-preset id, move `companion-lean` into the legacy-removal set alongside `sdd-lean`, and update `ALL_PRESET_IDS` / `VALID_PROFILES` / comments in `src/features/settings/companionPresetReconciler.ts` (FR-001, FR-007)
- [x] **T006** [P] Comment-only `lean` → `turbo` updates in `src/features/specs/specCommands.ts` and `src/features/spec-editor/specEditorProvider.ts` (FR-006)
- [x] **T007** [P] Rename `speckit.companion.templateProfile` enum value `lean` → `turbo`, update the setting description, and sweep `contributes` for other "lean" wording in `package.json` (FR-001, FR-004)

## Core work — VS Code extension tests

- [x] **T008** [P] Rename values and test names in `src/features/specs/profileDispatch.test.ts` (depends on T004)
- [x] **T009** [P] Rename values and test names in `src/features/settings/companionPresetReconciler.test.ts`; keep the leftover-`companion-lean`-removal cases as legacy-path coverage (depends on T005)
- [x] **T010** [P] Rename profile values in `src/features/specs/__tests__/specContextWriter.test.ts` (depends on T002, T003)

## Core work — spec-kit extension (`speckit-extension/`)

- [x] **T011** `git mv speckit-extension/presets/companion-lean speckit-extension/presets/companion-turbo`; update `preset.yml` (id, name "Companion Turbo", descriptions, `tags: lean` → `turbo`) (FR-004)
- [x] **T012** Update wording in `speckit-extension/presets/companion-turbo/README.md` and the seven `commands/speckit.*.md` bodies under the renamed preset (depends on T011) (FR-004, FR-006)
- [x] **T013** [P] Update the four `/speckit.companion.*` command descriptions ("Companion lean X" → "Companion turbo X") and bump `extension.version` in `speckit-extension/extension.yml` (FR-004, FR-008)
- [x] **T014** [P] Frontmatter/wording-only updates in `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md` — command names untouched (FR-008)
- [x] **T015** Update parity paths `presets/companion-lean/` → `presets/companion-turbo/` in `speckit-extension/scripts/check-shape-parity.py` (depends on T011) (SC-002)
- [x] **T016** [P] Comment-only updates in `speckit-extension/scripts/write-context.py` and `speckit-extension/tests/test_context.py` (FR-006)
- [x] **T017** [P] Update `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md` (reword unreleased "lean" entries + add the rename entry), `speckit-extension/ROADMAP.md`, `speckit-extension/docs/install.md`, `speckit-extension/docs/contributing.md` (FR-006)

## Core work — root docs

- [x] **T018** [P] Update templateProfile setting section and per-spec profile wording in `README.md` (FR-004, FR-006)
- [x] **T019** [P] Reword unreleased "lean" entries and add the rename entry in `CHANGELOG.md` (FR-006)
- [x] **T020** [P] Update the template-profiles doc-map paragraph (`companion-lean` → `companion-turbo`) in `CLAUDE.md` (FR-006)
- [x] **T021** [P] Update `docs/template-profiles.md` (heaviest file, ~21 hits) and `docs/capture-and-timing.md` (FR-006)

## Core work — dev workspace + examples

- [x] **T022** [P] Change `templateProfile: lean` → `turbo` in `.specify/companion.yml` (FR-001)
- [x] **T023** [P] Update mode vocabulary `lean` → `turbo` in `.claude/pr-profile.md`, `.claude/commands/bench-prep.md`, `.claude/commands/bench-finish.md` (FR-006)
- [x] **T024** [P] Update `examples/todo-claude/`: `README.md`, `CLAUDE.md`, `bench/README.md`, `bench/prompts/medium.md`, `bench/prompts/hard.md`, `src/pages/AboutPage.tsx`, `vitest.config.ts` ("lean-vs-standard" → "turbo-vs-standard", `companion-lean` → `companion-turbo`); leave generated `bench/REPORT.md` / `bench/stats.jsonl` untouched (FR-006)
- [x] **T025** Flip `profile: "lean"` → `"turbo"` in `specs/135-rename-lean-to-turbo/.spec-context.json` (depends on T003) (SC-005)

## Integration / Verification

- [x] **T026** Run `npm test` — all Jest suites green (depends on T002–T010) (SC-003, SC-005)
- [x] **T027** Run `python3 speckit-extension/scripts/check-shape-parity.py` — trimmed-output parity confirmed (depends on T011–T015) (SC-002)
- [x] **T028** SC-001 sweep: `grep -riE '\blean\b|companion-lean'` over `src/ webview/ package.json speckit-extension/ docs/ README.md CHANGELOG.md CLAUDE.md examples/ .claude/commands .claude/pr-profile.md .specify/companion.yml` — zero profile-referring matches (depends on all prior tasks) (SC-001, FR-006)

## Polish

- [x] **T029** Run `/install-local` to refresh generated `.specify/extensions/companion/**` and `.claude/skills` copies, then `git restore specs/_0*` demo fixtures (depends on T028)

## Dependencies

- T002 → T003 can run together, but both block T004, T005, T010 (type/schema vocabulary is the foundation).
- T004 blocks T008; T005 blocks T009.
- T011 (preset `git mv`) blocks T012 and T015 — the new path must exist before its contents or the parity script reference it.
- T026 needs all VS Code-side tasks (T002–T010); T027 needs all spec-kit-side tasks (T011–T016).
- T028 is the final sweep and needs everything before it; T029 runs last.

## Parallel

- After T002+T003: T004, T005, T006, T007 touch disjoint files and can run together.
- Tests T008, T009, T010 are parallel once their respective source tasks land.
- All docs tasks T013, T014, T016–T024 are mutually parallel (disjoint files, no code dependency).
- T026 and T027 can run in parallel (different test stacks).
