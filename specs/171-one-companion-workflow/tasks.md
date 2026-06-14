# Tasks — One SpecKit Companion Workflow

Dependency-ordered checklist organized by execution layer and file. Traceability is to files and requirements (`FR-…` / `SC-…`).

## Setup

- [x] **T001** Run `grep -ri turbo speckit-extension/` and `grep -ri "companion-turbo" src/ speckit-extension/` to capture the full inventory of turbo/standard-profile sites before editing, so later tasks have a checklist (supports FR-005, SC-001, SC-002).

## Foundational (blocking — delete the source the rest references)

- [x] **T002** Delete the turbo preset source tree `speckit-extension/presets/companion-turbo/` entirely (`preset.yml`, `README.md`, `commands/*.md`); leave `presets/_shared/timing-partial.md` and `presets/companion-standard/` intact (FR-002, SC-001).

## Core work (one unit per file; dependencies first)

- [x] **T003** Edit `src/features/settings/companionPresetReconciler.ts`: set `ALL_PRESET_IDS` to `['companion-standard']` only; keep `TURBO_PRESET_ID` and the `decideEnsureStandardOps()` turbo-removal branch; add `TURBO_PRESET_ID` explicitly into the `installedMap()` iterated set (`[STANDARD_PRESET_ID, TURBO_PRESET_ID, ...LEGACY_PRESET_IDS]`) so leftover-turbo detection still fires; reframe the "retired profile" comments as "leftover from an old install" and drop the turbo mention from the `isCompanionInstalled` docstring (FR-003, FR-004, FR-007).
- [x] **T004** Update `src/features/settings/companionPresetReconciler.test.ts`: align the `NONE`/installed-map fixtures and `.specify/presets/...` setup that enumerate `companion-turbo` with the new `ALL_PRESET_IDS`; keep the leftover-turbo removal tests green (FR-003, FR-004, SC-007). Depends on T003.
- [x] **T005** [P] Edit `speckit-extension/scripts/check-shape-parity.py`: remove `PARITY_PAIRS` and check 1 (the turbo-body comparison); drop the `companion-turbo` entries from `BODIES_NEEDING_PARTIAL` while keeping `companion-standard` + the namespaced commands; update the module docstring and success line to drop companion-turbo (FR-003, SC-007).
- [x] **T006** [P] Edit `speckit-extension/extension.yml`: scrub the `speckit.companion.{specify,plan,tasks,implement}` descriptions ("Companion turbo specify" → "Companion specify", etc.) and bump `extension.version` for the spec-kit extension release (FR-005).
- [x] **T007** [P] Edit `speckit-extension/commands/speckit.companion.specify.md` body and frontmatter: scrub "turbo" wording; replace the `fastPathEnabled = read complexityFastPath … (default false)` line with `fastPathEnabled = true`; drop `fastPathEnabled` from the `verdict` condition and remove the "Opt-out … always `normal`" line; leave thresholds, scope-signal keywords, `crossedGuardrail`, guardrail-warning text, the simple/normal branch, and the lifecycle fold unchanged (FR-005, FR-008, FR-009, FR-010, FR-011).
- [x] **T008** [P] Edit the frontmatter `description:` and any "turbo" body wording in `speckit-extension/commands/speckit.companion.plan.md`, `speckit.companion.tasks.md`, and `speckit.companion.implement.md` (FR-005).

## Integration (wiring + verification of behavior)

- [x] **T009** Run `npm test` (especially `companionPresetReconciler.test.ts`) and `python3 speckit-extension/scripts/check-shape-parity.py`; confirm both pass with turbo references removed (SC-007). Depends on T003–T008.

## Polish (docs + spec validation)

- [x] **T010** [P] Update `speckit-extension/README.md` (lines ~58, 73, 88–104) and `speckit-extension/docs/install.md` (lines ~58–60): describe "standard" as stock SpecKit + timing, never a Companion profile; remove "turbo" as a profile name (FR-006).
- [x] **T011** [P] Add a new `speckit-extension/CHANGELOG.md` entry (user-facing voice; leave historical lines as history) covering the single-workflow collapse and on-by-default fast-path (FR-006).
- [x] **T012** [P] Update `docs/template-profiles.md` and `docs/capture-and-timing.md`: drop "turbo"/"standard" as Companion profile names, reflect the single workflow and on-by-default fast-path; per CLAUDE.md these living references MUST update in the same change (FR-006).
- [x] **T013** [P] Update `docs/sidebar.md` (line ~41): drop the "for turbo specs" phrasing (FR-006).
- [x] **T014** Final validation against Success Criteria: re-run the SC-001/SC-002 greps and confirm zero hits for a `companion-turbo` source/id and zero user-facing "turbo"/"standard"-as-profile occurrences (SC-001, SC-002). Depends on T002–T013.

## Dependencies

- T002 (delete source) blocks the reconciler/parity edits conceptually and must land first.
- T003 → T004 (test follows reconciler code).
- T003–T008 all block T009 (test/parity run).
- T002–T013 block T014 (final SC grep validation).
- Docs tasks (T010–T013) depend only on the decisions in T002–T008, not on each other.

## Parallel

- T005, T006, T007, T008 touch different files with no shared incomplete dependency once T002 lands — run together.
- T010, T011, T012, T013 are independent doc files — run together after the code/command edits settle.
