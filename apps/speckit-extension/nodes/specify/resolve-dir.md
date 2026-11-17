---
id: resolve-dir
name: Resolve the spec folder
kind: control
command: specify
reads: []
---
1. **Resolve the feature directory. Mint a fresh dir for new work.** `.specify/feature.json` is an **output** of this step, never an input: it points at the *previous* spec, so reusing it would clobber finished work. On a project's first run it is absent or zero-byte, which means the same thing. Pick the target:
   - If the request names a target path (or `SPECIFY_FEATURE_DIRECTORY` is set), use it.
   - Otherwise derive a 2–4 word short-name from the description and run `python3 .specify/extensions/companion/scripts/mint-spec-dir.py --short-name "<short-name>"`. It creates the next folder, numbered the way this project's `feature_numbering` says and safe against a run started at the same time, points `.specify/feature.json` at it, and prints its path. Never pick the number yourself; when the request names a spec number ("spec 671"), add `--number 671` and the script uses it, refusing a number another folder already holds. The spec file is `<feature_directory>/spec.md`. **Never write into a directory that already contains a feature spec (`spec.md`, or an older `*.spec.md`)**: that's a prior spec, not this one.
   For a named target, create `<feature_directory>/` and point `.specify/feature.json` at it by writing `{"feature_directory": "<feature_directory>"}`. Later capture calls resolve the spec through that exact key when they run without `--feature-dir`, so any other key silently drops those writes.
   Then stamp the **specify START** as the step-start instruction above directs: the directory exists now, so run it before any other work.

   Right after the stamp, store the request word for word: the user input this command received, exactly as given, never a summary. Pass it on stdin so quotes and line breaks survive:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --request - <<'COMPANION_REQUEST'
   <the user input, unchanged>
   COMPANION_REQUEST
   ```
   The record keeps the first request it is given, so when auto started this run and stored its own, this call changes nothing.
