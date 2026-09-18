# Implementation Plan: Requirement Coverage Badges

**Branch**: `614-requirement-coverage-badges` | **Date**: 2026-09-18 | **Spec**: [requirement-coverage-badges.spec.md](./requirement-coverage-badges.spec.md)

## Summary

The requirement cards already draw a coverage label, but nothing in the running extension supplies one. The extension will read the capability's coverage file once more while it resolves health, build a label per requirement heading, and send it in the health message it already posts after first paint. The webview will hand that map to the card renderer's existing setter and redraw only when the map changed. No new message, no new file on the extension side, no change to the card's markup.

## Project Structure

```text
src/
├── protocol/viewer.ts                         # LivingHeaderMeta gains requirementCoverage
├── features/specs/livingSpecsModel.ts         # readRequirementCoverage beside readCoverageCount; CapabilityHealth carries it
├── features/specs/__tests__/                  # per-requirement coverage cases beside the existing health tests
└── features/spec-viewer/
    ├── livingHeaderMeta.ts                    # resolveLivingHealth passes the field through
    ├── specViewerProvider.ts                  # the "nothing resolved" guard also checks the new field
    └── __tests__/livingHeaderMeta.test.ts     # supply-path test, extension half
webview/src/spec-viewer/
├── markdown/livingComponents.ts               # setLivingCoverage returns whether the map changed
├── messageHandlers.ts                         # applies the map on livingHealthResolved, clears it on a capability switch
└── __tests__/messageHandlers.test.ts          # supply-path test, webview half: message in, label on the card
CHANGELOG.md                                   # one user-facing line under Unreleased
```

**Structure Decision**: Extend the files that already own each concern. Coverage reading stays in the living-specs model (capability `specs-living-model`), the message shape stays in the shared protocol module (capability `spec-viewer-panel`), and the card state stays in the living components (capability `viewer-ui-document`).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No new setting. The label appears when a coverage file exists and is absent otherwise. |
| II. Spec-Driven Workflow | PASS. Read-only over the spec and its coverage file. Nothing is written to either. |
| III. Visual and Interactive | PASS. Restores a visual fact the cards were designed to show. The outline already reads it off the card. |
| IV. Modular Architecture | PASS. No new module. Each change lands in the file that owns the concern. |

Re-checked after Phase 1: no change.

## Requirement Map

| Requirement | Where it lands |
|---|---|
| FR-001, FR-005, FR-006 | `readRequirementCoverage` in the living-specs model |
| FR-002 | `CapabilityHealth`, `resolveLivingHealth`, the provider's guard, the protocol type |
| FR-003, FR-004 | Already in the card renderer. Verified by the webview supply-path test. |
| FR-007, FR-008 | `setLivingCoverage` change flag and the message handlers |
| FR-009 | The two supply-path tests |
