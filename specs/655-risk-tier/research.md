# Research

**Decision**: measure the change from the merge base with `origin/main`, `main`, `origin/master` or `master`, plus uncommitted and untracked files. **Rationale**: covers work already committed on the branch; copies the fold's `_git_changed_files` approach. **Alternatives considered**: `git diff HEAD` only, which misses earlier commits on the branch.

**Decision**: reuse `_glob_matches` from `resolve-spec-paths.py`. **Rationale**: it supports `**`; `fnmatch` misreads brackets. **Alternatives considered**: a second glob matcher.

**Decision**: depth wording in the implement node: low = a careful self-review, normal = one independent review, high = two independent reviewers. **Rationale**: matches how this repo already reviews (one reviewer, Codex beside it where it pays). **Alternatives considered**: tying depth to named tools, which a host may not have.
