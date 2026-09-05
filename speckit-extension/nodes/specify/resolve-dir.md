---
id: resolve-dir
name: Resolve the spec folder
kind: control
command: specify
reads: []
---
1. **Resolve the feature directory — mint a fresh dir for new work.** `.specify/feature.json` is an **output** of this step, not an input to reuse: it points at the *previous* spec (frequently already completed), so reusing it would clobber finished work. Pick the target:
   - If the request explicitly names a target path (or `SPECIFY_FEATURE_DIRECTORY` is set), use it.
   - Otherwise create the next numbered dir: scan `specs/` for the highest `NNN-…` prefix, derive a 2–4 word short-name from the description, and use `specs/<NNN+1>-<short-name>/`. **Never write into a directory that already contains a `spec.md`** — that's a stale pointer to a prior spec, not this feature.
   Create `<feature_directory>/`, then point `.specify/feature.json` at it by writing `{"feature_directory": "<feature_directory>"}` — that exact key is what the later capture calls resolve the spec through when they run without `--feature-dir`, so any other key silently drops those writes. Then stamp the **specify START** as the step-start instruction above directs — the directory now exists, so this is the moment it says to run it, before any other work.

