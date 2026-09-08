---
id: resolve-dir
name: Resolve the spec folder
kind: control
command: specify
reads: []
---
1. **Resolve the feature directory. Mint a fresh dir for new work.** `.specify/feature.json` is an **output** of this step, never an input: it points at the *previous* spec, so reusing it would clobber finished work. On a project's first run it is absent or zero-byte, which means the same thing. Pick the target:
   - If the request names a target path (or `SPECIFY_FEATURE_DIRECTORY` is set), use it.
   - Otherwise create the next numbered dir: scan `specs/` for the highest `NNN-…` prefix, derive a 2–4 word short-name from the description, and use `specs/<NNN+1>-<short-name>/`. The spec file is `<feature_directory>/<short-name>.spec.md`. For a named target, `<short-name>` is its directory name without the numeric prefix. **Never write into a directory that already contains a feature spec (`*.spec.md`, or an older `spec.md`)**: that's a prior spec, not this one.
   Create `<feature_directory>/`, then point `.specify/feature.json` at it by writing `{"feature_directory": "<feature_directory>"}`. Later capture calls resolve the spec through that exact key when they run without `--feature-dir`, so any other key silently drops those writes. Then stamp the **specify START** as the step-start instruction above directs: the directory exists now, so run it before any other work.
