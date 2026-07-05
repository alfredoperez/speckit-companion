# UI Contract: living specs in the viewer

## Data (fields tests code against)

- Source of truth: `livingSpecs.loaded` / `livingSpecs.synced` on `.spec-context.json` (verbatim from the spec; unchanged).
- Viewer state: `livingSpecs.capabilities[]` per `data-model.md` — `name`, `available`, `purpose?`, `requirements[]? (id, text)`, `synced`, `delta?`.
- Loader: `src/features/spec-viewer/livingSpecsContent.ts` exports `enrichLivingSpecs(view, workspaceRoot, featureSpecPath)` returning the enriched view; pure given its filesystem inputs, unit-tested against tmp-dir fixtures.
- Document shape parsed (as emitted by the fold-back writer): `# <Title> — Living Spec` · optional intro paragraph · `## Requirements` · `### <heading>` blocks; requirement span ends at the next `###`/`##` or EOF.

## Component (`webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx`)

| Selector / element | Contract |
|---|---|
| `.activity-card--living-specs` | card root, absent when no `livingSpecs` data (unchanged). |
| `.living-specs-cap` | one per capability, `<details open>` disclosure; summary = name + tags. |
| `.living-specs-cap__purpose` | purpose line, plain text. |
| `.living-specs-req` | requirement row: id chip (`.living-specs-req__id`) + text (`.living-specs-req__text`), text nodes only. |
| `.living-specs-list` (names-only fallback) | preserved verbatim for payloads without `capabilities`. |
| folded-back tag | preserved; delta counts render beside it as `+N added · N modified · N removed` (only kinds present). |
| unavailable note | `.living-specs-cap__unavailable` — quiet, name still shown. |

## Fixtures

- `LivingSpecsCard.stories.tsx`: `RichContent` (two capabilities, requirements, one synced with delta), `NamesOnly` (legacy payload), `ContentUnavailable`.
- `specs/_03_demo-living/`: committed demo spec whose context carries `livingSpecs` names — exercises the real-viewer degraded path in this config-less repo.
