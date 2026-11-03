---
id: resolve-dir
name: Resolve the spec folder
kind: control
command: auto
reads: []
---
1. **Resolve the feature directory — mint a fresh dir for new work.** Auto is a fresh-spec entry point, exactly like specify. `.specify/feature.json` is an **output**, not an input to reuse: it points at the *previous* spec (frequently already completed), so reusing it would clobber finished work. Pick the target:
   - If the request explicitly names a target path (or `SPECIFY_FEATURE_DIRECTORY` is set), use it.
   - Otherwise derive a 2–4 word short-name from the description and run `python3 .specify/extensions/companion/scripts/mint-spec-dir.py --short-name "<short-name>"`. It creates the next folder, numbered the way this project's `feature_numbering` says and safe against a run started at the same time, points `.specify/feature.json` at it, and prints its path. Never pick the number yourself. The spec file is `<feature_directory>/spec.md`. **Never write into a directory that already contains a feature spec (`spec.md`, or an older `*.spec.md`)** — that's a stale pointer to a prior spec, not this feature.
   For a named target, create `<feature_directory>/` and point `.specify/feature.json` at it by writing `{"feature_directory": "<feature_directory>"}` — that exact key is what the later capture calls resolve the spec through when they run without `--feature-dir`, so any other key silently drops those writes.
   Then stamp the **specify START** as the step-start instruction above directs — the directory now exists, so this is the moment it says to run it, before any other work.
