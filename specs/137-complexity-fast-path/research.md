# Phase 0 Research: Complexity Fast-Path

All Technical Context items were resolvable from the existing architecture (`docs/template-profiles.md`, `docs/capture-and-timing.md`, the turbo command bodies, `companionPresetReconciler.ts`). No `NEEDS CLARIFICATION` markers remained. The open design questions and their resolutions:

## Decision 1 — Where the classify step and fast-path branch live

**Decision**: In the turbo specify command body (`speckit.companion.specify.md` + its `companion-turbo` parity copy). The classify step runs after the spec content is drafted; the minimal-mode branch is a conditional in the same body.

**Rationale**: The spec's own Assumptions fix the scope: "complexity logic lives in this project's own pipeline commands only; core spec-kit command behavior is intentionally untouched." `docs/template-profiles.md` establishes that **shape is carried by command bodies, not templates** (template overrides no-op for `specify`, which copies by literal path). The fast-path reshapes the specify *flow*, so it must be command-body logic. CLAUDE.md isolation also forbids implementing extension behavior by editing `.claude/**` / `.specify/**` directly — the command body is shipped by the spec-kit extension, which is the correct surface.

**Alternatives considered**: (a) A standalone `/speckit.companion.classify` command — rejected: adds a developer-facing step, contradicting SC-005's goal of *fewer* steps, and the classification is cheap enough to fold into specify. (b) Classify in the VS Code extension before dispatch — rejected: the extension has only the raw description at dispatch time, not the drafted requirements/file projection the AI produces; the richer signals live mid-specify.

## Decision 2 — How the AI command body learns the fast-path flag and threshold

**Decision**: The VS Code extension resolves the flag (project file vs editor setting) and **mirrors the resolved boolean into `.specify/companion.yml`**; the command body reads it from there. The 5/10 threshold is a fixed constant stated in the command body (it mirrors the existing tiny-change guardrail and is not independently configurable — per spec Assumptions).

**Rationale**: This reuses the exact pattern `templateProfile` already uses — `companion.yml` is the machine-local mirror the extension writes/regenerates on activation (`companionPresetReconciler.ts`), and the AI prompt running in a terminal cannot read VS Code settings directly. Mirroring the *resolved* value means precedence is computed once in TypeScript (testable with Jest) and the command body just reads a single boolean.

**Alternatives considered**: Have the command body read VS Code settings — impossible from the CLI context. Have the command body re-resolve precedence from two sources — duplicates logic in untestable prompt text.

## Decision 3 — Config source (editor setting, mirrored)

**Decision**: The VS Code setting is the single source of truth; the extension mirrors it into `.specify/companion.yml` for the command body to read. Resolution: `settingValue ?? false`. No project-level override.

**Rationale**: `companion.yml` is a gitignored, machine-local mirror the extension regenerates on activation — so an "explicit project value" in it can't be a shared, checked-in team policy (it isn't committed, and activation overwrites it). A precedence model where companion.yml "wins" is therefore illusory. Collapsing to a plain mirror (the same pattern `templateProfile` uses) keeps resolution in one tested place and removes the runtime-clobber contradiction where toggling the setting overwrote the supposedly-authoritative project value.

**Alternatives considered**: Project-level `companion.yml` wins — rejected; the file is gitignored and regenerated from settings, so it can't carry durable team policy, and the "wins" semantics conflicted with the mirror writes.

## Decision 4 — Shape of the "single combined artifact"

**Decision**: The fast-path specify run writes the normal turbo `spec.md` (Overview + FR + SC + Assumptions) and **appends two folded sections** that carry the plan- and task-level content inline: a compact **Approach** (files to touch / dependencies — the turbo plan essence) and an **Implementation Tasks** list (`[Tn] [P?] + path`). It still writes `checklists/requirements.md`. It does **not** create separate `plan.md` / `tasks.md` files for a fast-tracked spec. The combined artifact is sufficient for the implement step to execute.

**Rationale**: Preserves Constitution II's "each step produces or consumes a markdown artifact" — the combined artifact *is* the plan+tasks artifact, just co-located. Keeping it in `spec.md` (rather than emitting empty/standalone plan/tasks files) avoids the viewer reading a fast-tracked spec as "plan stage produced a file but tasks didn't" and keeps SC-005's "two developer-facing steps" honest.

**Alternatives considered**: Emit real `plan.md` + `tasks.md` in the specify run — rejected: that re-creates the ceremony the feature removes (the developer would see three stages' worth of files) and blurs the line between fast-path and full pipeline. A separate `fast-path.md` — rejected: a new file type the viewer/lifecycle would need to learn; reusing `spec.md` sections is lower-risk.

## Decision 5 — Recording folded plan/tasks in the lifecycle (FR-010)

**Decision**: After the fast-path writes the combined artifact, the command body calls `write-context.py` to append, in order: plan `start`+`complete` and tasks `start`+`complete`, each tagged `substep="fast-path"`, then advances `currentStep` to land at implement (status `ready-to-implement`). The viewer then renders plan and tasks as satisfied, not missing/stuck.

**Rationale**: `history[]` is append-only and the viewer derives step state from it (`docs/spec-context-schema.md`, `viewer-states.md`). Writing real `start`+`complete` pairs for plan and tasks is exactly what makes `deriveViewerState` treat those steps as done. The `substep="fast-path"` tag is the durable marker that they were folded rather than run as full stages. `write-context.py` already supports `--step/--status/--kind/--substep`-style writes; this uses the existing flags (a `--substep fast-path` value, confirmed against the script's argument surface).

**Alternatives considered**: Skip the plan/tasks entries entirely and jump `currentStep` to implement — rejected: violates FR-010 (the viewer would show plan/tasks as never-started → "stuck"), and breaks the invariant that the last `history[]` entry's `step` aligns with the rendered progress.

## Decision 6 — Guardrail warning when the threshold is crossed

**Decision**: When the classifier projects > 5 files or > 10 tasks (or hits a "rewrite/overhaul/new system" scope phrase), the command body emits a one-line warning (`[companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.`) and proceeds as *normal*. Exactly-at-threshold (5 / 10) is the simple ceiling and does **not** warn.

**Rationale**: FR-006 / SC-003 require a warning rather than a silent fast-track. The warning is informational; the safe default (full pipeline) needs no user decision, keeping the flow non-interactive.

**Alternatives considered**: Prompt the user to choose — rejected: adds an interactive gate the turbo flow deliberately avoids; the spec only asks for a warning, not a prompt.
