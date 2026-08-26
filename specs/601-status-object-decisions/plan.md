# Implementation Plan: Status shows the decisions a run actually recorded

**Branch**: `601-status-object-decisions` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/601-status-object-decisions/spec.md`

## Summary

The status report drops every decision a real run recorded, because its reader accepts only bare strings while the capture writer always stores an object. The fix widens that one reader to the same accept-both-shapes rule the VS Code viewer has always used: a non-empty string renders as itself, an object renders its `decision` text, and anything with no usable text is skipped instead of blanking the section. The report's output shape and its machine-readable `RESOLUTION` line stay byte-identical for data that already rendered; the supporting `why` and `rejected` detail stays reachable for a future verbose report rather than being discarded on read. The sibling readers of the run's other captured lists are audited in the same pass, and any that shares the assumption is fixed with it.

## Project Structure

```text
speckit-extension/
├── scripts/
│   ├── status-context.py        # the reader being fixed (_decisions)
│   ├── capture.py               # the writer that produces object entries (_coerce_entry)
│   └── doctor_drift.py          # sibling reader of verified[] — audited
├── tests/
│   └── test_context.py          # StatusResolveTests — the new regression cases land here
└── CHANGELOG.md                 # [Unreleased] › Fixed

src/features/spec-viewer/
└── stateDerivation.ts           # the TypeScript reader whose rule is being mirrored (read-only reference)
```

**Structure Decision**: The change stays inside the spec-kit extension's capture runtime. There is one code file to edit and one test file to extend; no new module, no new script, no packing-list change. The TypeScript reader is a reference for the rule, not an edit target — it already handles both shapes.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new configuration, no provider-specific logic; the widened reader is provider-agnostic. |
| II. Spec-Driven Workflow | PASS — the change restores a pipeline surface (`/speckit.companion.status`) that reports on the specify → plan → tasks → implement lifecycle; no lifecycle state is written or inferred. |
| III. Visual and Interactive | PASS with note — this is a terminal-side report, not a GUI surface. The GUI's equivalent reader already renders these decisions correctly, so the change closes a gap between the two rather than adding a CLI-only feature. |
| IV. Modular Architecture for Complex Features | PASS — not a webview feature; one function widened in an existing module. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md). Four decisions: mirror the TypeScript reader's accept-both rule rather than inventing a second one; keep `_decisions` returning display strings so the `RESOLUTION` contract is unchanged; treat the sibling-reader sweep as an audit that reports rather than speculative widening; and prove the new test fails against the pre-fix reader before landing the fix.

## Phase 1 — Design & contracts

- [data-model.md](./data-model.md) — the recorded-decision entry, its two stored forms, and the rules for reading each.
- [contracts/status-output.md](./contracts/status-output.md) — the human report block and the `RESOLUTION` JSON line, which is what `/speckit.companion.resume` and the test suite code against.

Re-checked against the final design: no constitution row changes.
