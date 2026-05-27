# Implementation Plan: Round-3 State Followup

**Branch**: `fix/round-3-state-cleanup-v2` | **Date**: 2026-05-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/113-round3-state-followup/spec.md`

## Summary

Three targeted fixes: (F16) stepper visual lag — extend `refreshContextIfDisplaying` to include `navState` in the `viewerStateUpdated` message so the stepper re-derives on filesystem-watcher updates without a full HTML re-render; (F11) Copilot step-completion drop — strengthen `promptBuilder.ts` with a prominent boxed closure checklist at the preamble tail; (Tokens) preamble token cost — consolidate duplicated `by`-field + timestamps prose to ≤ 4 000 characters.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview)
**Storage**: File-based (`.spec-context.json` per spec directory)
**Testing**: Jest + ts-jest, BDD style
**Target Platform**: VS Code extension (Node.js + browser webview context)
**Project Type**: Single VS Code extension
**Performance Goals**: Stepper badge update within filesystem-watcher cycle (~200 ms); preamble ≤ 4 000 characters
**Constraints**: Markdown re-render must NOT be triggered by context-only updates (no flicker); preamble refactor must not remove any currently-enforced AI invariant
**Scale/Scope**: 3 focused bug fixes across 4 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility | ✅ PASS | All changes are backward-compatible; no new provider config needed |
| II. Spec-Driven Workflow | ✅ PASS | Directly strengthens the lifecycle pipeline's reliability |
| III. Visual and Interactive | ✅ PASS | F16 is a pure visual fix; stepper badge is core lifecycle UI |
| IV. Modular Architecture | ✅ PASS | Changes go in existing modules; no new modules needed |

**Post-Phase-1 re-check**: No violations introduced. The `viewerStateUpdated` message extension is additive (optional `navState` field). The preamble refactor reduces size without structural changes to the render pipeline.

## Project Structure

### Documentation (this feature)

```text
specs/113-round3-state-followup/
├── plan.md              # This file
├── research.md          # Phase 0 — root cause analysis for F16, F11, tokens
├── data-model.md        # Phase 1 — NavState, HistoryEntry, message type shapes
├── quickstart.md        # Phase 1 — file map, test strategy
└── tasks.md             # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── features/
│   └── spec-viewer/
│       └── specViewerProvider.ts   # F16: extend refreshContextIfDisplaying
└── ai-providers/
    └── promptBuilder.ts            # F11 + tokens: preamble refactor

webview/src/spec-viewer/
├── types.ts                        # F16: extend viewerStateUpdated message type
└── index.tsx                       # F16: merge navState in viewerStateUpdated handler
```

## Implementation Phases

### Phase A — F16: Stepper Visual Lag Fix

**Files**: `specViewerProvider.ts`, `webview/src/spec-viewer/types.ts`, `webview/src/spec-viewer/index.tsx`

**Change**: Extend `refreshContextIfDisplaying` to compute a `navState` partial (containing `stepHistory`, `currentStep`, `badgeText`) and include it in the `viewerStateUpdated` message. Update the webview handler to merge `navState` when present.

```ts
// specViewerProvider.ts — refreshContextIfDisplaying (addition)
const navStatePartial = {
  stepHistory: mapStepHistoryKeys(derivedStepHistory),
  currentStep: specCtx.currentStep,
  badgeText: derived.badgeText,
};
instance.panel.webview.postMessage({
  type: 'viewerStateUpdated',
  viewerState,
  navState: navStatePartial,      // ← new
});

// webview/src/spec-viewer/types.ts
| { type: 'viewerStateUpdated'; viewerState: ViewerState; navState?: Partial<NavState> }

// webview/src/spec-viewer/index.tsx — viewerStateUpdated handler
case 'viewerStateUpdated':
    viewerState.value = message.viewerState;
    historyEntries.value = message.viewerState.history ?? [];
    if (message.navState) {
        navState.value = { ...navState.value, ...message.navState };
    }
    break;
```

### Phase B — F11 + Token Cost: Preamble Refactor

**File**: `src/ai-providers/promptBuilder.ts`

**Changes**:
1. **Strengthen "MUST DO BEFORE ENDING"**: replace inline prose with a boxed checklist using Unicode box-drawing chars (visually prominent, hard to miss)
2. **Remove `AUTHORSHIP` prose block** from `renderSharedRules`; replace with 1-line pointer to schema `"by"` property
3. **Compress TIMESTAMPS block**: keep `date -u` instruction, remove ~200-char elaboration (already implied)
4. Verify assembled preamble for `specify` step is ≤ 4 000 chars after changes

### Phase C — Lifecycle Validation

Manual test: run full Specify → Plan → Tasks → Implement lifecycle in Copilot Chat on any spec. Verify:
- All four steps have `kind: "complete"` entries with real timestamps
- Stepper badges flip immediately after AI writes `complete` entry (no extra click needed)
- `status` ends at `"implemented"` after implement
- Assembled preamble ≤ 4 000 characters

## Complexity Tracking

No constitution violations. No complexity debt.


## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
