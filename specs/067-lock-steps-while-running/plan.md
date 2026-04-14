# Plan: Lock Steps While Running

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Derive a single `isRunning` boolean in the viewer parent components from existing signals (`activeStep` + `stepHistory[activeStep].completedAt`). Thread it (or the activeStep id) into StepTab and FooterActions so future/unvisited step tabs and the Regenerate / primary-approve buttons become `disabled` while a step is in-flight. Add `title` tooltip props to every step tab and footer button — native HTML `title` only, no tooltip infra.

## Files

### Modify

- `webview/src/spec-viewer/components/StepTab.tsx` — lock future tabs when activeStep is running; add `title` tooltip describing step and disabled reason.
- `webview/src/spec-viewer/components/FooterActions.tsx` — compute `isRunning` from viewerState; disable Regenerate, Approve/Complete/Reactivate while running; add `title` to Edit Source, Archive, Regenerate, primary button, and ensure tooltips include disabled reason when applicable.
- `webview/src/shared/components/Button.tsx` — verify `title` and `disabled` props are forwarded (add if missing).

## Testing Strategy

- **Unit**: Add a StepTab story / test asserting future tabs are `disabled` when `activeStep='plan'` + no completedAt. Add a FooterActions test asserting Regenerate + primary button are disabled when running.
- **Manual**: Load a spec, trigger plan step, verify tasks tab and Regenerate are dimmed and non-clickable; hover each control to confirm tooltip text.
