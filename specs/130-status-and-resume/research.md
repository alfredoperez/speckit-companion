# Phase 0 Research: Status + Resume

Resolves the technical unknowns from the plan's Technical Context. Each item lists the decision, why, and the alternatives weighed.

## R1 — Where do "recorded decisions" come from?

**Decision**: Read the top-level `decisions: string[]` field from `.spec-context.json`. It is already a recognized passthrough — the viewer surfaces it as `ViewerState.decisions` (`src/core/types/specContext.ts:239`) and the canonical `SpecContext` tolerates it via the index signature. `status` prints this array; `resume` includes it verbatim in the scope it hands to the dispatched command.

**Rationale**: No schema change is needed — decisions already flow into the activity panel. Reusing the same field keeps the command surfaces and the GUI reading one source of truth (FR-012).

**Alternatives considered**: (a) Mining decisions out of `step_summaries` / `reviewComments` — rejected: those are step-scoped and comment-scoped, not a flat decisions log; conflating them would change their meaning. (b) Adding a new `decisions[]` schema field — rejected: it already exists as a tolerated passthrough; formalizing it is out of scope for v1.

## R2 — How does `resume` dispatch the next pipeline command?

**Decision**: `resume` is a markdown command executed by the AI CLI. It runs `status-context.py` to resolve `(currentStep, status, nextStep, nextCommand, decisions[], nextTask?)`, then instructs the agent to invoke the resolved `/speckit.*` slash command with `decisions[]` in scope. It does **not** hard-depend on a `specify workflow resume` CLI subcommand.

**Rationale**: The installed spec-kit is `0.7.4.dev0` (`.specify/init-options.json`), but the backlog item pins the `specify workflow resume` engine at `>= 0.8.5`. Hard-binding to a subcommand that isn't present in the user's installed CLI would make resume fail on exactly the stock setups v1 targets. Agent-driven dispatch of the already-installed `/speckit.*` commands works on any version and reuses the same command surfaces the user already has.

**Constraint / forward-compat note**: If a future spec-kit exposes `specify workflow resume`, `status-context.py` can emit the engine invocation as an alternate dispatch path behind a version check — but that is additive and not required for v1. The resolver output is designed to carry enough (`nextCommand`, `nextTask`) for either path.

**Alternatives considered**: (a) Require `speckit_version >= 0.8.5` and call `specify workflow resume` — rejected for v1: breaks stock installs, contradicts the "zero template change, works on existing flow" success criterion (SC-001). (b) Have the extension (TypeScript) compute and dispatch the next command directly without the script — rejected: duplicates the read/derive/next-step logic that already belongs in the Python layer and that the markdown command needs anyway.

## R3 — Next-step / next-action resolution table

**Decision**: Resolution is a pure function of `(currentStep, status)` over the canonical pipeline `specify → plan → tasks → implement` (clarify and analyze are optional and skipped for the default next action). The mapping:

| State (currentStep / status) | Next action label | Dispatched command |
|------------------------------|-------------------|--------------------|
| specify / specified          | Plan the feature  | `/speckit.plan` |
| plan / planned               | Generate tasks    | `/speckit.tasks` |
| tasks / ready-to-implement   | Implement         | `/speckit.implement` |
| implement / implementing     | Continue implementation at next unchecked task | `/speckit.implement` |
| implement / implemented      | Pipeline complete | _(none — report complete)_ |
| any / completed \| archived  | Pipeline complete | _(none — report complete)_ |
| in-progress statuses (specifying/planning/tasking) | Finish current step | re-dispatch the current step's command |

**Rationale**: Mirrors the canonical `StepName` / `Status` enums (`specContext.ts:8` and `:25`) and the existing lifecycle semantics, so status and resume agree and never diverge from the viewer.

**Alternatives considered**: Inferring next step purely from file presence — rejected as the primary path: the canonical state is authoritative when present (FR-011 prefers on-disk evidence only when state and files disagree). File-derivation is the fallback (R4), not the default.

## R4 — Behavior when `.spec-context.json` is missing or malformed

**Decision**: `status-context.py` first attempts to read `.spec-context.json`. If it is absent or unparseable, it shells the existing `derive-from-files.py` logic (file-presence inference: tasks.md → implement, plan.md → plan, spec.md → specify) to reconstruct `(currentStep, status)`, then applies the same R3 resolution. The output flags `source: "state" | "derived"` so the surface can tell the user the state was reconstructed.

**Rationale**: Reuses the shipped, tested fallback (`derive-from-files.py`, added in #203) instead of re-implementing inference. Satisfies FR-002 / FR-006 and the malformed-file edge case without new inference code.

**Alternatives considered**: Re-deriving in TypeScript on the extension side — rejected: the canonical derivation already lives in Python and is unit-tested; duplicating risks drift.

## R5 — Where the sidebar surfaces "last transition"

**Decision**: Compute a one-line "last transition" label in-memory from the last entry of `ctx.history[]` (e.g. "planned · 2h ago" or "implement started · just now") in a new `lastTransition.ts` helper, and show it in the spec tree item's `description` / `tooltip`. The status badge and current step reuse the existing status-driven rendering already in `specExplorerProvider.ts`.

**Rationale**: `history[]` is the canonical append-only log; the most recent entry is the last transition by definition. Putting it in the existing tree-item description avoids adding new tree rows (keeps the sidebar's 3-level structure intact) and reuses the existing `.spec-context.json` watcher for live refresh (FR-009). Honors the "active span, not wall-clock" preference — relative time is from the last history entry's `at`, not `now − start`.

**Alternatives considered**: A new child tree node per spec for "last transition" — rejected: clutters the tree and complicates expand/collapse state. A webview panel — rejected: overkill for one line and outside this feature's scope.

## R6 — Sidebar Resume action dispatch

**Decision**: Register `speckit.specs.resume` as an inline `view/item/context` action, gated to active lifecycle context values (not completed/archived). Its handler dispatches `/speckit.companion.resume` through the existing `dispatchSlashCommandViaTempFile` provider path, so it routes correctly for every AI provider (CLI terminals and IDE Chat alike).

**Rationale**: Reuses the provider-agnostic dispatch already used for slash commands (no new provider code), and gating to active specs upholds the lifecycle principle (don't offer Resume on completed/archived specs). After dispatch, resume writes state via the normal capture hooks, and the existing watcher refreshes the sidebar (FR-008, FR-009).

**Alternatives considered**: Calling `reactivate()` directly from the button — rejected: reactivate only flips status on completed/archived specs; it does not advance the pipeline or dispatch the next command, which is what Resume must do.
