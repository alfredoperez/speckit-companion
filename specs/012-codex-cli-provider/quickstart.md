# Quickstart: Codex CLI Provider

**Feature**: 012-codex-cli-provider
**Date**: 2026-01-25

## Implementation Steps

### Step 1: Update AIProviderType and PROVIDER_PATHS

**File**: `src/ai-providers/aiProvider.ts`

1. Add `'codex'` to the `AIProviderType` union (line 53)
2. Add codex entry to `PROVIDER_PATHS` record (after copilot entry)
3. Add codex option to `promptForProviderSelection()` QuickPick items

### Step 2: Create CodexCliProvider Class

**File**: `src/ai-providers/codexCliProvider.ts` (new file)

Create provider class implementing `IAIProvider` interface:

```typescript
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ConfigManager } from "../core/utils/configManager";
import { ConfigKeys, Timing } from "../core/constants";
import { IAIProvider, AIExecutionResult } from "./aiProvider";

const execAsync = promisify(exec);

export class CodexCliProvider implements IAIProvider {
  public readonly name = "Codex CLI";
  // ... implementation following ClaudeCodeProvider pattern
}
```

Key differences from Claude Code:

- No permission management (Codex handles auth separately)
- Use `codex exec --yolo` instead of `claude --permission-mode bypassPermissions`
- Wrap slash commands as prompts

### Step 3: Update AIProviderFactory

**File**: `src/ai-providers/aiProviderFactory.ts`

1. Import `CodexCliProvider`
2. Add case for `'codex'` in switch statement
3. Add entry to `getSupportedProviders()` array

### Step 4: Update Module Exports

**File**: `src/ai-providers/index.ts`

Add export for new provider:

```typescript
export { CodexCliProvider } from "./codexCliProvider";
```

### Step 5: Update package.json Configuration

**File**: `package.json`

Add `'codex'` to the aiProvider enum and description:

```json
"speckit.aiProvider": {
    "enum": ["claude", "gemini", "copilot", "codex"],
    "enumDescriptions": [
        "Claude Code - Full feature support (steering, agents, hooks, MCP)",
        "Gemini CLI - Steering and MCP support",
        "GitHub Copilot CLI - Steering, agents, and MCP (no hooks)",
        "Codex CLI - Steering, skills, and MCP support"
    ]
}
```

## Testing Checklist

- [ ] Run `npm run compile` - verify no TypeScript errors
- [ ] Press F5 to launch Extension Development Host
- [ ] Clear existing provider setting (if any)
- [ ] Verify Codex CLI appears in provider selection QuickPick
- [ ] Select Codex CLI and verify setting persists
- [ ] Trigger a prompt action and verify terminal opens with correct command
- [ ] Verify steering tree view shows AGENTS.md file
- [ ] Verify skills tree view shows `.codex/skills` directory
- [ ] Test with Codex CLI not installed - verify helpful error message

## Files Modified Summary

| File                                    | Change Type | Description                       |
| --------------------------------------- | ----------- | --------------------------------- |
| `src/ai-providers/aiProvider.ts`        | Modify      | Add type, paths, QuickPick option |
| `src/ai-providers/codexCliProvider.ts`  | New         | Provider implementation           |
| `src/ai-providers/aiProviderFactory.ts` | Modify      | Add factory case                  |
| `src/ai-providers/index.ts`             | Modify      | Add export                        |
| `package.json`                          | Modify      | Add enum value                    |

## Rollback Plan

If issues arise:

1. Remove `'codex'` from `AIProviderType` union
2. Remove codex entry from `PROVIDER_PATHS`
3. Delete `codexCliProvider.ts`
4. Remove factory case and export
5. Remove enum value from `package.json`

All changes are additive and do not affect existing providers.
