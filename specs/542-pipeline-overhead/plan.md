# Implementation Plan: Reduce per-step pipeline overhead

## Approach

Two independent, decoupled changes plus a documented escalation.

### Item 1 — measure, then escalate (no dispatch/capture change)

- Add `speckit-extension/tests/measure_pipeline_overhead.py`: read the four assembled pipeline command bodies, find each `<!-- speckit-companion:part NAME -->` fence, tally footprint × (dispatches − 1) for a `specify → plan → tasks → implement` run, print the redundant-token total. Named `measure_*` so `unittest discover` skips it; reads only.
- **Feasibility verdict (why no safe dedupe):** the extension dispatches a slash-command *name* (`executeSlashCommand`), not the assembled body — the AI (CLI) resolves the command file and reads it whole, parts inlined. The extension never holds the body to strip, and the ticket's own constraint requires the parts to ship whole on a cold one-shot dispatch. A real per-dispatch strip would need either dispatch-time body assembly the extension sends (a new dispatch mechanism) or a conditional-include templating layer — both are design changes to the dispatch/capture path, the repo's worst bug class. Per the ticket gate ("measure before you optimize; do not force a risky change"), item 1 ships the baseline + this recommendation and is escalated as a focused follow-up.
- **Baseline:** 9,492 redundant tokens across the 4-step run (timing 4,056; orchestrator 2,157; speckit-hooks 2,133; self-advance 1,146).

### Item 2 — single-owner validation (node-body edit)

- Edit `speckit-extension/nodes/tasks/tasks-doc.md` Polish phase: before adding a suite-run "validate Success Criteria" task, check `.specify/companion.yml` for a hook under `commands.implement.hooks.after.implement-exec` explicitly marked `owns: validation`. Marked hook → defer the Polish validation to it (no second suite run); no marked hook (none, or unmarked review/ship hooks) → Polish owns validation as before. Ownership lives in exactly one place.
- Regenerate `commands/speckit.companion.tasks.md` via `assemble-nodes.py`, re-bless the golden via `capture-golden.py`.

## Design decisions (Phase 0)

- **Deferral, not deletion.** The Polish task still exists when a hook owns validation — it becomes a journaled "covered by the hook" marker — so the tasks list still records that Success Criteria were validated, just without a duplicate run.
- **Judgment left to the generation step.** The instruction frames the hook as "a project that owns a consolidated validation run attaches it there," so a non-validation `implement-exec` hook (PR/notify) does not wrongly suppress the Polish run; the safe default (Polish owns it) holds on any absent/malformed `companion.yml`.
- **Measurement excludes the auto orchestrator body and classify** to keep the reported number a clean lower bound of the 4-step pipeline repeat.

## Verification

`assemble-nodes.py --check`, `check-shape-parity.py`, `build-commands.py --check`, `check-command-emissions.py`, `python3 -m unittest discover -s speckit-extension/tests`, `npm run compile && npm test`.

## Files

- `speckit-extension/tests/measure_pipeline_overhead.py` (new)
- `speckit-extension/nodes/tasks/tasks-doc.md` (Polish phase)
- `speckit-extension/commands/speckit.companion.tasks.md` (regenerated)
- `speckit-extension/tests/golden/commands/commands__speckit.companion.tasks.md` (re-blessed)
- `docs/capture-and-timing.md`, `docs/template-profiles.md`, `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md` (docs)
