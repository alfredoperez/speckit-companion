# Plan: Command Format Setting

**Spec**: 053-command-format-setting | **Date**: 2026-04-09

## Approach

Add a `speckit.commandFormat` setting (`auto` | `dot` | `dash`) to `package.json` and update `formatCommandForProvider()` to check the user setting before falling back to the provider default. Minimal change — one new setting, one function update, tests.

## Files to Modify

| File | Change |
|---|---|
| `package.json` | Add `speckit.commandFormat` setting with enum `auto`, `dot`, `dash` (default `auto`) |
| `src/ai-providers/aiProvider.ts` | Update `formatCommandForProvider()` to read user setting first; only use `PROVIDER_PATHS.commandFormat` when `auto` |

## Files to Create

| File | Purpose |
|---|---|
| `src/ai-providers/__tests__/formatCommandForProvider.test.ts` | Tests for all three modes: `auto`, `dot`, `dash` across providers |

## Implementation Details

### 1. Register Setting in `package.json`

Add to `contributes.configuration.properties`:

```json
"speckit.commandFormat": {
  "type": "string",
  "default": "auto",
  "enum": ["auto", "dot", "dash"],
  "enumDescriptions": [
    "Use provider default (Claude/Codex → dash, Gemini/Copilot/Qwen → dot)",
    "Always use dot notation (speckit.plan)",
    "Always use dash notation (speckit-plan)"
  ],
  "scope": "machine",
  "order": 3,
  "description": "Command format for speckit commands sent to AI CLI tools. Use 'auto' to let the provider decide, or override to 'dot' (speckit.plan) or 'dash' (speckit-plan) if your speckit version requires a specific format."
}
```

### 2. Update `formatCommandForProvider()`

In `src/ai-providers/aiProvider.ts`, read `speckit.commandFormat` from VS Code config at the top of the function. If `dot` or `dash`, use that directly. If `auto`, fall through to existing `PROVIDER_PATHS` logic.

```typescript
export function formatCommandForProvider(command: string, providerType?: AIProviderType): string {
    const config = vscode.workspace.getConfiguration('speckit');
    const userFormat = config.get<string>('commandFormat', 'auto');

    if (userFormat === 'dash') {
        return command.replace(/^speckit\./, 'speckit-');
    }
    if (userFormat === 'dot') {
        return command; // canonical format is already dot
    }

    // auto — use provider default
    const type = providerType ?? getConfiguredProviderType();
    const { commandFormat } = PROVIDER_PATHS[type];
    if (commandFormat === 'dash') {
        return command.replace(/^speckit\./, 'speckit-');
    }
    return command;
}
```

### 3. Tests

Cover:
- `dash` override with a dot-default provider (Gemini) → returns dash
- `dot` override with a dash-default provider (Claude) → returns dot
- `auto` preserves per-provider behavior for all 5 providers
