# Spec: Fix Analyze Spec-Context Update

**Slug**: 123-fix-analyze-spec-context | **Date**: 2026-06-05

## Summary

When the user runs the optional `analyze` step from the spec viewer, the AI never updates `.spec-context.json` to mark that step complete, so the viewer renders the spec as "needs regeneration" indefinitely. The extension already calls `startStep('analyze')` before dispatching, but the prompt-builder skips its bookkeeping preamble for `analyze` (and `clarify`), leaving the AI with no instruction to flip status or append a `complete` history entry. The fix teaches `buildPrompt` to emit a preamble for `analyze` so the lifecycle closes cleanly without depending on the user-local `.specify/extensions.yml` `after_analyze` hook.

## Requirements

- **R001** (MUST): Dispatching `/speckit.analyze` from the spec viewer MUST include the standard context-update preamble — covering schema, status lifecycle, the mandatory final-write box, and shared timestamp rules — in the prompt the extension sends to the AI provider.
- **R002** (MUST): The analyze preamble MUST instruct the AI to flip `status` to `ready-to-implement` and append a `{ step: "analyze", substep: null, kind: "complete", by: "ai", at: <real timestamp> }` history entry before the turn ends.
- **R003** (MUST): The analyze preamble MUST NOT regress the `tasks` step's `ready-to-implement` completed status when run after `tasks` — the start-entry written by the extension and the completion-entry written by the AI both leave the spec in `ready-to-implement` at rest.
- **R004** (MUST): When the AI completes `analyze`, the viewer's stuck "needs regeneration" / in-flight indicator MUST clear on the next file-watcher tick, identical to how `tasks` clears today.
- **R005** (MUST): Existing behavior for `specify`, `plan`, `tasks`, and `implement` (preamble shape, completed-status table, done-phrase footer) MUST be unchanged — verified by the existing `promptBuilder.test.ts` snapshots and assertions.
- **R006** (SHOULD): Apply the same fix to `clarify` (the other lifecycle step the extension dispatches but `buildPrompt` currently skips), so the latent symmetric bug is closed in the same change.
- **R007** (SHOULD): The fix MUST live in extension-shipped code (`src/...`) — no edits to `.specify/extensions.yml`, `.specify/extensions/companion/**`, or `.claude/skills/**`, per the extension-isolation rule in `CLAUDE.md`.

## Scenarios

### Analyze completes cleanly from spec viewer

**When** the user clicks "Analyze" in the spec viewer footer after `tasks` has completed (status `ready-to-implement`)
**Then** the extension writes a start-entry for `analyze` (status temporarily `tasking`), dispatches `/speckit.analyze <path>` wrapped in the context-update preamble, the AI appends an `analyze` completion entry and flips status back to `ready-to-implement`, and the viewer redraws without the "needs regeneration" banner.

### Codex CLI on a brand-new workspace

**When** a user on Codex 0.136.0 / spec-kit 0.9.3.dev0 / Extension v0.21.0 — without the dev workspace `.specify/extensions/companion/**` or `.claude/skills/**` files — runs `analyze` from the viewer
**Then** the preamble alone (which ships in the `.vsix`) carries enough instruction for Codex to update `.spec-context.json` correctly; no `after_analyze` lifecycle hook in `.specify/extensions.yml` is required.

### Analyze run before tasks (defensive)

**When** an AI invokes `analyze` while the spec is still in `planned` (no `tasks.md` yet) — an off-nominal but possible state
**Then** the preamble's in-progress / completed mapping still resolves (`tasking` → `ready-to-implement`), the AI writes a clean completion entry, and no exception is thrown by `buildPrompt` or downstream consumers.

### Clarify symmetry

**When** the user runs `clarify` from the viewer (same latent gap)
**Then** the preamble is emitted, the AI completes the step (status `specified`), and the viewer clears in-flight state — same code path as analyze.

### Preamble snapshots stay green

**When** the test suite runs after the fix
**Then** every existing `promptBuilder.test.ts` case for `specify` / `plan` / `tasks` / `implement` passes unchanged, and new cases assert the preamble is emitted for `analyze` and `clarify` with the correct completed status (`ready-to-implement` / `specified`) and done phrase.

## Non-Functional Requirements

- **NFR001** (MUST): No additional network calls or file reads during prompt build — the fix stays a pure in-memory lookup table change, so the prompt-build latency is unchanged.
- **NFR002** (SHOULD): No new public exports from `promptBuilder.ts`; the existing `buildPrompt(...)` signature stays stable so callers in `specCommands.ts` and `messageHandlers.ts` need no changes.

## Out of Scope

- The "Codex asks a follow-up question" symptom mentioned in #190 / #194. That is a property of the `speckit-analyze` skill prompt (offers a remediation Q&A), which lives in user-local `.claude/skills/**` and is not shipped with the extension. Fixing it requires upstream spec-kit changes, not Companion changes.
- Adding a real `companion.capture` lifecycle hook for `after_analyze` in `.specify/extensions.yml`. Users without the file (the majority) wouldn't benefit; the preamble-in-prompt path solves the problem for everyone in one place.
- Changing the semantic that `analyze` shares the `tasking` / `ready-to-implement` status pair with `tasks` (status table in `data-model.md` stays a 10-entry vocab).
- Any UI changes to the analyze button, footer, or "needs regeneration" copy.
