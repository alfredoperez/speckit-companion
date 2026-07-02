# Data Model: Activity panel reasoning trail

**Feature**: 385-activity-reasoning-trail. One additive on-disk change (coverage titles); everything else is derived, in-memory normalization.

## On-disk (additive, spec-kit extension writer)

```ts
// coverage entry gains an optional title (non-destructive upsert, like tasks/tests)
coverage: Record<string, { title?: string; tasks?: string[]; tests?: string[] }>
```

Written via `--coverage-req FR-001 --title "<one-line requirement text>"` at tasks completion. Requirements thereby exist as readable text in the context, closing the "requirements: NOT-TRACKED" gap.

## Derived (ViewerState, both core + webview copies)

```ts
interface ViewerDecision { decision: string; why?: string; rejected?: string }
interface ViewerVerification { what: string; result?: string; command?: string; warnings?: string[] }
interface ViewerCoverageRow { req: string; title?: string; tasks: string[]; tests: string[] }

// ViewerState additions / changes
decisions?: ViewerDecision[];          // was string[]; strings normalize to {decision}
verified?: ViewerVerification[];       // strings normalize to {what}
coverage?: ViewerCoverageRow[];        // map → sorted rows; covered = tests.length > 0
intent?: string;
expectations?: string[];
classification?: { projectedFiles?: number; projectedTasks?: number; scopeSignal?: string; verdict: string };
```

**Normalization rules** (derivation side): strings wrap under the identity key; objects missing the identity key are skipped; non-arrays/non-objects yield the field absent; order preserved (coverage sorted by requirement id). Malformed entries never fail the derivation.

## Rendering states

| Field state | Panel |
|---|---|
| absent / empty after normalization | card absent (no empty shells) |
| legacy strings only | renders as today (decisions) / plain lines (verified) |
| structured | detail lines: why/rejected; result·command·warnings; title — tasks — tests |
| pre-#392 spec (none of the fields) | panel byte-identical to today |
