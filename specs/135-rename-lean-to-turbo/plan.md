# Implementation Plan: Rename the "lean" template profile to "turbo"

**Branch**: `135-rename-lean-to-turbo` | **Spec**: [spec.md](./spec.md)

## Summary

Rename the trimmed pipeline profile from "lean" to "turbo" everywhere a user selects or sees it — the `speckit.companion.templateProfile` setting, the per-spec recorded `profile` value, the `companion-lean` preset (directory, id, name, descriptions), and all living documentation — with zero behavior change. Nothing shipped under the old name, so the old `lean` value is dropped outright: no alias, no fallback, no migration. The `/speckit.companion.*` command names contain no "lean" and stay as-is.

## Technical Context

- **Language/Version**: TypeScript 5.3+ (ES2022, strict) for the VS Code extension; Python 3 + Markdown/YAML for the spec-kit extension.
- **Primary Dependencies**: VS Code Extension API; no new dependencies.
- **Storage**: `.spec-context.json` `profile` field (vocabulary becomes `standard | turbo`); `.specify/companion.yml` `templateProfile`.
- **Testing**: Jest (`npm test`) for the VS Code side; `speckit-extension/tests/test_context.py` and `scripts/check-shape-parity.py` for the spec-kit side.
- **Target Platform**: Both extensions (VS Code extension + spec-kit `companion` extension) — each gets its own changelog entry and version bump per the dual-extension rule.
- **Hard Constraints**: Rename only — `turbo` must produce byte-identical trimmed output to what `lean` produced (SC-002, enforced by the shape-parity script); `standard`/`off` untouched (FR-003); command names unchanged (FR-008).

## Decisions

- **No fallback for a persisted `lean` setting value (FR-007).** The known "renaming an enum value crashes activation" hazard applied to `speckit.aiProvider` path lookup; here `readTemplateProfile` already validates against `VALID_PROFILES` and treats unknown values as unset, so a stale `lean` in someone's settings degrades safely to the default — no alias needed, no crash possible.
- **Reconciler keeps removing leftover old-name installs.** `decideEnsureStandardOps` currently removes stranded `companion-lean` / legacy `sdd-lean` preset installs. That is install cleanup, not value aliasing, so it survives the rename: `companion-lean` moves into the legacy-removal set alongside `sdd-lean`, and `companion-turbo` becomes the live trimmed-preset id.
- **Bench harness renames its vocabulary, not its history.** `/bench-prep`'s mode enum and the bench docs say "turbo" going forward; generated artifacts (`bench/stats.jsonl`, `bench/REPORT.md`) are historical records and stay as-is per FR-006.
- **Generated copies are not edited.** `.specify/extensions/companion/**`, `.specify/presets/.cache/**`, `.specify/extensions/.cache/**`, and the installed `.claude/skills/speckit-companion-*` copies are install outputs; they refresh on the next local install. Only `speckit-extension/` sources change.
- **This spec's own `.spec-context.json` flips `profile: "lean"` → `"turbo"`** during implement, so the recorded value validates against the new schema (SC-005). Older spec dirs (e.g. `specs/132-sdd-lean-pipeline`) are historical and exempt.

## Approach & Structure

Order of attack — types first so the compiler surfaces every dependent site, then the spec-kit extension (mechanical dir rename + wording), then docs, then dev tooling.

### 1. VS Code extension — types and logic

- `src/core/types/specContext.ts` — `profile?: 'standard' | 'lean'` → `'standard' | 'turbo'`; update the doc comment.
- `src/core/types/spec-context.schema.json` — `profile` enum `["standard", "lean"]` → `["standard", "turbo"]`.
- `src/features/specs/profileDispatch.ts` — `LEAN_COMMAND_BY_STOCK` → `TURBO_COMMAND_BY_STOCK`, all `'lean'` comparisons → `'turbo'`, `seedProfileForNewSpec` return type, comments.
- `src/features/settings/companionPresetReconciler.ts` — `TemplateProfile = 'standard' | 'turbo' | 'off'`; `companion-turbo` becomes the trimmed-preset id; `companion-lean` joins `sdd-lean` as a legacy id to remove; `ALL_PRESET_IDS`, `VALID_PROFILES`, comments.
- `src/features/specs/specCommands.ts`, `src/features/spec-editor/specEditorProvider.ts` — comment-only updates (`lean` → `turbo`).
- `package.json` — `speckit.companion.templateProfile` enum value `lean` → `turbo` + setting description; sweep `contributes` for any other "lean" wording.

### 2. VS Code extension — tests

- `src/features/specs/profileDispatch.test.ts`, `src/features/settings/companionPresetReconciler.test.ts`, `src/features/specs/__tests__/specContextWriter.test.ts` — rename values and test names; keep the leftover-`companion-lean`-removal cases (now exercising the legacy path).

### 3. spec-kit extension (`speckit-extension/`)

- `git mv speckit-extension/presets/companion-lean speckit-extension/presets/companion-turbo`; update `preset.yml` (id, name "Companion Turbo", descriptions, `tags: lean` → `turbo`) and the preset `README.md` + the seven `commands/speckit.*.md` bodies' wording.
- `extension.yml` — the four `/speckit.companion.*` command descriptions ("Companion lean X" → "Companion turbo X"); bump `extension.version`.
- `commands/speckit.companion.{specify,plan,tasks,implement}.md` — frontmatter/wording only; command names untouched (FR-008).
- `scripts/check-shape-parity.py` — parity paths `presets/companion-lean/` → `presets/companion-turbo/`; rerun to confirm SC-002.
- `scripts/write-context.py`, `tests/test_context.py` — comment-only ("lean/companion bold form" → "turbo/companion").
- `speckit-extension/README.md`, `CHANGELOG.md` (reword unreleased "lean" entries per FR-006 + add the rename entry), `ROADMAP.md`, `docs/install.md`, `docs/contributing.md`.

### 4. Root docs (VS Code extension side)

- `README.md` — templateProfile setting section, per-spec profile wording.
- `CHANGELOG.md` — reword unreleased "lean" entries; add the rename entry.
- `CLAUDE.md` — the template-profiles doc-map paragraph (`companion-lean` → `companion-turbo`).
- `docs/template-profiles.md` (the living profile reference — heaviest file, 21 hits) and `docs/capture-and-timing.md`.

### 5. Dev workspace + examples

- `.specify/companion.yml` — `templateProfile: lean` → `turbo`.
- `.claude/pr-profile.md`, `.claude/commands/bench-prep.md`, `.claude/commands/bench-finish.md` — mode vocabulary `lean` → `turbo`.
- `examples/todo-claude/` — `README.md`, `CLAUDE.md`, `bench/README.md`, `bench/prompts/{medium,hard}.md`, `src/pages/AboutPage.tsx`, `vitest.config.ts` ("lean-vs-standard" → "turbo-vs-standard", `companion-lean` → `companion-turbo`); leave generated `bench/REPORT.md` / `bench/stats.jsonl`.
- `specs/135-rename-lean-to-turbo/.spec-context.json` — `profile` → `turbo` (last, alongside the schema flip).

### 6. Verification

- `npm test`; `python3 speckit-extension/scripts/check-shape-parity.py`.
- SC-001 sweep: `grep -riE '\blean\b|companion-lean'` over `src/ webview/ package.json speckit-extension/ docs/ README.md CHANGELOG.md CLAUDE.md examples/ .claude/commands .claude/pr-profile.md .specify/companion.yml` → zero profile-referring matches.
- Local install (`/install-local`) refreshes the generated `.specify/extensions/companion/**` and `.claude/skills` copies; then `git restore specs/_0*` demo fixtures.

## Constitution Check

Pass. No new configuration surface (one enum value renamed in an existing setting), no workflow change, no UI structure change, no new modules — Principles I–IV unaffected. No complexity to justify.

## Out of Scope

- Any behavior change to what the trimmed pipeline produces (rename only).
- Alias, fallback, or migration for the old `lean` value (never released — FR-007).
- Renaming `/speckit.companion.*` commands (FR-008).
- Historical artifacts: git history, past spec directories (`specs/132-sdd-lean-pipeline` etc.), generated bench results, released changelog sections.
- Users' locally installed copies of the old preset (user-local, outside the product).
