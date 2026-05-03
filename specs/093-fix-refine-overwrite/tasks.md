# Tasks: Fix Refine Template Overwrite

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Replace slash-command refinement prompt with direct-edit prompt — `src/features/spec-viewer/messageHandlers.ts` | R001, R002, R003, R005
  - **Do**: Rewrite the body of `handleSubmitRefinements` (currently lines 562–592). Remove the `resolveWorkflowSteps` lookup and the `currentStep` derivation. Map `instance.state.currentDocument` → `${currentDocument}.md` for the target filename. Build the prompt as: `Edit ${targetPath}/${filename} in place to apply ONLY these line-specific refinements. DO NOT regenerate from any template. DO NOT run any setup script (e.g. setup-spec.sh, setup-plan.sh, setup-tasks.sh). DO NOT replace the file — make targeted edits only.\n\nRefinements requested:\n${refinementText}`. Pass to `deps.executeInTerminal`. Keep the existing `refinementText` formatting at lines 573–575 unchanged.
  - **Verify**: `npm run compile` passes. With the extension running locally, trigger a refinement and confirm the SpecViewer output channel logs a prompt starting with "Edit " (not "/speckit.").
  - **Leverage**: Existing function signature, `refinementText` bullet formatting (lines 573–575), and `deps.executeInTerminal` plumbing.

- [x] **T002** [P] Add unit test for refinement prompt shape — `src/features/spec-viewer/__tests__/messageHandlers.test.ts` | R001, R002, R005
  - **Do**: Add a `describe('submitRefinements')` block that builds a fake handler dependency with a stubbed `executeInTerminal` that captures its argument. Dispatch a `submitRefinements` message with two refinements. Assert: (a) the captured prompt does NOT start with `/`, (b) it contains the strings `DO NOT regenerate` and `DO NOT run any setup script`, (c) it includes both refinements' line numbers in the bulleted list.
  - **Verify**: `npm test` passes; the new test runs and asserts pass.
  - **Leverage**: Existing test patterns in `messageHandlers.test.ts` (e.g. the spec-state shape at line 44 / 265).

- [x] **T003** *(depends on T001, T002)* Update README if user-facing behavior changed — `README.md` | R002
  - **Do**: Per CLAUDE.md, when user-facing behavior changes, update README. The Refine button's behavior is documented under the spec viewer / refinements section. Add a one-line clarification that Refine performs a targeted in-place edit (does not re-run the per-step command). If no Refine documentation exists, skip with a note in the PR description.
  - **Verify**: `git diff README.md` shows the clarification or PR description notes "no README change required (Refine is not currently documented)".
