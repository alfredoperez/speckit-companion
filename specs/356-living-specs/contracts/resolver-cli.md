# CLI Contract: `resolve-spec-paths.py`

Path: `speckit-extension/scripts/resolve-spec-paths.py`. Stdlib-only. Reads `livingSpecs` from `.specify/companion.yml` at `--root` (default cwd).

## Flags

| Flag | Meaning |
|---|---|
| `--root <dir>` | repo root (default `.`) |
| `--changed <file>...` | capabilities owning the given files, most-specific first |
| `--all` | union of configured capabilities + on-disk `*.spec.md`, de-duped, plus orphans |
| `--orphans` | orphan `*.spec.md` files only |
| `--json` | emit the machine-readable JSON object; default (without `--json`) is a concise human list |

## Output shapes (`--json`)

`--changed`:
```json
{ "changed": ["src/checkout/cart/x.ts"],
  "matched": [
    { "name": "checkout-cart", "spec": "capabilities/checkout-cart/spec.md", "location": "centralized", "exists": false, "specificity": 17 },
    { "name": "checkout", "spec": "capabilities/checkout/spec.md", "location": "centralized", "exists": false, "specificity": 12 }
  ] }
```

`--all`:
```json
{ "capabilities": [ { "name": "...", "spec": "...", "location": "...", "exists": true } ],
  "orphans": ["notes/random.spec.md"] }
```

`--orphans`:
```json
{ "orphans": ["notes/random.spec.md"] }
```

## Inert (opt-out) contract

When `livingSpecs.enabled` is unset/false or no config exists:
- `--changed` → `{ "changed": [...], "matched": [] }`
- `--all` → `{ "capabilities": [], "orphans": [] }`
- `--orphans` → `{ "orphans": [] }`
- exit 0, no stderr error.

## Error contract

- Colocated capability with no resolvable spec path → exit 2, stderr message naming the capability.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success (incl. inert) |
| 2 | config error (unresolvable colocated spec) |
