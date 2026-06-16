# Spec — provider-aware parallelization across the Companion pipeline

## Intent

Weave parallel work through the Companion pipeline wherever it helps — investigate, mark, execute — gated on what the AI provider can do. The AI is the runtime, so "parallelize" means instructing the AI to fan work out when it can spawn subagents, and to run sequentially with identical output when it cannot. The groundwork already exists (`tasks-doc` emits `[P]`; `implement-exec` already says `[P]` "may run together"); this adds a light, provider-gated layer: one new shared part plus a few lines in three nodes. No engine changes.

## Requirements

- **R1 — Capability primer part.** A new shared part `_parts/parallel.md` ships the capability primer: if the provider can spawn subagents, fan out investigation reads, mark independent tasks `[P]`, and run `[P]` batches concurrently; if it cannot, do all of it sequentially with no error and identical output. It uses the same part-fence mechanism the timing part uses.

- **R2 — Primer prepended early.** The primer is prepended to the four pipeline commands (specify, plan, tasks, implement) via a `parallel` part fence, placed early (after each command's `## Outline` lead-in in `_frame.md`) so it applies before the work. It is a primer, not a new node.

- **R3 — Investigate (gather-context).** `plan/gather-context.md` gains a step: if the provider supports subagents, fan the context reads out in parallel (one per area) and collect findings; otherwise read sequentially.

- **R4 — Mark provider-aware (tasks-doc).** The existing `[P]` marking in `tasks/tasks-doc.md` becomes provider-aware: when the dispatcher supports subagents, deliberately split independent different-file work so implement can run it concurrently; when it doesn't, `[P]` is informational only.

- **R5 — Execute (implement-exec).** `implement/implement-exec.md` step 2 is upgraded from "may run together" to actually fan out: run each `[P]` batch concurrently (one subagent per task), journal each as it finishes (timing rules unchanged); same-file / dependent tasks stay ordered; no subagent support means sequential.

- **R6 — Agent-routing seam.** Implement names the seam: a project may route task types to specialist subagents via a hook (test tasks → test-expert, etc.) without forking the node.

- **R7 — Graceful degradation.** Every touch point degrades gracefully — a non-capable provider runs sequentially with identical output and no error.

- **R8 — Timing stays foreground.** No `.spec-context.json` write is backgrounded. Per-task journaling stays foreground inline `write-context.py` calls; `background: true` is reserved for heavy side-effects. Parallel `[P]` batches attribute time to whichever finishes last (accepted).

- **R9 — Golden parity.** Changing the four command bodies changes assembled output, so golden is re-blessed via `capture-golden.py`; `assemble-nodes.py --check` and `check-shape-parity.py` both stay green.

## Out of scope

- The auto orchestrator (the #309 half — already shipped).
- Custom document formats (swapping what a node emits).
- A committed cross-project recipe doc.
- True engine-managed gating (the spec-kit `workflow.yml` review-gate path stays as-is).

## Acceptance

- `_parts/parallel.md` ships and is prepended to specify, plan, tasks, implement.
- `gather-context` fans out reads when the provider supports subagents; sequential otherwise.
- `tasks-doc` marks `[P]` provider-aware (deliberate split when subagents available; informational otherwise).
- Implement runs `[P]` batches concurrently where supported; sequential / dependent stay ordered.
- The agent-routing seam exists (a project can route task types to specialist subagents via a hook).
- Graceful degradation on providers without subagents (sequential, no error, identical output).
- Capture / timing fidelity unchanged (per-task finish journaling still honest; timing stays foreground).
- `npm run compile && npm test`, `assemble-nodes.py --check`, and `check-shape-parity.py` all pass.
