# Research: Round-3 State Followup

**Branch**: `fix/round-3-state-cleanup-v2` | **Date**: 2026-05-27 | **Phase**: 0

---

## F16: Stepper Visual Lag After Step Completion

### Decision
Fix `refreshContextIfDisplaying` to include updated `navState` in the `viewerStateUpdated` message so `navState.stepHistory` is updated without a full page refresh.

### Root Cause
When the AI writes a `kind: "complete"` entry to `.spec-context.json`, the filesystem watcher triggers `refreshContextIfDisplaying`. That method derives a new `viewerState` and posts a `viewerStateUpdated` message. The webview handler for `viewerStateUpdated` updates `viewerState.value` but **does NOT update `navState.value`**.

The stepper (`NavigationBar.tsx`) reads its step badge states from `navState.stepHistory`, not from `viewerState`. Because `refreshContextIfDisplaying` never touches `navState`, the stepper still shows the orange in-progress ring until the next event that triggers a `contentUpdated` message (any user click).

```
Filesystem watcher fires
  └─ refreshContextIfDisplaying()
       ├─ reads .spec-context.json  ✅
       ├─ derives viewerState       ✅
       ├─ posts viewerStateUpdated  ✅
       └─ navState NOT updated      ❌ ← stepper keeps stale badge
```

### Fix Approach
Two options evaluated:

**Option A — Extend `viewerStateUpdated` message to include `navState`:**
- `refreshContextIfDisplaying` also computes the updated `navState` (stepHistory) and includes it in the posted message
- The webview handler also sets `navState.value` when `navState` is present in the message
- Minimal blast radius; no change to `contentUpdated` path

**Option B — Full `updateContent` call from watcher:**
- Replace `refreshContextIfDisplaying` with a full `updateContent` call
- Causes a markdown re-render (flicker) on every `.spec-context.json` write

**Chosen: Option A** — targeted navState update avoids the markdown re-render. The `ExtensionToViewerMessage` for `viewerStateUpdated` can be extended with an optional `navState` field; the webview merges it when present.

### Files Affected
- `src/features/spec-viewer/specViewerProvider.ts` — `refreshContextIfDisplaying` builds and includes navState
- `webview/src/spec-viewer/index.tsx` — `viewerStateUpdated` handler merges `navState` if present
- `webview/src/spec-viewer/types.ts` — `ExtensionToViewerMessage` type union updated

---

## F11: Copilot Step-Completion Drop

### Decision
Strengthen the preamble's "MUST DO BEFORE ENDING" rule with a concrete closure checklist and move it to a visually prominent position so IDE Chat does not skip it under context pressure.

### Root Cause
Copilot sometimes ends its turn without writing the `kind: "complete"` history entry. The current preamble states the rule in prose, but under token pressure or when a long implement phase completes, the model appears to treat it as advisory. The backfill in `handleApprove` (writes the completion if missing) masks the issue but leaves a gap between the real completion time and the backfill timestamp.

### Fix Approach
Move the step-completion invariant into a dedicated fenced block near the **end** of the preamble (where it is read last, closest to the output), styled as a checklist:

```
╔══════════════════════════════════════════════════════════════════╗
║  MANDATORY FINAL WRITE — DO THIS BEFORE YOUR TURN ENDS          ║
║  □ Append kind:"complete" history entry (by:"ai", real date -u) ║
║  □ Set status to the completed-form of currentStep              ║
╚══════════════════════════════════════════════════════════════════╝
```

**Alternatives considered:**
- A "canary" string the extension checks for — fragile, breaks on formatting changes
- Changing `handleApprove` to error on missing completion — bad UX, correctness still depends on AI

### Files Affected
- AI provider preamble string(s) — the dispatch-time preamble block embedded in provider files or assembled at dispatch time
- Specifically: `src/ai-providers/` — search for the preamble assembly point

---

## Preamble Token Cost Reduction

### Decision
Consolidate duplicated dispatch-time and `by`-field rules into a single authoritative block. Target: ≤ 4 000 characters for the assembled preamble.

### Root Cause
The preamble grew to ~6 000 characters in round 3. The `by`-field rules (`"extension"` vs `"ai"`) and the dispatch-time pin instructions each appear twice: once in the JSON Schema comments and once in the prose "AUTHORSHIP" and "TIMESTAMPS" sections. The JSON Schema section is already the canonical reference for AI tools, so the prose duplication is redundant.

### Refactoring Strategy
1. Keep one canonical `by`-field rule: in the schema property's description comment (`"extension" | "ai" | "user" | "sdd-skill"` with inline explanation)
2. Remove the separate "AUTHORSHIP" prose block; replace with a 1-line pointer: `See the "by" field schema above for attribution rules`
3. Keep the TIMESTAMPS block but compress from ~300 chars to ~120 chars by dropping the redundant "do NOT type a timestamp by hand" elaboration (already covered by the `date -u` instruction)
4. The MANDATORY FINAL WRITE block (F11 fix) should be compact (~200 chars)

**Risk**: Removing prose that is phrased differently from the schema may lose nuance. Mitigation: run two consecutive lifecycle tests after refactoring to verify correct `by` attribution and timestamps.

### Files Affected
- Same preamble assembly point(s) as F11 fix

---

## Preamble Location

### Decision
The step-dispatch preamble is assembled in `src/ai-providers/` — each provider's `buildSpecKitPrompt` or equivalent method. The SEED WRITE block is templated in `src/features/spec-viewer/messageHandlers.ts` (the preamble injected at dispatch time when the extension initiates a lifecycle command).

### Rationale
Running a grep confirms the preamble content is in the AI provider files and in the viewer's dispatch path. The `specViewerProvider.ts` calls `executeInTerminal(prompt)` where `prompt` includes the assembled preamble + spec content.

---

## Summary

| # | Root Cause | Fix | Files |
|---|-----------|-----|-------|
| F16 | `viewerStateUpdated` doesn't carry `navState.stepHistory` | Extend message + handler | `specViewerProvider.ts`, `index.tsx`, `types.ts` |
| F11 | Preamble closure rule is advisory prose | Add prominent boxed checklist at preamble tail | AI provider preamble files |
| Tokens | Duplicated `by`-field + timestamps prose | Consolidate to schema comments + 1 pointer | Same preamble files |
