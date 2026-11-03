# Plan: New specs are written as spec.md

**Scale note**: about 24 files across two areas, the prompt nodes and the check scripts, with their tests. Watch for a node that still names `<short-name>.spec.md` after the rebuild, and for a check that reads the spec by a literal name.

## Summary

Companion's specify and auto nodes write the feature spec as `spec.md`, and every node that loads it names `spec.md` first with the older `<short-name>.spec.md` as the fallback. The three draft nodes declare `writes: spec.md`. The manifest's verify step, the doctor's artifact check and the quality check resolve a declared `spec.md` through `spec_context.feature_spec_path`, so both names pass and no old folder is flagged. The viewer, the board and the mod already read both names and are not touched.

## Project Structure

```text
apps/speckit-extension/
├── nodes/specify/{resolve-dir,resolve-dir-git,draft-spec,draft-spec-delta,draft-spec-bugfix,quality-checklist,quality-checklist-blocking,branch,finalize}.md
├── nodes/auto/resolve-dir.md, nodes/plan/gather-context.md, nodes/tasks/tasks-doc.md, nodes/implement/implement-exec.md
├── commands/speckit.companion.{specify,plan,tasks,implement,auto}.md, commands/.manifest.json   # rebuilt
├── scripts/{manifest,doctor_checks,check_quality,dispatch-briefs}.py
├── tests/{test_manifest,test_pipeline_graph,test_doctor,test_check_quality,test_dispatch_briefs}.py
├── docs/{commands,install}.md
└── CHANGELOG.md
apps/vscode/src/features/specs/featureSpecPath.ts   # comment only
```

**Structure Decision**: one resolver, `feature_spec_path`, answers "where is this feature's spec" for every check; nodes only change their wording.

## Call paths

```calls the doctor accepts either spec name
  check_artifact() @ apps/speckit-extension/scripts/doctor_checks.py:673
~   _artifact_exists() @ apps/speckit-extension/scripts/doctor_checks.py:668
+     feature_spec_path() @ apps/speckit-extension/scripts/spec_context.py:312
```
note: `manifest.unproduced()` and `check_quality.check_verbosity()` make the same switch.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: matches spec-kit's own file name, so stock commands work on Companion specs. |
| II. Spec-Driven Workflow | PASS: converge, analyze and clarify can run on every new spec. |
| III. Visual and Interactive | PASS: no screen changes; readers already accept both names. |
| IV. Modular Architecture | PASS: checks share one resolver instead of literal names. |
