---
id: resolve-dir-git
name: Resolve the spec folder, on a branch
kind: control
command: specify
reads: []
---
1. **Resolve the feature directory and put it on a branch of its own.** `.specify/feature.json` is an **output** of this step, not an input to reuse: it points at the *previous* spec (frequently already completed), so reusing it would clobber finished work.

   Number the feature against everything that already claims a number, not only what is on disk — a teammate's branch may hold `014` with no `specs/014-…` here yet:
   ```bash
   git fetch --all --prune
   ```
   Take the highest `NNN` across local branches, remote branches, and `specs/` directories, and use `NNN+1`. Derive a 2–4 word short-name from the description; the spec file is `<feature_directory>/<short-name>.spec.md`.

   Create and check out the branch, then the directory:
   ```bash
   git checkout -b <NNN+1>-<short-name>
   ```
   **Never write into a directory that already contains a feature spec (`*.spec.md`, or an older `spec.md`)** — that is a stale pointer to a prior spec, not this feature.

   Create `<feature_directory>/`, then point `.specify/feature.json` at it by writing `{"feature_directory": "<feature_directory>"}` — that exact key is what the later capture calls resolve the spec through when they run without `--feature-dir`, so any other key silently drops those writes. Then stamp the **specify START** as the step-start instruction above directs — the directory now exists, so this is the moment it says to run it, before any other work.

   If the branch already exists, check it out rather than creating a second one, and say so. If the working tree has uncommitted changes that would be carried onto a new branch, stop and say what they are — silently moving someone's work to a branch they did not ask for is worse than not branching.
