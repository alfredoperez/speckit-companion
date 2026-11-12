# Plan: Hands-off runs also work on spec-kit's workflow engine

## Summary

The Companion workflow file routes on `steps.classify.output.size`, which no command step produces, so every engine run takes the default route. We replace the `classify` command step with a read-only `shell` step that prints the size specify already recorded, and switch on its `stdout`. The printing lives in `status-context.py` behind a new `--size` flag, the existing read side of the run record, so no new runtime script ships. Each gate gets its own `verdict_input` so `specify workflow resume <run id> --input review_spec=approve` passes it headless. The doctor gains a project-level `workflow` check that reports a missing or stale registration with the exact `specify workflow add` command, and a `--fix` flag that runs it. The site's custom workflow page documents the engine path.

## Project Structure

```
apps/speckit-extension/
  workflows/speckit-companion.workflow.yml   size step, switch on stdout, verdict inputs, no scope
  scripts/status-context.py                  --size prints the recorded size or nothing
  scripts/doctor_checks.py                   check_workflow(root)
  scripts/doctor.py                          wire the check, add --fix
  commands/speckit.companion.doctor.md       name the check and --fix (built from the source body)
  tests/test_workflow_integrity.py           switch source + case keys vs _order.yml
  tests/test_doctor_workflow.py              missing, stale, registered, fix
  CHANGELOG.md                               one [Unreleased] line
apps/website/src/content/docs/docs/customize/your-own-workflow.mdx   run, resume --input, permissions
```

**Structure Decision**: extend the existing read side and doctor; no new script, so the packing lists stay as they are.

## Blocks

### calls

```
specify workflow run speckit-companion
  └─ specify (command) ─ writes size into .spec-context.json, points .specify/feature.json
  └─ size (shell) ─ status-context.py --size ─ stdout "simple" | "normal" | "oversized" | ""
  └─ route (switch on steps.size.output.stdout)
       simple    → implement
       oversized → warn, gate review_spec, plan, gate review_plan, tasks, implement
       default   → gate review_spec, plan, gate review_plan, tasks, implement
  └─ converge
doctor.py --fix ─ check_workflow ─ specify workflow add <shipped yml>
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: the workflow stays a user-visible, overridable file; routing keys come from `_order.yml`. |
| II. Spec-Driven Workflow | PASS: same pipeline order on both paths; auto untouched. |
| III. Visual and Interactive | PASS: no UI change. |
| IV. Modular Architecture | PASS: one flag on an existing reader, one check in the existing doctor. |

Data model: `data-model.md`.
