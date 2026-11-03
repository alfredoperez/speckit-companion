# Plan: Companion steps read spec-kit's template stack

## Summary

Companion's pipeline build reads the spec, plan and tasks templates straight from the core folder, so a project override or a spec-kit preset never reaches a Companion run, and its built copy sits in Companion's extension folder, where spec-kit treats it as a template layer for stock runs too. This change adds one function in `template_render.py` that asks spec-kit's own `resolve-template.sh` which template wins, and every reader of a base template goes through it: the build's section swaps, the panel's section list and the settings writer's section check. When nothing is configured but the stack's winner is not the core file, the build writes it whole and tells the step to follow it. The built copy moves to `.specify/companion/built/`, and a new doctor check, `built`, reports a copy that is missing or no longer matches.

## Project Structure

```text
apps/speckit-extension/
├── scripts/
│   ├── template_render.py     # base_template(), resolve() reads it, BUILT_REL, whole-file note
│   ├── build-pipeline.py      # plan_templates() carries `whole`, writes to the built folder, retires the old copies
│   ├── pipeline-graph.py      # sectionsAvailable from base_template()
│   ├── config_write.py        # check_template_section() against base_template()
│   ├── doctor_checks.py       # check_built()
│   └── doctor.py              # registers `built`
├── commands/speckit.companion.doctor.md   # names the new check
├── tests/
│   ├── test_template_stack.py # new: resolver, override, preset append, swaps on top, fallback, failure, old-copy guard
│   ├── test_doctor.py         # check_built cases
│   ├── test_builder_flow.py   # new built path
│   └── test_presets.py        # new built path
└── CHANGELOG.md
apps/vscode/src/features/specs/pipelineBuild.ts  # staleness also looks at .specify/presets
```

**Structure Decision**: all template knowledge stays in `template_render.py`; the build, the panel, the settings writer and the doctor call it rather than reading `.specify/templates` themselves.

## Call paths

```calls build resolves a template through the stack
  main() @ apps/speckit-extension/scripts/build-pipeline.py:623
~   plan_templates() @ apps/speckit-extension/scripts/build-pipeline.py:475
~     resolve() @ apps/speckit-extension/scripts/template_render.py:142
+       base_template() @ apps/speckit-extension/scripts/template_render.py:142
~   render() @ apps/speckit-extension/scripts/build-pipeline.py:515
~     render_shape_note() @ apps/speckit-extension/scripts/template_render.py:103
```
note: the write loop in main() moves from the extension folder to `.specify/companion/built/` and removes Companion's old copies after a successful write.

```calls the panel lists sections from the winner
  _template() @ apps/speckit-extension/scripts/pipeline-graph.py:45
+   base_template() @ apps/speckit-extension/scripts/template_render.py:142
```
note: `check_template_section()` in config_write.py:1184 makes the same switch, so the settings writer accepts a section the override adds.

```calls doctor reports a missing or stale built copy
  examine() @ apps/speckit-extension/scripts/doctor.py:318
+   check_built() @ apps/speckit-extension/scripts/doctor_checks.py:749
+     resolve() @ apps/speckit-extension/scripts/template_render.py:142
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: a team's own override or preset now configures Companion's documents the standard spec-kit way. |
| II. Spec-Driven Workflow | PASS: the spec, plan and tasks shapes come from the project's templates. |
| III. Visual and Interactive | PASS: the panel lists the sections the winning template really has. |
| IV. Modular Architecture | PASS: one function owns template lookup; four callers share it. |
