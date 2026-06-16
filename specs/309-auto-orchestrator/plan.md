# Plan — `/speckit.companion.auto`

## Approach

Auto is an **orchestrator command body** plus a small GUI wiring. It drives the existing per-step nodes; it owns no spec/plan/task authoring of its own. Two halves:

1. **spec-kit extension side** — a new `nodes/auto/` command assembled by `assemble-nodes.py`, registered in `extension.yml`, plus a new shared `unattended` part documenting the don't-pause convention. Add `auto` to `NAMESPACED_CMDS` and re-bless golden.
2. **VS Code extension side** — a **Run** button in Create Spec that dispatches the auto command through the existing `handleSubmit` path.

## Files / dependencies

### spec-kit extension (`speckit-extension/`)
- `nodes/auto/_frame.md` — command frontmatter (`description`) + User Input block + Outline lead-in.
- `nodes/auto/_order.yml` — node order: `resolve-dir` (reuse the specify pattern: this is also a fresh-spec entry point) → `orchestrate` → `handoff`.
- `nodes/auto/resolve-dir.md` — resolve/mint the feature dir and record the specify START (so auto can be invoked as a fresh-spec entry point, same as specify).
- `nodes/auto/orchestrate.md` — the main loop: walk specify → plan → tasks → implement → mark-complete dispatching each `/speckit.companion.*`; set `unattended: true`; no pauses; degrade on one-shot.
- `nodes/auto/handoff.md` — the shared `timing` part (so any history it appends stays honest) + the new `unattended` part.
- `presets/_parts/unattended.md` — new shared part: the don't-pause convention for hook authors.
- `scripts/_command_parts.py` — append `"auto"` to `NAMESPACED_CMDS`.
- `extension.yml` — register `speckit.companion.auto` under `provides.commands`; bump `version`.
- `README.md` + `CHANGELOG.md` — document the auto command + unattended convention (user-facing voice).
- `tests/golden/commands/commands__speckit.companion.auto.md` — blessed by `capture-golden.py` after the body assembles.

### VS Code extension (root)
- `src/features/spec-editor/specEditorProvider.ts` — handle a `submitAuto` message; resolve `speckit.companion.auto` via `resolveDispatchForRoot`; dispatch through `handleSubmit` with the auto command. Add the **Run** button to the footer HTML.
- `webview/src/spec-editor/index.ts` — wire the Run button → post `submitAuto`.
- `webview/src/spec-editor/types.ts` — add the `submitAuto` message variant.
- `package.json` — register `speckit.companion.auto.run` command (palette entry).
- root `README.md` — document the Run entry in Create Spec.

## Risk / ordering notes

- Golden parity: build the auto body first, run `assemble-nodes.py` to write it, confirm `--check` only flags the new (missing-golden) auto entry, then `capture-golden.py` to bless. The four existing commands must stay byte-for-byte.
- Extension isolation: the GUI must NOT read `.claude/**` or `.specify/**` at runtime — it dispatches the auto command text; the spec-kit body (shipped via the spec-kit extension) carries the unattended convention. The GUI only embeds the command + the workflow-seed preamble it already uses.
- Missing-extension fallback: `auto` is a companion-only command with no stock twin, so `resolveDispatchForRoot` suppresses it (returns `null`) when the spec-kit extension is absent — the Run button warns and does not dispatch an unresolvable command.

## Summary

The problem: the Companion pipeline only advances one step at a time, pausing at gates — there's no "build the whole thing and walk away" path the way `sdd:auto` gives the SDD workflow. The solution: a new auto command whose body is a no-pause orchestrator over the existing per-step nodes, a small shared convention (`unattended: true`) that tells project checkpoint hooks to record-and-continue instead of asking, and a **Run** button in Create Spec that kicks the same flow off from the GUI. Nothing about the existing per-step commands changes — auto rides on top of them, so it can't drift.
