# Plan — provider-aware parallelization across the Companion pipeline

## Approach

Parallelization is a **prose / node-only** layer over the existing Companion command bodies — no engine, no VS Code extension change. The AI is the runtime; we instruct it to fan work out when its provider supports subagents and to run sequentially with identical output when it does not. One new shared part carries the capability primer; three nodes gain a few provider-aware lines; the primer is prepended early to the four pipeline commands via the existing part-fence mechanism. Then golden is re-blessed because the four assembled bodies change.

## Files / dependencies

All under `speckit-extension/`:

- `presets/_parts/parallel.md` — new shared part: the capability primer / gate (investigate / mark / execute, plus graceful sequential fallback). Authored in the house tone of `timing.md`. Must exist before any `parallel` fence (an unknown part name is a hard error).
- `nodes/specify/_frame.md`, `nodes/plan/_frame.md`, `nodes/tasks/_frame.md`, `nodes/implement/_frame.md` — prepend a `<!-- speckit-companion:part parallel -->` fence right after the `## Outline` lead-in so the primer applies before the work.
- `nodes/plan/gather-context.md` — add the parallel fan-out step (R3).
- `nodes/tasks/tasks-doc.md` — make `[P]` marking provider-aware (R4).
- `nodes/implement/implement-exec.md` — upgrade step 2 to fan out `[P]` batches concurrently + name the agent-routing seam (R5, R6).
- `tests/golden/commands/*` — re-blessed via `capture-golden.py` after the bodies assemble (R9).
- `README.md` + `CHANGELOG.md` + `extension.yml` `version` — document the capability (user-facing voice) and bump the minor (0.9.0 → 0.10.0).

## Risk / ordering notes

- **Build order is load-bearing.** Create `parallel.md` BEFORE adding any `parallel` fence (an unknown part is a hard error). Then edit nodes/parts → `assemble-nodes.py` (write bodies) → `capture-golden.py` (bless) → `assemble-nodes.py --check` + `check-shape-parity.py` both green.
- **Golden canonicalization.** The `parallel` part, like `timing`, has its fence marker stripped in golden canonicalization, but its CONTENT survives and is real. Follow the timing-part pattern exactly; don't fight the tooling.
- **Timing stays foreground.** Do NOT background `.spec-context.json` writes — two background read-modify-writes can lose an update. `background: true` is only for heavy side-effects (tests, builds, notifications). Per-task journaling stays foreground.
- **Graceful degradation is the contract.** Every line must read identically-correct on a non-capable provider: sequential, no error, identical artifacts.

## Summary

The problem: the Companion pipeline reads files and runs tasks one at a time, even on a provider (like Claude Code) that could fan that work out across subagents and finish faster — and implement is the longest step in both modes, so parallelizing it is a general win. The solution: a short capability primer prepended to the four pipeline commands that says "if you can run work concurrently, fan out investigation, mark independent tasks parallel, and run those batches concurrently; if you can't, do it sequentially with identical output," plus a few provider-aware lines in the gather-context, tasks, and implement nodes, and an agent-routing seam so a project can point specific task types at specialist subagents. Capable providers just run faster; everything else runs exactly as before.
