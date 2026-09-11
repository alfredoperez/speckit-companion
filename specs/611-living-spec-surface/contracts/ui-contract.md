# UI Contract: Living spec surface

## DOM

- Card: `.living-req-card[data-req-state="confirmed|adopted|drifted|new"]`, 3px left edge.
- State word: `.living-req-state` above the heading, only for adopted, drifted, new. Adopted carries `title="adopted from <source>"`.
- Touches link: `.living-req-touches`, text `touches 1 file` or `touches N files`, omitted when there is no touches marker.
- Rail pip: `.spec-toc-cov` with a `--state-<state>` modifier.
- Column: living content max width `760px`.
- Empty state CTA text: `Adopt this area`.
- Header count example: `3 requirements · 1 adopted, unconfirmed`.

## Colours

| State | Edge | Word ink |
|---|---|---|
| confirmed | `--accent` | none |
| adopted | `--review` | `--review-ink` |
| drifted | `--warning` | `--warning` |
| new | `--success` | `--success` |

## Messages (webview → extension)

| Type | Payload | Effect |
|---|---|---|
| `livingAdopt` | none | existing; runs `speckit.livingSpecs.adopt` |
| `livingValidate` | none | new; runs `speckit.livingSpecs.validate` for the open capability |
| `livingUpdate` | none | existing; Sync, capability-scoped |
| `openFile` or existing reveal | first touches entry | touches link |

## Messages (extension → webview)

- `livingHealthResolved.livingMeta.driftedRequirements?: string[]` (new field).
