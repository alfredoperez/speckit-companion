# Data Model: folded flag on the derived step entry

## StepHistoryEntry (derived, in-memory)

Declared in `src/core/types/specContext.ts`, mirrored in `webview/src/spec-viewer/types.ts`.

| Field | Type | New? | Meaning |
|---|---|---|---|
| `startedAt` | `string` | — | existing |
| `completedAt` | `string \| null` | — | existing |
| `substeps` | array / record | — | existing |
| `durationTrusted` | `boolean?` | — | existing: span safe to present as a duration |
| `folded` | `boolean?` | **yes** | the step's lifecycle boundaries were stamped as a fast-path fold; present its timing as "folded into" the anchoring phase, never as a duration |

## Rules

- `folded` is written only by `deriveStepHistory`; absent means not folded. No other writer exists.
- Set when all hold: exactly one extension-stamped step-level `start`; an extension-stamped step-level `complete` for the same step; `complete − start` within `[0, 1000ms)`; `start` within `[0, 1000ms)` of the previous step group's extension-stamped step-level close; the step is not the first group.
- Independent of `durationTrusted`: a same-instant fold is `folded: true`, `durationTrusted: false`.
- Not persisted: `stepHistory` is derived from `history[]` on every read; `.spec-context.json` is unchanged.

## State transitions

None — the flag is a pure function of the append-only `history[]`.
