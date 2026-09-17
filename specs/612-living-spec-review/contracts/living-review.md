# Contracts: Reviewing a living spec

## Viewer messages (`src/protocol/viewer.ts`)

**Webview to extension**

| Message | Payload | Handled by |
|---|---|---|
| `approveSpec` | `{ documentType? }` (existing) | `handleLivingApprove`, which now stores a pending undo |
| `removeRequirement` | `{ heading }` (existing) | `handleLivingRemove`, which now stores a pending undo and refuses via `leanedOnBy` |
| `undoLivingAction` | `{ token: string }` | new handler: restores or refuses, then clears the pending undo |
| `openLivingSpec` | `{ capabilityName, specPath?, requirement? }` (existing) | sent by a resolved Leans on or Leaned on by entry, with `requirement` set |

**Extension to webview**

| Message / field | Change |
|---|---|
| `livingHealthResolved` | its `LivingHeaderMeta` gains `newRequirements?: string[]` |
| `NavState.livingUndo` | `{ token, kind: 'approve' \| 'remove', expiresAt: number }`, present only while pending |
| `NavState.livingOverview.requirements[]` | gains `leansOn` and `leanedOnBy` (see data-model) |

## Webview identifiers

- Bar button label: `Approve all N`, where N is the adopted count. Not rendered when N is 0.
- Undo control: `UndoToast` with the label `Undo`, duration `expiresAt - Date.now()`.
- Card attribute `data-req-new` and a pill reading `New`.
- Card lists titled `Leans on` and `Leaned on by`. Entries are `button[data-open-living-requirement]` carrying `data-capability`, `data-spec-path` and `data-heading`, built with `escapeAttr`. A broken entry is a non-interactive span marked broken and showing `raw`.
- Header fact: `N new`, shown when `newRequirements.length ≥ 1`.

## Command (`package.json`)

```json
{ "command": "speckit.livingSpecs.open", "title": "Open Living Spec", "category": "SpecKit" }
```

- The palette shows `SpecKit: Open Living Spec`.
- The first picker lists every registered capability. Dismissing it opens nothing.
- The second picker lists the requirement headings plus "Open at the top". Dismissing it opens nothing.
- It runs `speckit.viewSpecDocument(absSpecPath, { living: true, requirement? })`.
- When living specs are not configured, an information message says so and nothing opens.

## Resolver CLI (`speckit-extension/scripts/resolve-spec-paths.py`)

```bash
python3 resolve-spec-paths.py --leaned-on-by <capability>#<heading> [--json]
```

```json
{ "show": "leaned-on-by", "target": "<capability>#<heading>", "matches": [ { "capability": "...", "heading": "...", "touches": ["..."], "body": "..." } ] }
```

- `matches` holds every requirement in every registered capability whose aligns marker names the target, including the target's own capability.
- Heading matching is exact.
- No match gives `"matches": []`.
- A disabled registry gives the same empty shape.
- Without `--json`, the text output lists `capability#heading`, one per line.

## Removal record

See data-model. Written by `appendLivingRemoval` in `src/features/spec-viewer/livingDocs.ts`. Read by `removed_requirements()` in the resolver, which `living_validate.py` uses to skip `delta-heading-not-found`.
