# Tasks: Sizing and unverified guards

**Input**: [plan.md](./plan.md), [sizing-and-unverified-guards.spec.md](./sizing-and-unverified-guards.spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/behaviour.md](./contracts/behaviour.md)

Three stories, three disjoint file sets. No setup and no shared foundation: each story's files already exist except the branch resolver.

## Phase 3: User Story 1 - A risky small change takes the full path (Priority: P1)

**Goal**: a change inside the small bar that is hard to undo or hard to check is sized `normal`, and the run log says why.

**Independent Test**: `build.py --check` and `instruction-budget.py --strict` pass, and the built specify and classify commands both carry the rule.

Files: `apps/speckit-extension/presets/_parts/sizing.md`, `apps/speckit-extension/nodes/specify/classify-size.md`, `apps/speckit-extension/commands/speckit.companion.specify.md`, `apps/speckit-extension/commands/speckit.companion.classify.md`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] The `small` bullet says a change is small only when it is also easy to undo and easy to check, as a continuation line, with no new bullet · apps/speckit-extension/presets/_parts/sizing.md
- [x] **T002** [P] [US1] The verdict fence defines `riskyToShip` and requires `not riskyToShip` for `simple`, keeping `crossedGuardrail` first and `"oversized"` in the same fence; the reason line is a second fenced line under the existing Guardrail warning bullet, with one sentence on which line prints when · apps/speckit-extension/nodes/specify/classify-size.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US1] Rebuild the commands with `build.py`; `build.py --check` and `instruction-budget.py --strict` pass with specify still at 69 · apps/speckit-extension/commands/speckit.companion.specify.md, apps/speckit-extension/commands/speckit.companion.classify.md

**Checkpoint**: both commands state the rule and CI's shape and budget gates pass.

## Phase 4: User Story 2 - A spec that finishes unverified says so (Priority: P1)

**Goal**: completion adds one "finished, unverified" concern and warns when nothing is verified and nothing explains it, and never refuses.

**Independent Test**: the new `MarkCompleteTests` cases pass and every existing one still does.

Files: `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_context.py`

### Tests

- [x] **T004** [US2] Cases written to fail first: an unverified, unexplained spec completes with exactly one concern and the warning on stderr; a verified spec gains nothing and prints no warning; a spec with a top-level concern gains nothing; non-list `verified` and `concerns` count as empty and completion still succeeds; the implementing-with-all-tasks-checked path is covered; a second call adds nothing · apps/speckit-extension/tests/test_context.py

### Implementation

- [x] **T005** [US2] `mark_spec_complete` adds `{"note": "finished, unverified", "step": "implement"}` to the in-memory record after the re-read and before its single write, and prints the `[companion] Warning:` line on stderr; it still returns the target · apps/speckit-extension/scripts/write-context.py

**Checkpoint**: the whole speckit-extension test suite passes.

## Phase 5: User Story 3 - A spec row says which branch it is on (Priority: P2)

**Goal**: the row tooltip shows the branch, read the same way the viewer reads it.

**Independent Test**: the resolver and tooltip tests pass.

Files: `apps/vscode/src/features/specs/specBranch.ts`, `apps/vscode/src/features/specs/__tests__/specBranch.test.ts`, `apps/vscode/src/features/specs/specExplorerProvider.ts`, `apps/vscode/src/features/specs/__tests__/specExplorerProvider.test.ts`, `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`

### Tests

- [x] **T006** [P] [US3] `resolveSpecBranch`: working branch first, then branch, blank and non-text values skipped, nothing for no record · apps/vscode/src/features/specs/__tests__/specBranch.test.ts
- [x] **T007** [P] [US3] The row tooltip holds `Branch: <name>` after the Assistant line when a branch is recorded, and no Branch line for none, blank or non-text · apps/vscode/src/features/specs/__tests__/specExplorerProvider.test.ts

### Implementation

- [x] **T008** [US3] `resolveSpecBranch(ctx)` beside the assistant and status resolvers · apps/vscode/src/features/specs/specBranch.ts

**⟶ Wait for T008, then:**

**Wave 2 — independent (different files):**

- [x] **T009** [P] [US3] The tooltip pushes the Branch line between the Assistant line and the running line · apps/vscode/src/features/specs/specExplorerProvider.ts
- [x] **T010** [P] [US3] Both viewer branch reads go through the resolver · apps/vscode/src/features/spec-viewer/specViewerProvider.ts

**Checkpoint**: the sidebar and the viewer name the same branch for the same spec.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T011** [P] Docs: the sizing table and the small-change sentence say a risky change takes the full path; the commands doc's sizing sentence matches; the sidebar page names what the hover shows · apps/website/src/content/docs/docs/steps/specify.mdx, apps/website/src/content/docs/docs/start/your-first-spec.mdx, apps/speckit-extension/docs/commands.md, apps/website/src/content/docs/docs/navigate/the-sidebar.mdx
- [x] **T012** [P] Changelogs under Unreleased: two entries for the speckit extension (sizing, unverified warning), one for the VS Code extension (branch in the hover); no version bump · apps/speckit-extension/CHANGELOG.md, CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** Validate against the Success Criteria: `npm run compile`, `npm test`, the speckit-extension unittest suite, `build.py --check`, `instruction-budget.py --strict` · apps/speckit-extension/scripts/write-context.py

## Dependencies & Execution Order

- The three stories share no file and can run in any order; Polish follows them.
- US1: T001 and T002 together, then the rebuild. US2: tests, then the writer. US3: tests and the resolver, then the two callers. Polish: docs and changelogs together, then validation.
