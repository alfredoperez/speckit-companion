# Implementation Plan: Timing fidelity v2 — finish-only journaling + reconciler activation

**Branch**: `133-timing-fidelity-v2` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/133-timing-fidelity-v2/spec.md`

## Summary

Make the spec timeline honest and make the profile setting actually switch profiles. Two changes, both crossing the VS Code extension / spec-kit extension boundary:

1. **Finish-only journaling** — per-task and per-substep timing collapses from a `start`+`complete` pair to a *single finish event* (`kind: "complete"`). Durations are derived from the delta between consecutive finishes, anchoring the first to the owning step's start. The honest per-task cadence comes from the assistant running a *script* (`write-context.py --task <id> --kind complete`) live as each task finishes — reliable like a script, precise like the clock — with the `after_implement` hook (`sync_tasks`) as a finish-only backstop that fills in any tasks not captured live. The specify begin→end bracket and all deterministic step boundaries are untouched.
2. **Reconciler activation** — the profile reconciler stops emitting catalog-form `specify preset add <id>` (a silent no-op because the presets are bundled, not published) and instead installs from the bundled path (`specify preset add --dev .specify/extensions/companion/presets/<id>`), so toggling `speckit.companion.templateProfile` actually activates the matching preset.

The timing instructions must be expressed identically on both dispatch surfaces — the spec-kit preset bodies (`timing-partial.md`) and the GUI dispatch preamble (`promptBuilder.ts`) — and the eval (`check_capture.py`) is updated to validate the finish-only model and grade honest deltas, then must pass on a fresh standard *and* lean run.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict) for the VS Code extension + Preact webview; Python 3 (stdlib only) for `write-context.py` and `check_capture.py`; Markdown for the timing partial and preset command bodies.
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); Preact (webview); `js-yaml` (reconciler config); the `specify` spec-kit CLI (`specify preset add/enable/remove`).
**Storage**: File-based — `.spec-context.json` per spec dir under workspace `specs/`; `.specify/companion.yml` (profile source of truth); `.specify/extensions/companion/presets/<id>` (bundled presets).
**Testing**: Jest (`ts-jest`, `tsconfig.test.json`) for extension-side units; `check_capture.py` as the capture regression net; manual E2E via the command-center sandbox (standard + lean run).
**Target Platform**: VS Code ≥ 1.84 on macOS/Linux/Windows; Python 3 present for capture scripts.
**Project Type**: Single repo shipping **two** independently-versioned extensions (VS Code `.vsix` + spec-kit `companion` extension). This feature touches both, so doc/version updates land on both sides.
**Performance Goals**: Timing precision — deterministic writes at millisecond precision, monotonic; per-task deltas reflect real elapsed work (no end-of-step burst on the live path).
**Constraints**: **Extension isolation** — the `.vsix` must not depend on `.claude/**` or `.specify/**` at runtime; the GUI-path timing instruction lives in `promptBuilder.ts` (shipped code), the spec-kit-path instruction lives in `timing-partial.md` (shipped in the spec-kit extension). Parallel `[P]` tasks cannot be individually timed by the delta model (last finisher absorbs the batch) — accepted and documented.
**Scale/Scope**: ~7 source files + 2 shared docs + 2 per-extension README/CHANGELOG + the eval; one schema confirmed unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Extensibility & Configuration** | ✅ Reinforces it — the reconciler fix makes the user-facing `templateProfile` setting actually configurable; no provider/workflow rewrite. |
| **II. Spec-Driven Workflow** | ✅ Preserves the Specify→Plan→Tasks→Implement pipeline and the lifecycle; only changes how timing within it is recorded. |
| **III. Visual & Interactive** | ✅ Improves the viewer's timeline fidelity (honest durations are a visual concern); no CLI-only surface added. |
| **IV. Modular Architecture** | ✅ Edits stay within existing focused modules (promptBuilder, reconciler, stepHistoryDerivation, write-context, eval); no new large webview feature, no module that grows past the 3–4 file threshold. |

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/133-timing-fidelity-v2/
├── spec.md              # Feature spec (done)
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (finish-delta model, reconciler mechanism, backstop guard)
├── data-model.md        # Phase 1 — timeline-event shape + derived-duration model
├── contracts/           # Phase 1 — write-context.py CLI contract, finish-only entry shape, reconciler command
│   └── capture-contracts.md
├── quickstart.md        # Phase 1 — how to run + verify (pipeline + eval on standard & lean)
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
# spec-kit extension side (ships in the companion spec-kit extension, NOT the .vsix)
speckit-extension/
├── presets/_shared/timing-partial.md         # per-task → finish-only via live script; substep finish-only
├── presets/companion-standard/commands/*.md  # re-embed the updated timing partial (7 bodies)
├── presets/companion-lean/commands/*.md       # re-embed the updated timing partial (7 bodies)
├── scripts/write-context.py                   # new --task/--kind finish path; sync_tasks → finish-only; same-step backstop guard
├── README.md  CHANGELOG.md  extension.yml     # spec-kit-ext doc + version bump (its own flow)

# VS Code extension side (ships in the .vsix)
src/
├── ai-providers/promptBuilder.ts              # GUI preamble: per-task finish-only via script; substep finish-only; mirror timing-partial
├── features/settings/companionPresetReconciler.ts  # add → bundled `--dev` path install (Fix #4)
├── features/specs/stepHistoryDerivation.ts    # buildSubsteps/deriveStepHistory: durations from finish deltas
├── core/types/spec-context.schema.json        # confirmed: NO change (finish-only reuses kind:"complete")
webview/
└── src/spec-viewer/timelineEvents.ts          # consumes derived substeps; verify finish-only renders (likely no change)
README.md  CHANGELOG.md  package.json          # VS Code-ext doc + version bump (its own flow)

# shared docs + eval
docs/capture-and-timing.md                     # finish-only model, backstop, reconciler activation, [P] caveat
docs/template-profiles.md                      # reconciler activation note
.claude/skills/eval-speckit-extension/check_capture.py  # validate finish-only + grade honest deltas
```

**Structure Decision**: Single repo, two-extension layout (existing). The timing model is duplicated by design across two dispatch surfaces — `timing-partial.md` (spec-kit path) and `promptBuilder.ts` (GUI path) — so the central work is keeping those two in lockstep and making the host-side derivation (`stepHistoryDerivation.ts`) and eval agree on the finish-only shape. Per the dual-extension rule, spec-kit-side changes bump `extension.yml` + `speckit-extension/CHANGELOG.md`; VS Code-side changes bump `package.json` + root `CHANGELOG.md`.

## Phase 0: Outline & Research

Output: [research.md](./research.md). Resolves the three design decisions that have more than one reasonable answer:

1. **Where the honest per-task finish is stamped** — live script call by the assistant (reliable + honest cadence) vs. end-of-step hook only (reliable but bursts). Decision: live script call is primary; hook is backstop.
2. **Reconciler activation mechanism** — bundled-path `--dev` install vs. publishing the presets to a catalog. Decision: bundled-path `--dev` install (presets aren't published; pre-publish blocker).
3. **Backstop guard relaxation** — how `sync_tasks` journals after the implement step is already closed without regressing genuinely-advanced specs. Decision: allow same-step (implement) writes through the no-backward-clobber guard; keep the cross-step terminal guard.

No `NEEDS CLARIFICATION` remain after research.

## Phase 1: Design & Contracts

Prerequisite: research.md complete.

1. **Data model** → [data-model.md](./data-model.md): the timeline-event entity under finish-only (per-task/substep = single `complete`), and the derived-duration rule (delta between consecutive finishes, first anchored to step start). Confirms the on-disk schema is unchanged.
2. **Contracts** → [contracts/capture-contracts.md](./contracts/capture-contracts.md): the `write-context.py` CLI contract (the new `--task <id> --kind complete` path + the finish-only `sync_tasks` behavior + the same-step backstop guard), the finish-only history-entry shape, and the reconciler's bundled-path activation command. This is the appropriate "contract" surface for a CLI/script tool — no external HTTP API exists.
3. **Quickstart** → [quickstart.md](./quickstart.md): install the rebuilt extensions, run a full pipeline on standard then lean, and run the eval; the expected green output and the honest-delta `task-cadence` line.
4. **Agent context update**: repoint the `<!-- SPECKIT START --> … <!-- SPECKIT END -->` block in `CLAUDE.md` at this plan.

Re-evaluate Constitution Check after design: still PASS (no new modules, no new dependencies, no architectural shift).

## Phase 2: Planning approach (for /speckit.tasks)

> Described here, not executed. `/speckit.tasks` generates `tasks.md`.

Tasks will be organized by the three independently-testable user stories from the spec, ordered so each is demonstrable on its own:

- **US1 (P1, honest timing)**: `write-context.py` finish path + finish-only `sync_tasks` → `timing-partial.md` → `promptBuilder.ts` → `stepHistoryDerivation.ts` delta derivation → re-embed preset bodies → eval update → verify on a run.
- **US2 (P1, reconciler)**: `companionPresetReconciler.ts` bundled-path activation + its unit tests → verify a settings toggle activates the preset.
- **US3 (P2, backstop)**: same-step guard relaxation in `sync_tasks` + dedup test → verify journaling survives a pre-closed implement step.
- **Cross-cutting**: docs (`capture-and-timing.md`, `template-profiles.md`), per-extension README/CHANGELOG/version on both sides, and the standard+lean eval gate.

## Complexity Tracking

No constitution violations — section intentionally empty.
