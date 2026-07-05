# Data Model: Living specs render readably in the viewer

`.spec-context.json` is untouched — `livingSpecs.loaded`/`livingSpecs.synced` stay the on-disk truth. The reshaping is viewer-state only.

## LivingSpecsView (extension + webview mirrors)

| Field | Type | Change | Rule |
|---|---|---|---|
| `loaded` | `string[]` | unchanged | names in load order (most-specific first). |
| `synced` | `string[]` | unchanged | names folded back at completion. |
| `capabilities` | `CapabilityContentView[] \| undefined` | **new** | present only when the provider could attempt content loading (workspace root known); ordered loaded-first then synced-only extras, de-duplicated. Absent → the card renders today's names-only list. |

## CapabilityContentView (new)

| Field | Type | Rule |
|---|---|---|
| `name` | `string` | capability name as recorded. |
| `available` | `boolean` | false when the spec file is missing, unreadable, out-of-root, oversized, or the config doesn't resolve the name. |
| `purpose` | `string?` | intro paragraph before the requirements section, marker-stripped; absent when none. |
| `requirements` | `{ id: string; text: string }[]?` | one row per `### <heading>` block — `id` is the heading, `text` the first body paragraph, both marker-stripped; absent when unavailable. |
| `synced` | `boolean` | name appears in `livingSpecs.synced`. |
| `delta` | `{ added?: number; modified?: number; removed?: number; renamed?: number }?` | counts parsed from the feature spec's delta blocks targeting this capability; absent when no blocks (never zeros). |

## Invariants

- Every name from `loaded`/`synced` appears exactly once in `capabilities` when the field is present.
- `delta` only ever appears on a `synced: true` entry.
- All strings are pre-stripped plain text — the webview never receives markdown to interpret.
- Absent over zeroed everywhere (`purpose`, `requirements`, `delta` omitted rather than empty), matching the panel's no-fabricated-zero rule.
