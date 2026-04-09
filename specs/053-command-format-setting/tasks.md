# Tasks: Command Format Setting

**Date**: 2026-04-09

## Phase 1 — Core Implementation

### T001: Register `speckit.commandFormat` setting in `package.json` ✅

- **File**: `package.json`
- Add `speckit.commandFormat` to `contributes.configuration.properties`
- Enum: `auto`, `dot`, `dash` (default: `auto`)
- Include `enumDescriptions` explaining each option
- Set `scope: "machine"`, `order: 3`

**Checkpoint**: `npm run compile` passes; setting visible in VS Code settings UI

---

### T002: Update `formatCommandForProvider()` to respect user setting ✅

- **File**: `src/ai-providers/aiProvider.ts`
- Read `speckit.commandFormat` from `vscode.workspace.getConfiguration('speckit')`
- If `dash` → always return dash notation
- If `dot` → always return dot notation (canonical format)
- If `auto` → fall through to existing `PROVIDER_PATHS.commandFormat` logic

**Checkpoint**: `npm run compile` passes

---

## Phase 2 — Verification

### T003: Unit tests for `formatCommandForProvider()` — `test-expert` ✅

[P][A]

- **File**: `src/ai-providers/__tests__/formatCommandForProvider.test.ts`
- Test `dash` override with dot-default provider (Gemini) → returns dash
- Test `dot` override with dash-default provider (Claude) → returns dot
- Test `auto` preserves per-provider behavior for all 5 providers

**Checkpoint**: `npm test` passes

---

### T004: Update README documentation — `docs-expert` ✅

[P][A]

- **File**: `README.md`
- Add `speckit.commandFormat` to the configuration settings table/section
- Brief description of when users would need to override

**Checkpoint**: README reflects the new setting
