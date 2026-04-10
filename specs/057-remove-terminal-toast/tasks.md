# Tasks: Remove Terminal Toast

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-10

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [ ] **T001** Remove terminal toast postMessage — `src/features/spec-viewer/specViewerProvider.ts`
  - **Do**: Delete the line `inst?.panel.webview.postMessage({ type: 'actionToast', message: 'Opening terminal…' });` in the `executeInTerminal` callback
  - **Verify**: `npm run compile` passes; clicking a workflow action opens terminal without toast

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001 | [ ] |
