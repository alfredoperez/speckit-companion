# Implementation Plan: Live per-task progress and trustable step durations

**Branch**: `509-timing-capture` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)
**Input**: GitHub issue #509

## Summary

Two capture-side fixes, no viewer changes. First, the implement cadence moves from "materialize once per wave" to "the main agent folds each task's finish the moment it lands" — parallel workers stay append-only on the sidecar, so there is still exactly one writer of the shared files. Second, plan and tasks get extension-stamped boundaries in the correct order: their command bodies record a script-stamped start as the first action (the same pattern specify and implement already use), the after-plan/after-tasks hook commands switch from writing a late start to writing the step's completion, and the shared timing part stops telling the AI to self-close plan/tasks at step level. With boundaries in order, the existing derivation trusts all four phase spans without code changes — the fix is proven by new derivation tests plus re-blessed goldens.

**Approach choice (issue #509 asked for it recorded here):** approach **(b)** — the extension stamps both boundaries itself. Approach (a) (stamp starts at GUI dispatch, synchronously) was rejected because the pipeline's main dispatch paths — the skill chain, `/speckit.companion.auto`, and the workflow engine — never pass through the GUI: the extension is not in the loop at "dispatch" there, so a GUI-side stamp fixes only one of three paths. The command body is the one surface every dispatch path shares, and the after-step hook is the one surface that reliably runs at the step's true end; both already exist and both stamp via the writer script (real clock, atomic, idempotent). Note (b) as implemented subsumes the useful half of (a): the body-start *is* a synchronous stamp before the step's work, just placed where every dispatcher reaches it.

## Project Structure

```
speckit-extension/
├── presets/_parts/timing.md            # self-close set shrinks to clarify/analyze; per-task fold cadence
├── nodes/plan/gather-context.md        # + script-stamped plan start (step 1)
├── nodes/tasks/tasks-doc.md            # + script-stamped tasks start (step 1)
├── nodes/implement/implement-exec.md   # steps 3–4: per-task materialize by the main agent
├── commands/speckit.companion.after-plan.md   # writer call gains --kind complete
├── commands/speckit.companion.after-tasks.md  # writer call gains --kind complete
├── commands/speckit.companion.*.md     # regenerated (assemble-nodes / build-commands)
├── presets/companion-standard/commands/*.md   # regenerated (timing part refill)
├── tests/golden/commands/…             # re-blessed
├── CHANGELOG.md                        # [Unreleased] entry
└── README.md                           # cadence description, if stated

src/ai-providers/promptPreamble.ts      # per-task cadence text + slim-body closure parenthetical
src/features/specs/__tests__/stepHistoryDerivation.test.ts  # 4-of-4 trusted + legacy-inverted regression
docs/capture-and-timing.md              # cadence + boundary-ownership model
.claude/skills/speckit-*/SKILL.md       # committed stock emissions, refreshed if the timing part refill touches them
```

**Structure Decision**: all behavior changes live in prompt text (parts/nodes/hook commands) and their mirrors; no Python writer or TS extension code changes — the writer already supports every call shape used.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new settings; cadence is default behavior, not a toggle. |
| II. Spec-Driven Workflow | PASS — strengthens the lifecycle record the workflow depends on; forward-only status guard untouched. |
| III. Visual and Interactive | PASS — the panel gets livelier data; no UI changes. |
| IV. Modular Architecture | PASS — edits land in the single-sourced parts/nodes; assembled bodies regenerated, never hand-forked. |

## Key Decisions (Phase 0 rollup)

See [research.md](./research.md). Load-bearing ones:

- **Approach (b) over (a)** — boundaries stamped by the command body (start) and the after-step hook (complete); rationale above.
- **No derivation code change** — with boundaries in order, `deriveStepHistory`'s existing trust rule (single extension start; close = own extension complete or next step's extension start) yields 4-of-4. Legacy inverted data keeps failing the `completionBeforeStart` check, which is the honest outcome.
- **Clarify/analyze keep AI self-close** — no lifecycle hooks exist for them; their durations stay best-effort, as today.
- **Stock family untouched for trust** — the stock (full) preamble keeps its self-close model; a genuinely stock workspace has no hooks to close plan/tasks. Its per-task cadence wording is tightened to match the per-task fold language.
- **Hook keeps setting status** — `--kind complete` through the writer's default step path both appends the completion (idempotent) and flips status forward-only, so the hook's status duty is preserved by the same call.

## Phase 1 — Design

- [data-model.md](./data-model.md) — who writes which `history[]` boundary per step, before and after.
- [contracts/capture-boundaries.md](./contracts/capture-boundaries.md) — the exact writer invocations each surface must carry.
