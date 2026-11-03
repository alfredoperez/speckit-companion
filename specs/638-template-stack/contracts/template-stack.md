# Contract: template stack

The feature exposes one Python function, one folder layout, one note wording and one doctor check. There is no network API, CLI flag or schema.

## `template_render.base_template(project_root, name)`

Lives in `apps/speckit-extension/scripts/template_render.py`. It is the only place that decides which template a step starts from.

- **Inputs**: `project_root`, the project folder, and `name`, a template file name such as `plan-template.md`. Only the spec, plan and tasks templates are in scope.
- **Returns**: the text of the template spec-kit resolves for `name`, so an override and a preset win the way they do on stock runs.
- **How it asks**: runs `.specify/scripts/bash/resolve-template.sh <stem>` with the project as the working directory and `SPECIFY_INIT_DIR` set, then reads the path the script prints.
- **Raises `TemplateError`** when the script runs and exits non-zero. The message names the template. The build catches it and stops before writing anything.
- **Falls back to the core file** (`.specify/templates/<name>`) when the script is absent or `bash` is not on the path. No error is raised.
- **Old-copy guard**: when the answer is byte-equal to Companion's old copy under `.specify/extensions/companion/templates/`, the core file is returned instead.

Callers: `resolve()` (section swaps are applied to this text, not the core file), `pipeline-graph.py` (`sectionsAvailable`) and `config_write.py` (`check_template_section()`).

## Built-folder layout

- Root: `.specify/companion/built/`, inside the project, outside Companion's extension folder, so spec-kit never lists it as an extension layer and a forced reinstall leaves it alone.
- Each file keeps the template's own name, for example `.specify/companion/built/plan-template.md`.
- A copy is written when a section swap is configured, or when nothing is configured but the resolved template differs from the core template.
- With no swap and a resolved template equal to core, no copy is written and command bodies are byte-identical.
- After a successful write the build removes Companion's old copies under `.specify/extensions/companion/templates/`. A failed build writes and removes nothing.

## Shape-note wording

`render_shape_note` splices a note into a step's body only when the project reshaped the document. Two forms:

- **Section**: swaps are configured. The note says this project has reshaped what the step writes, names each changed section in bold, tells the step to read the built copy at `.specify/companion/built/<name>` and follow it for that section (or those sections), says its wording replaces the shape described below for that section, and says every other instruction still applies.
- **Whole**: nothing is configured but the stack's winner is not core. The note tells the step to read the built copy at `.specify/companion/built/<name>` and follow it whole, as the shape of the document, with every other instruction still applying.

With nothing changed the note is the empty string.

## Doctor check `built`

Registered in `doctor.py`, implemented as `check_built()` in `doctor_checks.py`. It is separate from the existing `template` check, which is about the shape of `tasks.md`. States:

- **ok / silent**: no override and no preset on the three templates, or a built copy that matches what spec-kit resolves. Nothing about templates is reported.
- **missing**: an override or preset applies to a template and no built copy exists. The finding says Companion runs ignore the override until a rebuild.
- **stale**: a built copy exists but no longer matches what spec-kit resolves. The finding says it is out of date and a rebuild is needed.
