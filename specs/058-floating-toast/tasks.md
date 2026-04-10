# Tasks: Floating Toast Notification

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-10

## Phase 1 — Implementation

### T001: Rewrite Toast component as floating element ✅
- **File**: `webview/src/shared/components/Toast.tsx`
- [x] Render toast as a floating `<div>` with absolute positioning instead of inline `<span>`
- Add slide-up + fade-in animation on show, fade-out animation before removal
- Handle auto-dismiss with configurable duration (default 2s)
- Replace current toast immediately when a new one triggers

### T002: Update footer CSS for floating toast ✅
- **File**: `webview/styles/spec-viewer/_footer.css`
- [x] Replace `.action-toast` styles with absolute positioning above footer
- Center horizontally with `left: 50%` + `transform: translateX(-50%)`
- Add background, border, shadow using VS Code theme variables
- Define `@keyframes` for slide-up/fade-in and fade-out animations (~200ms each)

### T003: Move Toast out of footer inline flow ✅
- **File**: `webview/src/spec-viewer/components/FooterActions.tsx`
- [x] Move `<Toast>` rendering out of `.actions-left` div
- Render as sibling or in a wrapper that allows absolute positioning relative to footer

### T004: Remove "Opening terminal…" toast message ✅
- **File**: `src/features/spec-viewer/specViewerProvider.ts`
- [x] Remove `postMessage({ type: 'actionToast', message: 'Opening terminal…' })` from `executeInTerminal`

## Phase 2 — Verification

### T005: Unit tests — `test-expert`
- [P][A] Write tests for Toast component: animation class toggling, auto-dismiss timing, replacement behavior
- Verify "Opening terminal…" toast is no longer sent from `executeInTerminal`
