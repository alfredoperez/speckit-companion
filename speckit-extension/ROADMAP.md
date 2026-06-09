# SpecKit Companion — spec-kit Extension Roadmap

This extension is SDD rebuilt as a spec-kit extension — the spec-kit-side half of the [SpecKit Companion](../README.md) product (the VS Code GUI is the other half). It ships as **8 ordered, PR-sized steps**. **v1 = steps 1–3**: get rich activity tracking working on a user's *existing* spec-kit flow, no template change, with the Companion GUI lit up.

Design sources: `sdd` repo → `specs/024-speckit-extension-foundation/spec.md` (R001–R015) and ADR `0003-sdd-as-speckit-extension.md`.

## Steps

| # | Step | Scope | Status |
|---|------|-------|--------|
| 1 | **Foundation + `after_specify` spike** | one hook → `write-context.py` → `.spec-context.json`; minimal canonical-schema alignment | ✅ **Shipped & proven** ([PR #173](https://github.com/alfredoperez/speckit-companion/pull/173)) |
| 2 | Full lifecycle capture + fallback | `after_plan`/`after_tasks`/`after_implement` hooks; derive-from-files when a hook didn't fire | ✅ Shipped |
| 3 | `status` + `resume` commands | pipeline view (`--json`) + next-step detection — **completes v1** | ◻ Planned |
| 4 | Template profiles + per-spec control | `companion-standard` / `companion-turbo` presets + namespaced `/speckit.companion.*` + baked-in timing | ◷ In progress |
| 5 | Complexity detector + fast path | right-size small changes (spec+plan+tasks in one pass) | ◻ Planned |
| 6 | Living specs + drift | domain specs + drift detection — *the differentiator* | ◻ Planned |
| 7 | Auto-mode workflow | a spec-kit `workflow.yml` driving specify→implement, with a no-gate variant | ◻ Planned |
| 8 | Agent-team `[P]` parallelism | Claude-only fan-out of independent task groups; sequential fallback elsewhere | ◻ Planned |

Legend: ✅ shipped · ◻ planned.

## Step 1 — what's proven

The whole migration rested on one unproven, agent-mediated chain: *user runs a spec-kit command → the agent runs our hook → our script writes `.spec-context.json` → the Companion GUI re-renders.* Step 1 proved it.

- **A — script + resolution (deterministic):** ✅ `write-context.py` creates/updates a canonical `.spec-context.json` (active-dir resolution via spec-kit's order), with append-only transitions, unknown-key preservation, and a no-backward-clobber guard. Covered by the probe/regression suite.
- **B — live hook + GUI:** ✅ Verified 2026-05-25. One real `/speckit.specify` **auto-fired** the `after_specify` companion hook (`optional: false` → no nudge) → `write-context.py` → `specs/<NNN>-<slug>/.spec-context.json` at `currentStep: specify` / `status: specified` with a `by: extension` transition. The artifact carried `workflow: "speckit"`, proving it works on a **plain spec-kit flow** with no SDD present.

The reproducible proof procedure lives in the [README](./README.md#end-to-end-proof-the-de-risk).

## Step 2 — what shipped

- **Three new lifecycle hooks** — `after_plan`, `after_tasks`, and `after_implement` (all `optional: false`, auto-running), each backed by a per-step capture command (`speckit.companion.capture-plan` / `-tasks` / `-implement`) that reuses `write-context.py`.
- **Per-task journaling** on `after_implement` via the writer's new `--tasks-file` task-sync mode — appends one idempotent transition per completed `- [x] **T###**` marker, recording `implementing` until every task is checked, then `implemented`.
- **`derive-from-files.py`** — a new stdlib-only fallback that reconstructs `.spec-context.json` from on-disk artifacts + git when a hook never fired, honoring the same no-backward-clobber guard and emitting the same canonical schema.
- **Regression coverage** — a stdlib `unittest` suite (append-only transitions, no-backward-clobber, unknown-key preservation, derive round-trip).

> The build-in-public devlog for each step is the "My SDD" Build Log series.
