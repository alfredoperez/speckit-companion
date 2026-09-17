# Data Model: Living spec surface

Nothing is persisted. All state is derived on render.

## Requirement card (webview, from the markdown)

| Field | Source | Notes |
|---|---|---|
| heading | `###` line, `[inferred]` stripped | identity; matches `RequirementSlice.heading` trimmed |
| body | lines after the markers | scenarios coloured by the existing WHEN/THEN pass |
| touches | `<!-- touches: … -->` | count drives `touches N files`; first entry is the link target |
| adoptedFrom | `<!-- adopted: … -->` | shown only as the state word's tooltip |
| state | derived | `drifted` if heading ∈ `driftedRequirements`, else `adopted` if adoptedFrom, else `confirmed`. `new` reserved for LV-10 |

State maps to the card's `data-req-state` attribute and to the rail pip.

## LivingHeaderMeta (protocol, extended)

| Field | Change |
|---|---|
| `drifted?: boolean` | unchanged; absent means unknown |
| `driftedRequirements?: string[]` | new; headings whose touches match a drifted file; absent when drift is unknown |

## Header count line

`N requirements` followed by ` · X adopted, unconfirmed` and ` · Y drifted` only when X or Y is above zero. Singular `1 requirement`.

## Bar condition

| Condition | Text |
|---|---|
| no spec file | `No spec yet` |
| drift unknown | `Drift unknown` |
| Y drifted | `Y requirement(s) drifted` |
| otherwise | `In sync` |
