# Plan: Fix Status Inference Ignoring Explicit Status

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-02

## Approach

At the top of `inferContextFromState`, check if the state object already has a valid `status` field (`'active'`, `'completed'`, or `'archived'`). If present, use it directly and skip heuristic inference. This preserves backward compatibility since states without `status` will still fall through to the existing logic.

## Files to Change

- `src/features/specs/specContextManager.ts` — add early return for explicit `status` in `inferContextFromState`
