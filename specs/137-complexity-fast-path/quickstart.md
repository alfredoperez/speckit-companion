# Quickstart: Verifying the Complexity Fast-Path

Prereqs: a `turbo`-profile project (`.specify/companion.yml` → `templateProfile: 'turbo'`), both extensions installed locally (`/install-local`).

## 1. Small change fast-tracks (US1 / SC-001)

1. Start a spec with a one-line description: `rename foo to bar`.
2. Run `/speckit.companion.specify`.
3. **Expect**: one combined `spec.md` (Overview + FR + SC + Assumptions + Approach + Implementation Tasks), **no** separate `plan.md` / `tasks.md`, and the viewer showing the spec at the **implement** step.
4. Inspect `.spec-context.json`: `history[]` has `plan` and `tasks` `start`+`complete` pairs tagged `substep: "fast-path"`; `status: ready-to-implement`.

## 2. Large change keeps the full pipeline (US2 / SC-002)

1. Start a spec: `add OAuth login with token refresh and session storage`.
2. Run `/speckit.companion.specify`.
3. **Expect**: `spec.md` only, classified `normal`; the pipeline proceeds through distinct `/speckit.companion.plan` and `/speckit.companion.tasks` runs before implement.

## 3. Guardrail warning (US2 / SC-003)

1. Start a spec whose description names many files (> 5) or implies > 10 tasks.
2. **Expect**: `[companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.` and a normal run — never a silent fast-track.

## 4. Opt out (US3 / SC-004)

1. Set `speckit.companion.complexityFastPath: false` (VS Code settings) **or** `complexityFastPath: false` in `.specify/companion.yml`.
2. Start a one-line-change spec and run `/speckit.companion.specify`.
3. **Expect**: full pipeline, no combining, no warning. (When the two sources disagree, the `companion.yml` value wins.)

## 5. Eval

Run `/eval-speckit-extension` against a fast-tracked spec: it should confirm the folded `plan`/`tasks` history entries, real timestamps, and `ready-to-implement` capture.
