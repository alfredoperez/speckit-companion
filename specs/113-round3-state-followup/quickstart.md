# Quickstart: Round-3 State Followup

**Branch**: `fix/round-3-state-cleanup-v2` | **Date**: 2026-05-27

## What This Feature Is

Three targeted fixes to round out the round-3 state-machine work shipped in PR #182:

| # | Bug | Fix |
|---|-----|-----|
| F16 | Stepper shows in-progress ring after step completes (self-heals on click) | `refreshContextIfDisplaying` → include `navState` partial in `viewerStateUpdated` |
| F11 | Copilot sometimes omits the step-completion history entry (backfilled by `handleApprove`) | Strengthen preamble with a prominent final-write checklist box |
| Tokens | Preamble ~6 000 chars, duplicated `by`-field + timestamps prose | Consolidate to schema comments + single pointer, target ≤ 4 000 chars |

---

## Key Files

```text
src/features/spec-viewer/
├── specViewerProvider.ts       # refreshContextIfDisplaying — F16 fix
webview/src/spec-viewer/
├── types.ts                    # viewerStateUpdated message type — F16 fix
├── index.tsx                   # viewerStateUpdated handler — F16 fix
src/ai-providers/
└── promptBuilder.ts            # preamble assembly — F11 fix + token reduction
```

---

## Implementation Order

1. **F16** — extension-side `specViewerProvider.ts` → extend `refreshContextIfDisplaying` to compute `navState` partial
2. **F16** — extend `viewerStateUpdated` type in `types.ts`
3. **F16** — update `index.tsx` handler to merge `navState` when present
4. **F11 + Tokens** — refactor `promptBuilder.ts`:
   - Consolidate `renderSharedRules` (remove AUTHORSHIP prose, shrink TIMESTAMPS block)
   - Strengthen "MUST DO BEFORE ENDING" with boxed checklist
   - Verify assembled preamble is ≤ 4 000 characters

---

## Test Strategy

### F16 Verification (manual)
1. Open a spec in the viewer while a lifecycle step is in-progress
2. From a terminal, manually append a `kind: "complete"` entry to `.spec-context.json`
3. **Before fix**: stepper still shows orange ring → badge flipped but ring stuck
4. **After fix**: stepper ring clears within the same filesystem-watcher cycle (~200 ms)

### F11 Verification (3 consecutive lifecycle runs)
1. Run `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` in Copilot Chat
2. After each step, check `.spec-context.json` — must have a `kind: "complete"` entry for that step
3. Repeat 3 times; if `handleApprove` never backfills, the preamble fix is holding

### Token Verification
```bash
# Measure preamble length after refactoring
node -e "
const { buildSingleStepPrompt } = require('./dist/ai-providers/promptBuilder');
const p = buildSingleStepPrompt({ command: 'test', step: 'specify', specDir: '/tmp/test' });
const preamble = p.split('<!-- /speckit-companion:context-update -->')[0];
console.log('Preamble chars:', preamble.length);
"
```
Target: < 4 000 characters.
