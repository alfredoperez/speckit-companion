# Data Model: Living Spec Header

Nothing is persisted by this feature. Everything below is derived at render time and lives only in the panel's navigation state.

## LivingHeaderMeta

The bundle of facts the header shows for a living spec. Produced on the extension side, sent to the webview as part of the navigation state, and present only when the viewer is in living-spec mode.

| Field | Type | Required | Meaning | When absent |
|---|---|---|---|---|
| `capabilityName` | string | yes | The capability's registered name, from the project configuration. | Never — falls back to the location-derived name. |
| `specPath` | string | yes | Repository-relative path of the spec file, forward slashes. | Never. |
| `location` | `centralized` \| `colocated` | yes | Whether the spec lives in the central capabilities folder or beside the code. | Never. |
| `match` | string[] | yes | The file patterns the capability claims. May be empty. | Never — empty list means "claims nothing declared". |
| `requirements` | number | no | Count of distinct requirement identifiers in the spec document. | Document declares none, or could not be read. |
| `scenarios` | number | no | Count of acceptance scenarios in the spec document. | Document declares none, or could not be read. |
| `coverage` | `{ covered, total }` | no | Requirements with a mapped test, over total. | No coverage tier, no requirements, or a read failure. |
| `drifted` | boolean | no | Matching source files changed since the spec's last commit. | No repository, spec never committed, check timed out, or a failure. |

**Validation rules**

- Every optional field is genuinely optional. A field that could not be determined is omitted, never zero and never false. `drifted: false` means "checked, no drift"; a missing `drifted` means "not determined".
- `coverage.covered` is never greater than `coverage.total`.
- `requirements` and `coverage.total` are derived from the same identifier scan, so when both are present they are equal.
- The whole object is absent when the viewer is not in living-spec mode, or when the capability cannot be resolved from the project configuration.

## Rendering states

| State | What the header shows |
|---|---|
| Meta absent | Title and badge only — today's behavior, and the fallback for any failure. |
| Meta present, health not yet resolved | Title, badge, counts, claimed patterns, spec location. No coverage, no drift. |
| Meta present, health resolved | The above plus a coverage figure and, when drifted, a drift marker. |
| Meta present, capability claims nothing | The claimed-patterns row is omitted entirely rather than shown empty. |

## Lifecycle

1. The panel opens a living spec and reads the document text.
2. The title is derived from that text; the synchronous facts (counts, patterns, location) are assembled and the header renders.
3. Coverage and drift resolve in the background and are pushed to the open panel, which re-renders the facts row with them added.
4. Re-opening or switching tiers repeats the cycle. Nothing is cached across panels.
