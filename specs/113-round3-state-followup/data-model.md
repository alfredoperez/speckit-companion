# Data Model: Round-3 State Followup

**Branch**: `fix/round-3-state-cleanup-v2` | **Date**: 2026-05-27

---

## Key Entities

### `NavState` (webview signal — `webview/src/spec-viewer/signals.ts` + `types.ts`)

Per-document navigation state sent from the extension to the webview via `contentUpdated`.

```ts
interface NavState {
  // … existing fields …
  stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
  currentStep?: string;
  badgeText?: string;
  specContextName?: string;
  // … etc.
}
```

**F16 relevance**: `stepHistory` is the source of truth for the stepper's per-tab badge state (not-started / in-progress / completed). It is currently only updated via `contentUpdated` messages; the lighter `viewerStateUpdated` path skips it, causing visual lag.

---

### `ExtensionToViewerMessage` — `viewerStateUpdated` shape

Current shape:
```ts
{ type: 'viewerStateUpdated'; viewerState: ViewerState }
```

**Proposed extension (Option A from research):**
```ts
{ type: 'viewerStateUpdated'; viewerState: ViewerState; navState?: Partial<NavState> }
```

The optional `navState` field carries only the fields that need to be refreshed after a context-only update: `stepHistory`, `currentStep`, `badgeText`. The webview handler merges these into the existing `navState.value` signal.

**File**: `webview/src/spec-viewer/types.ts`

---

### `ViewerState` (extension-side → webview)

Derived by `deriveViewerState()` in the extension from `.spec-context.json`. Contains footer button state, review comments, history log, and step-level context. 

**F16 relevance**: `refreshContextIfDisplaying` already derives a fresh `ViewerState`; it just needs to also compute and include the matching `NavState` partial.

**File**: `src/features/spec-viewer/specViewerProvider.ts` → `refreshContextIfDisplaying()`

---

### `SpecContext` (`.spec-context.json` file shape)

```ts
interface SpecContext {
  workflow: 'speckit' | 'sdd';
  specName: string;
  branch?: string;
  selectedAt?: string;
  currentStep: StepName;
  status: Status;
  history: HistoryEntry[];
  // No stepHistory, no transitions (deprecated)
}
```

**File**: `src/core/types/specContext.ts`

---

### `HistoryEntry`

```ts
interface HistoryEntry {
  step: StepName;
  substep: string | null;
  kind: 'start' | 'complete';
  from?: { step: string | null; substep: string | null };
  by: 'extension' | 'sdd-skill' | 'user' | 'ai';
  at: string;  // ISO-8601 UTC, produced by `date -u`
}
```

**Invariants**:
- `history` is append-only
- Last entry's `step` must equal `currentStep`
- `by: "extension"` for extension-dispatched entries; `by: "ai"` for AI-appended entries
- `at` is a real wall-clock from `date -u`, never midnight or hand-typed

---

### `PromptBuilder` (preamble assembly — `src/ai-providers/promptBuilder.ts`)

Three render paths:
1. `renderPreamble(step, specDir)` — single-step dispatch (specify, plan, tasks, implement)
2. `renderLifecyclePreamble(specDir)` — multi-step lifecycle dispatch
3. `renderSpecifyCreationLifecyclePreamble(specDir)` — spec-editor "Create" flow (includes SEED WRITE block)

**F11 / token-cost relevance**: The "MUST DO BEFORE ENDING" block is in `renderPreamble` at lines 166–177. The `renderSharedRules` function at lines 88–114 contains the duplicated `AUTHORSHIP` + `TIMESTAMPS` prose (~500 chars of duplication across the three render paths).

---

## State Transitions Affected

### F16: Stepper Badge State Machine

```
.spec-context.json written with kind:"complete"
    │
    ├─ Before fix:
    │    fileWatcher → refreshContextIfDisplaying → viewerStateUpdated(viewerState only)
    │    navState.stepHistory NOT updated → stepper shows stale in-progress ring
    │
    └─ After fix:
         fileWatcher → refreshContextIfDisplaying → viewerStateUpdated(viewerState + navState partial)
         webview merges navState → stepper badge updates immediately
```

### F11: Step Completion Write

```
AI finishes implement step
    │
    ├─ Before fix:
    │    AI may end turn without writing kind:"complete"
    │    handleApprove backfills on next click → timestamp is wrong
    │
    └─ After fix:
         Preamble has prominent boxed checklist near its end
         AI sees the checklist last → more likely to write complete entry before ending turn
```
