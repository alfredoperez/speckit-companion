# Data Model: Companion steps read spec-kit's template stack

## Resolved base template

The template text spec-kit's resolver says wins for one stem (`spec-template`, `plan-template` or `tasks-template`). It is computed on demand by `base_template()` in `template_render.py`, never stored.

- **stem**: one of the three in-scope stems. Any other stem is rejected.
- **text**: the winning file's content, or the core file's content when the resolver script is missing or `bash` is not on the path (FR-006).
- **is_core**: true when the winner is the core file. An answer byte-equal to Companion's old copy under `.specify/extensions/companion/templates/` counts as core, so the build never reads its own stale output as an override.
- **failure**: a resolver that runs and exits non-zero raises an error naming the stem, and the build stops before writing anything (FR-007).

Callers: the build's section swaps, the panel's `sectionsAvailable`, the settings writer's section check, and the doctor.

## plan_templates entry

One entry per stem, produced by `plan_templates()` in `build-pipeline.py`.

- **name**: the template's file name, kept as is inside the built folder.
- **text**: the final text to write. Configured swaps applied on top of the resolved base template, not the core file (FR-002).
- **changed sections**: the section headings the configured swaps touched. Empty when nothing is configured.
- **whole**: true when no swaps are configured and the resolved base template is not the core file (FR-003). The step is then told to follow the built copy whole.

Validation: an entry exists only when there are changed sections or `whole` is true. With neither, there is no entry, no copy and no change to the command body (FR-004).

## Built copy

The file written from a plan_templates entry.

- **path**: `.specify/companion/built/<name>`, a project-owned folder outside Companion's extension folder, so spec-kit sees no Companion extension layer and a forced reinstall leaves it alone (FR-005).
- **content**: the entry's `text`.
- **referenced by**: the assembled step command, which points at the path and carries a shape note, or the whole-file note when `whole` is set.

State transitions:

1. Absent: no customisation, or a stem not yet built.
2. Written: a successful rebuild writes all entries; only then are Companion's old copies in the extension folder removed.
3. Stale: the resolver's answer or the configured swaps changed since the last build. It stays stale until the next rebuild rewrites it.
4. Removed: a rebuild where the entry no longer applies deletes the copy.

## Doctor `built` finding

A new check, `check_built()` in `doctor_checks.py`, registered as `built` in `doctor.py`. It is separate from the existing `template` check, which concerns the shape of `tasks.md`.

- **check**: the fixed name `built`.
- **stem**: the template the finding is about.
- **kind**: `missing` (the resolved base template is not core, or swaps are configured, and no built copy exists) or `stale` (the copy differs from what a rebuild would write now).
- **message**: names the stem and says Companion runs ignore the override or preset until a rebuild.

Validation: no finding for a stem with no override, no preset and no configured swap, so an uncustomised project reports nothing (FR-008).

## Relationships

The resolved base template feeds the plan_templates entry. The entry is written as the built copy. The doctor compares the built copy against a fresh resolve and reports the `built` finding.
