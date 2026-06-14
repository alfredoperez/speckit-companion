# Research: One Beta Gate for the SpecKit Companion Workflow

**Spec**: [spec.md](./spec.md) · **Branch**: `170-single-beta-gate` · **Date**: 2026-06-14

This change is fully grounded in the existing codebase — no new technologies. Research focused on locating the two gates being collapsed, the migration/coercion patterns already proven for beta settings, and the seams to gate the Create-Spec picker.

## Decision 1 — Setting key for the single beta gate

**Decision**: Add `speckit.companion.workflowBeta` (boolean, default `false`) under the **Beta Features** configuration group. Remove `speckit.companion.resumeBeta`.

**Rationale**: The `companion.*` prefix already groups the companion surfaces (`companion.installPrompt`, the removed `companion.resumeBeta`). `workflowBeta` reads as "the whole Companion *workflow*, in beta", matching the spec's framing of one gate over picker + resume. Default off satisfies FR-001 ("defaults to off") and the "stock SpecKit only" assumption.

**Alternatives considered**:
- `companion.enabled` — too absolute; the install prompt and viewer activity panel are separate companion surfaces with their own gates, so "enabled" would over-claim.
- Reusing `companion.resumeBeta` as the umbrella key — rejected: the label and meaning change (it now also gates the picker), and FR-003 explicitly requires removing the old key so exactly one setting governs the workflow.

## Decision 2 — Migration: move the old opt-in, never crash activation

**Decision**: On activation, copy any "on"-style value of the old `companion.resumeBeta` into the new `companion.workflowBeta` at the same scope, then drop `companion.resumeBeta` at every scope. Reuse the existing `coerceLegacyBoolean` + per-scope `inspect()` pattern in `src/core/settingsMigration.ts`. Wrap the call in the same try/catch that already guards `migrateBetaTriStateSettings()` so a bad value logs and is skipped rather than failing `activate()`.

**Rationale**: FR-004/FR-005 and SC-002/SC-006 require that a prior opt-in carries over and that *no* stored value (including legacy `"on"`/`"beta"` strings or unexpected garbage) blocks startup. The repo already solved this exact shape for the #259 tri-state collapse — `coerceLegacyBoolean(value, fallback)` returns `true` for `true`/`"on"`/`"beta"`, `false` for `"off"`, and the caller's fallback for anything else. The provider-rename lesson (a persisted unexpected value crashing activation) is precisely what the catch + defensive coercion prevent.

**Mechanism**: A new `migrateResumeBetaToWorkflowBeta()` that, per scope, reads `companion.resumeBeta`; if `coerceLegacyBoolean(value, false)` is `true`, writes `companion.workflowBeta = true` at that scope (only when the new key isn't already explicitly set there, so re-runs are no-ops); then deletes `companion.resumeBeta` at that scope. A `false`/unset/unknown old value migrates to "off" (the default) — FR-004 / scenario 3.

**Alternatives considered**:
- Add `companion.resumeBeta` to `RETIRED_SETTINGS` (drop-only) — rejected: that discards the user's opt-in instead of carrying it over (violates FR-004/SC-006).
- A VS Code `configurationDefaults` / `deprecated` mapping — rejected: VS Code's setting deprecation doesn't transfer a *value* across a key rename; we need an explicit copy.

## Decision 3 — Gate the Create-Spec picker on (beta ON AND companion installed)

**Decision**: In `buildWorkflows()` (`src/features/workflows/workflowManager.ts`), include the built-in `COMPANION_WORKFLOW` in the **selection** list only when `companion.workflowBeta` is on AND `isCompanionInstalled(root)` is true. Apply this only on the `filterByProvider === true` path (`getWorkflows()` — the picker/spec-editor surface). The unfiltered `getAllWorkflows()` (used by `getWorkflow()` to *resolve* an already-chosen workflow) must continue to always include `COMPANION_WORKFLOW` so an existing Companion spec keeps its real steps.

**Rationale**: Today `buildWorkflows()` unconditionally seeds `[DEFAULT_WORKFLOW, COMPANION_WORKFLOW]`, so the spec-editor picker always shows two entries — the "dishonest surface" (US2) where choosing Companion silently falls back to stock. Gating only the selection list removes the hollow option (FR-006, FR-009, SC-004) while preserving step resolution for existing specs (the same reason `filterByProvider` already exists). The picker still appears for legitimate **custom** workflows even when Companion is gated out — that's the custom-workflow feature, out of scope here.

The webview already shows the picker only when `workflows.length > 1` (`initWorkflows` in `webview/src/spec-editor/index.ts`), so removing Companion from the list collapses the picker automatically with no webview change — except the default-workflow preselect, which is already conditioned on the list (FR-007).

**Edge case (spec)**: install/uninstall while Create Spec is open — `getWorkflows()` reads live config + on-disk presence each time the panel sends `ready`, so the picker reflects current state on next open. `isCompanionInstalled` is a synchronous disk check; no caching to invalidate.

**Alternatives considered**:
- Gate in the webview (`initWorkflows`) — rejected: the extension is the trust boundary; the webview shouldn't decide whether a workflow is offerable, and the data already flows from `getWorkflows()`.
- Gate by removing Companion from `getAllWorkflows()` too — rejected: breaks step resolution for already-created Companion specs (the explicit reason the filtered/unfiltered split exists).

## Decision 4 — Resume enablement reads the new gate

**Decision**: Point the existing `speckit.resumeBeta` *context key* (which drives the sidebar resume `▶` menu `when` clause) at the new `companion.workflowBeta` setting. Keep the context-key name `speckit.resumeBeta` unchanged. Update the two read sites in `src/extension.ts` (activation + `onDidChangeConfiguration`) and `ConfigKeys.resumeBeta` in `src/core/constants.ts` to the new setting key.

**Rationale**: FR-008 — resume is enabled by the single beta setting, not the removed one. The context key is an internal menu gate; renaming it would churn the `package.json` `when` clause for no user-visible benefit. Repointing its source is the minimal correct change. The companion-installed requirement for resume is already enforced downstream by `resolveDispatchForRoot` (suppresses unresolvable companion commands), so the resume button being visible without the extension still degrades safely — consistent with current behavior.

**Alternatives considered**:
- Also AND the resume context key with `companionInstalled` — rejected as scope creep; the spec ties resume to the beta setting (FR-008), and dispatch already falls back safely. Left as a noted non-goal.

## Decision 5 — Telemetry field

**Decision**: In `src/core/telemetry.ts`, rename the `BetaSnapshot.resumeBeta` field to `workflowBeta` and read it from `companion.workflowBeta` (via `coerceLegacyBoolean` for un-migrated scopes). Update the corresponding test.

**Rationale**: The activated-event snapshot reports the on/off state of beta flags (privacy contract unchanged — still a boolean). The field should name the surviving setting.

## Decision 6 — Documentation

**Decision**: Update `README.md` (Configuration → Beta Features) and the long-form docs that mention the resume toggle / picker gating: `docs/sidebar.md` (resume button), `docs/how-it-works.md`, `docs/template-profiles.md`, `docs/capture-and-timing.md` where they reference the old setting. Add a `CHANGELOG.md` entry (user-facing voice: one setting now turns on the Companion workflow; old resume toggle removed and your opt-in carries over).

**Rationale**: FR-010 plus the repo's "docs are part of the change" rule. This is the **VS Code extension** (root README/CHANGELOG, `v*` tag) — no `speckit-extension/` docs are touched (the change is entirely in `src/` + root config).

## Open questions

None. All NEEDS CLARIFICATION resolved; the spec's assumptions hold against the code.
