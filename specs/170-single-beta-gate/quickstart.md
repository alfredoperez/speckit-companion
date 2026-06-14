# Quickstart: One Beta Gate for the SpecKit Companion Workflow

**Spec**: [spec.md](./spec.md) · **Date**: 2026-06-14

How to build, verify, and manually validate this change.

## Build

```bash
npm install
npm run compile      # tsc
npm test             # jest — settingsMigration + telemetry suites cover the migration
npm run package      # produce the .vsix
```

## Try it in the Extension Development Host

Press **F5** in VS Code to launch the dev host, open a workspace, then:

### Scenario A — single switch, companion installed (US1)
1. Ensure `.specify/extensions/companion/` exists in the workspace (install the spec-kit extension).
2. Settings → search **"Companion workflow (beta)"** → turn `speckit.companion.workflowBeta` **on**.
3. Open **Create Spec** → the SpecKit / SpecKit Companion picker appears, preselected to your `defaultWorkflow`.
4. On a sidebar spec → the resume `▶` button is available.
5. Turn the setting **off** → picker disappears, resume `▶` gone, stock SpecKit only.

### Scenario B — no hollow option, companion missing (US2)
1. Remove `.specify/extensions/companion/` (uninstall the spec-kit extension).
2. Turn `speckit.companion.workflowBeta` **on**.
3. Open **Create Spec** → **no** workflow picker; new specs run stock SpecKit.
4. The install prompt / banner for the companion piece is still reachable.

### Scenario C — migration carries the opt-in (US3)
1. In `settings.json`, seed the OLD key (one per run): `"speckit.companion.resumeBeta": true`, then `"on"`, then `"beta"`, then `false`, then a garbage value like `"xyz"`.
2. Reload the window (re-activate).
3. After activation: `companion.resumeBeta` is gone; `companion.workflowBeta` is `true` for the on-style values, absent/off for `false`/garbage. The extension activates cleanly every time (no error notification).

## Automated test coverage

- `src/core/settingsMigration.test.ts` — extend with the resume→workflow migration: each historical value maps correctly, scope is preserved, re-run is a no-op, and an unexpected value neither migrates-on nor throws.
- `src/core/__tests__/telemetry.test.ts` — update the snapshot field to `workflowBeta`.
- Picker gating (`getWorkflows` includes Companion only when beta+installed) and the resume context-key wiring are config/disk-dependent — see the known coverage gap in CLAUDE.md (Testing); validate via Scenarios A/B manually.

## Done when

- `speckit.companion.resumeBeta` no longer appears in VS Code settings; `speckit.companion.workflowBeta` does (SC-001).
- All three user-story scenarios above behave as listed.
- README + affected `docs/*.md` + `CHANGELOG.md` updated (FR-010).
