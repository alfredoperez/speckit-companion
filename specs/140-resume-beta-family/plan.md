# Plan: Resume button — beta-gate it, and respect the command family the spec ran

## Summary

Beta-gate the sidebar resume (▶) button behind a new opt-in `speckit.companion.resumeBeta` VS Code setting (default `false`), wired exactly like the other settings-driven menu items — a context key the menu `when` clause reads, refreshed live on config change. Make resume dispatch the right command family per step by teaching the spec-kit extension's resolver (`status-context.py`) to read the spec's `profile` pin from `.spec-context.json` (`turbo` → `/speckit.companion.<step>`, `standard`/absent → `/speckit.<step>`). Finally, rewrite the four Beta Features setting titles/descriptions to be concise (effect before mechanism) without renaming any keys or enum values.

## Technical Context

- **Language/version**: TypeScript 5.3+ (ES2022, strict) for the VS Code extension; Python 3 for the spec-kit extension resolver.
- **Primary dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); no new deps.
- **Storage**: file-based — `.spec-context.json` per spec dir (already carries `profile`); VS Code settings for the gate.
- **Testing**: Jest (`ts-jest`) for extension-side; the spec-kit resolver is covered by `check_capture.py`-style evals (resolver change is pure-function and unit-testable in-process).
- **Target platform**: VS Code (both extensions installed locally via `/install-local`).
- **Constraints**: extension isolation — the gate is a pure VS Code concern (setting + `when` + context key), it does NOT mirror into `.specify/companion.yml` (unlike `complexityFastPath`). Family selection lives in `status-context.py`, NOT in the sidebar dispatch; the sidebar keeps calling `/speckit.companion.resume`. No setting-key or enum-value renames (copy-only on existing settings).

## Approach & Structure

Order of attack, grouped by file:

1. **`src/core/constants.ts`** — add `resumeBeta: 'speckit.companion.resumeBeta'` to `ConfigKeys` (next to `complexityFastPath`).

2. **`src/core/utils/contextKeys.ts`** — add `resumeBeta: 'speckit.resumeBeta'` to `CONTEXT_KEYS` (the menu `when` reads this short key, not the dotted config key). Add it to the activation reset list in `resetAllContextKeys` (default `false`).

3. **`package.json`**:
   - Add the `speckit.companion.resumeBeta` boolean property (default `false`, `scope: window`) under the **Beta Features** group.
   - Gate both visible resume menu entries — the inline action and the `7_modification` context entry (the two `when: "... viewItem == spec-active || viewItem == spec-tasks-done"` clauses near lines 515) — by appending `&& speckit.resumeBeta`. Eligibility conditions (`spec-active`/`spec-tasks-done`) stay; the `when: false` palette-hide entry is untouched.
   - Rewrite `title`/`description`/`enumDescriptions` for all four Beta settings (`speckit.viewer.activityPanel`, `speckit.companion.templateProfile`, `speckit.companion.complexityFastPath`, new `resumeBeta`): lead with the observable effect, ~2 lines max, keep the "(opt-in beta)"/default signal. Keys and enum values unchanged.

4. **`src/extension.ts`**:
   - On activation, read `companion.resumeBeta` and `setContextKey(CONTEXT_KEYS.resumeBeta, enabled)` (alongside the existing `templateProfile`/`complexityFastPath` activation block).
   - In the `onDidChangeConfiguration` handler, add an `if (e.affectsConfiguration(ConfigKeys.resumeBeta))` branch that re-reads the setting and re-sets the context key — no reload (FR-003). No `.specify/companion.yml` write for this one.

5. **`speckit-extension/scripts/status-context.py`** (source of truth; the `.specify/extensions/companion/scripts/` copy is the gitignored install):
   - Add `COMPANION_STEP_COMMAND = {"specify": "/speckit.companion.specify", "plan": "/speckit.companion.plan", "tasks": "/speckit.companion.tasks", "implement": "/speckit.companion.implement"}` mirroring the four `STEP_COMMAND` keys.
   - Add a helper `_step_command(step, profile)` returning the companion map when `profile == "turbo"` else `STEP_COMMAND`, both via `.get(step)`.
   - Read `profile = ctx.get("profile")` in `resolve()` and replace every `STEP_COMMAND.get(...)` / hard-coded `"/speckit.implement"` assignment in the resolution paths (implement-continue ~171, advance ~181, fall-through finish/advance ~192/196) with `_step_command(step, profile)`. Covers plan, tasks, implement, finish-current, and the clarify/analyze fall-throughs (FR-006). Derived path (no ctx) has no `profile` → stock, preserving the no-regression guarantee (FR-005/FR-007).

6. **Docs** (each under its own extension):
   - Root **`README.md`** beta-features section — document `resumeBeta` and the gated resume button.
   - Root **`CHANGELOG.md`** — the gate/setting (user-facing voice).
   - **`speckit-extension/README.md`** + **`speckit-extension/CHANGELOG.md`** — the command-family-aware resume resolution (the `status-context.py` change).
   - `docs/sidebar.md` — note the resume button is now beta-gated (the sidebar reference lists the resume action).

### Decisions

- **Two context keys vs. config key in `when`**: VS Code `when` clauses can't read arbitrary config; gating goes through a context key we set from the setting (same pattern as the rest of the sidebar's settings-driven menus). The short key `speckit.resumeBeta` lives in `CONTEXT_KEYS`; the dotted `speckit.companion.resumeBeta` is the setting id in `ConfigKeys`.
- **No `companion.yml` mirror**: unlike `complexityFastPath` (read by a command body at runtime), the gate is consumed only by the VS Code menu layer, so it stays purely in VS Code settings (per spec Assumption).
- **Family from `profile`, not history**: `.spec-context.json` already pins `profile` at spec creation; the resolver reads it directly — no history inference.

## Out of Scope

- No new resume *behavior* (eligibility rules, terminal-state handling, next-unchecked-task logic) — only which command family the existing resolution emits.
- No mirroring the gate into `.specify/companion.yml` or any spec-kit config.
- No setting-key or enum-value renames; copy-only on the existing three Beta settings.
- No change to the sidebar dispatch string (`/speckit.companion.resume` stays); family selection is entirely resolver-side.
- No migration of existing specs — absent `profile` is treated as stock by construction.

## Constitution Check

No `.specify/memory/constitution.md` present — no gates to evaluate.
