# Plan — One SpecKit Companion Workflow

## Summary

Collapse SpecKit Companion's two advertised shapes ("standard" / "turbo") into the single lean workflow it actually is, and turn the small-change fast-path on by default. The work is mostly subtraction: delete the `companion-turbo` preset source tree, drop it from the reconciler's active list and the parity guard (keeping only the leftover-removal migration), scrub user-facing "turbo"/"standard" profile wording from the live `/speckit.companion.*` command bodies, descriptions, and the spec-kit extension docs, and flip the specify command's `fastPathEnabled` gate from opt-in to always-on so a small spec folds straight to implement without a flag. Stock SpecKit and the timing carrier are untouched.

## Technical Context

- **Language/version**: TypeScript 5.3+ (reconciler + tests); Python 3 stdlib (parity check); Markdown (command bodies, docs); YAML (`extension.yml`).
- **Primary surfaces**: `speckit-extension/` (spec-kit extension — its own README/CHANGELOG/`extension.yml` version), plus `src/features/settings/companionPresetReconciler.ts` and its test on the VS Code side.
- **Storage/runtime**: no schema change. `.spec-context.json` lifecycle records are unchanged; the fast-path fold already exists and keeps working.
- **Testing**: `npm test` (reconciler test `companionPresetReconciler.test.ts`); `python3 speckit-extension/scripts/check-shape-parity.py`.
- **Hard constraints**:
  - FR-004/FR-007 — the `TURBO_PRESET_ID` removal path and the `companion-standard` preset id MUST survive. We delete the turbo *source* and drop it from the *active* list, but the reconciler must still detect-and-remove a leftover installed turbo on upgrade, and the standard id is never renamed.
  - Assumption — the fast-path heuristic, thresholds (5 files / 10 tasks), scope-signal keywords, and guardrail warning text are unchanged. Only the gating flag is removed.
  - Assumption — `workflow.yml`'s route node and `classify.md` are out of scope here (formalized by #308). Only the command-driven specify path flips to on-by-default.
  - Docs land under `speckit-extension/` (its README/CHANGELOG + the relevant `docs/*.md`), never the root VS Code extension README/CHANGELOG/`package.json`.

## Approach & Structure

Ordered by dependency — delete the source first, then the references to it, then the docs, then the fast-path flip.

1. **Delete the turbo preset source** (FR-002) — remove `speckit-extension/presets/companion-turbo/` entirely (its `preset.yml`, `README.md`, and `commands/*.md`). `presets/_shared/timing-partial.md` and `presets/companion-standard/` stay.

2. **Reconciler — drop turbo from the active list, keep the removal migration** (FR-003, FR-004, FR-007) in `src/features/settings/companionPresetReconciler.ts`:
   - `ALL_PRESET_IDS` (line 15) → `['companion-standard']` only. This is the "list/install/reconcile" set FR-003 targets.
   - Keep `TURBO_PRESET_ID` (line 11) and the `decideEnsureStandardOps()` turbo-removal branch (lines 35–36) — that is the FR-004 migration.
   - `installedMap()` (lines 101–107) currently iterates `[...ALL_PRESET_IDS, ...LEGACY_PRESET_IDS]`; with turbo out of `ALL_PRESET_IDS` it would stop *detecting* a leftover turbo. Add `TURBO_PRESET_ID` back into the iterated set explicitly (e.g. `[STANDARD_PRESET_ID, TURBO_PRESET_ID, ...LEGACY_PRESET_IDS]`) so the removal still fires. This is the one non-obvious coupling.
   - Refresh the comments that frame turbo as a "retired profile" so they read as "leftover from an old install," and drop the turbo mention from the `isCompanionInstalled` docstring (lines 89–95).
   - Update `companionPresetReconciler.test.ts`: the `NONE`/installed-map fixtures and `.specify/presets/...` setup that enumerate `companion-turbo` (lines 12, 142–143) must match the new `ALL_PRESET_IDS`; keep the leftover-turbo removal tests (lines 38–46) green.

3. **Parity guard — drop the turbo comparison, keep the timing-partial check** (FR-003, SC-007) in `speckit-extension/scripts/check-shape-parity.py`:
   - Remove `PARITY_PAIRS` (lines 22–25) and check 1 (lines 52–59) — it compared the namespaced bodies against the now-deleted turbo preset bodies; with the live `/speckit.companion.*` bodies as the sole shape there is no twin to compare.
   - In `BODIES_NEEDING_PARTIAL` (lines 27–31) drop the `companion-turbo` entries; keep `companion-standard` + the namespaced commands.
   - Update the module docstring (lines 2–11) and the success line (lines 78–80) so neither references companion-turbo.

4. **Scrub "turbo"/"standard" from live command surfaces** (FR-005) — run a repo-wide `grep -ri turbo speckit-extension/` to catch every site, then fix:
   - `extension.yml` descriptions for `speckit.companion.{specify,plan,tasks,implement}` (lines 48, 51, 54, 57): "Companion turbo specify" → "Companion specify", etc. (the agreed replacement names).
   - Frontmatter `description:` line 2 of each `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md`, and any "turbo" in those bodies.
   - `extension.yml` `extension.version` bump (spec-kit extension release flow).

5. **Fast-path on by default** (FR-008, FR-009, FR-010, FR-011) in `speckit-extension/commands/speckit.companion.specify.md`:
   - Replace the `fastPathEnabled = read complexityFastPath … (default false)` line (line 71) with `fastPathEnabled = true` (Companion fast-path is core behavior — no flag).
   - Drop `fastPathEnabled` from the `verdict` condition (lines 81–85) and remove the "Opt-out … always `normal`" line (line 95) since there is no opt-out.
   - Leave the thresholds, scope-signal keywords, `crossedGuardrail`, guardrail-warning text (lines 79–94), the simple/normal branch, and the lifecycle fold (lines 97–123) exactly as-is — FR-010/FR-011 are satisfied by the existing, unchanged logic.

6. **Docs** (FR-006) — describe "standard" as *stock SpecKit + timing*, never a Companion profile; remove "turbo" as a profile name:
   - `speckit-extension/README.md` (lines ~58, 73, 88–104), `speckit-extension/CHANGELOG.md` (new entry; the historical lines 41–56 stay as history), `speckit-extension/docs/install.md` (lines ~58–60).
   - `docs/template-profiles.md` and `docs/capture-and-timing.md` — the two living references that explicitly cover the profiles, the templateProfile setting, the fast-path, and the timing carrier (per CLAUDE.md these MUST be updated in the same change).
   - `docs/sidebar.md` line ~41 — drop "for turbo specs" phrasing.

7. **Verify** (SC-001…SC-007) — `npm test`, `python3 speckit-extension/scripts/check-shape-parity.py`, and the two repo-wide greps from SC-001/SC-002 returning zero hits for a `companion-turbo` source/id and zero user-facing "turbo"/"standard"-as-profile occurrences.

## Out of Scope

- The `workflow.yml` route/switch node and `classify.md` — the engine-driven fast-path is formalized separately in #308. This change only flips the command-driven specify path.
- Renaming the `companion-standard` preset id (FR-007 — explicitly preserved to avoid migration risk).
- Removing the `complexityFastPath` / `templateProfile` setting keys themselves — already retired in `settingsMigration.ts`; no further removal here.
- Any change to stock SpecKit's commands or shape, or to the timing carrier (`_shared/timing-partial.md`, `promptBuilder.ts`) — both stay intact (FR-012, FR-013, SC-006).
- Root VS Code extension README/CHANGELOG/`package.json` — untouched; this change is under `speckit-extension/`.

## Constitution Check

- **I. Extensibility / II. Spec-Driven Workflow** — PASS. Removing a dead profile and turning right-sizing on by default keeps the Specify → Plan → Tasks → Implement pipeline intact (the fast-path folds *within* it, recording plan/tasks as satisfied) and removes a confusing configuration surface rather than adding one.
- **III / IV (Visual / Modular)** — PASS. No UI or architecture change; webview, viewer, and lifecycle records are untouched.
- No gate violations — Complexity-Tracking table omitted.

## Decisions

- **Keep `TURBO_PRESET_ID` while emptying `ALL_PRESET_IDS`.** FR-003 ("no longer list/install/reconcile") and FR-004 ("retain the leftover-removal migration") pull in opposite directions on one symbol. Resolution: `ALL_PRESET_IDS` is the *active* set (standard only); turbo stays as a removal-only id detected via `installedMap`. This is the single subtle code coupling — easy to break by deleting the const outright.
- **Drop the parity comparison rather than repoint it.** With the turbo preset deleted, the namespaced `/speckit.companion.*` bodies are the canonical shape with no twin to diff against; the timing-partial check is what still earns its keep.
