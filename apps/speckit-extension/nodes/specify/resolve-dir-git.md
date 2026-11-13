---
id: resolve-dir-git
name: Resolve the spec folder, on a branch
kind: control
command: specify
reads: []
---
1. **Resolve the feature directory and put it on a branch of its own.** `.specify/feature.json` is an **output** of this step, never an input: it points at the *previous* spec, so reusing it would clobber finished work.

   Number the feature against everything that already claims a number, not only what is on disk. A teammate's branch may hold `014` with no `specs/014-…` here yet:
   ```bash
   git fetch --all --prune
   ```
   Then derive a 2–4 word short-name from the description and run `python3 .specify/extensions/companion/scripts/mint-spec-dir.py --branches --short-name "<short-name>"`. It takes the next number across `specs/` and every local and remote branch, or a timestamp when this project's `feature_numbering` says so, creates the folder under a lock so a run started at the same time gets the next one, points `.specify/feature.json` at it and prints its path. Never pick the number yourself; when the request names a spec number ("spec 671"), add `--number 671` and the script uses it, refusing a number another folder already holds. The spec file is `<feature_directory>/spec.md`.

   Create and check out the branch named after the folder:
   ```bash
   git checkout -b <the last segment of the path the script printed, for example 651-x>
   ```
   **Never write into a directory that already contains a feature spec (`spec.md`, or an older `*.spec.md`)**: that's a prior spec, not this one.

   Then stamp the **specify START** as the step-start instruction above directs: the directory exists now, so run it before any other work.

   Right after the stamp, store the request word for word: the user input this command received, exactly as given, never a summary. Pass it on stdin so quotes and line breaks survive:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --request - <<'COMPANION_REQUEST'
   <the user input, unchanged>
   COMPANION_REQUEST
   ```
   The record keeps the first request it is given, so when auto started this run and stored its own, this call changes nothing.

   If the branch already exists, check it out rather than creating a second one, and say so. If the working tree has uncommitted changes that would be carried onto a new branch, stop and say what they are.
