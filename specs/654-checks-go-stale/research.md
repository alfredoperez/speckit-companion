# Research

**Decision**: snapshot after the command, with a temp copy of the index (`git add -A`, `git write-tree`). **Rationale**: checks run before the work is committed, so HEAD alone is not the code that was checked; the temp index leaves the user's staging untouched. **Alternatives considered**: `git stash create` ignores untracked files; HEAD only misses uncommitted work.

**Decision**: changed = `git diff --name-only <tree>` plus untracked files the tree does not hold, excluding top-level `specs/` and `.specify/`. **Rationale**: diff against a tree covers tracked files only; new files written after the check would otherwise not count. **Alternatives considered**: building a fresh tree on every refresh writes objects into the repo each time the panel updates.

**Decision**: Verified turns amber when a check is out of date; the header strip is unchanged. **Rationale**: the section is where the row is; the strip counts checks, not their freshness. **Alternatives considered**: a strip warning, deferred to the receipts slice.

**Decision**: the plan-check entry written by `record_plan_report` gets no commit. **Rationale**: it checks the plan document, not the code.
