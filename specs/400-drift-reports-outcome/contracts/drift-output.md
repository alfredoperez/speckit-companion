# Contract: drift command output

The README documents `/speckit.companion.living-drift --json` as "the same data for tooling / CI", so the JSON object is an interface consumers code against. This pins what this change adds and what it guarantees stays put.

## Machine-readable output

```json
{
  "enabled": true,
  "checked": 4,
  "capabilities": [
    {
      "name": "checkout",
      "spec": "capabilities/checkout/spec.md",
      "commit": "10a4650b",
      "drifted": [
        { "file": "src/checkout/cart.ts", "severity": "unspeced" }
      ],
      "inSync": false
    }
  ],
  "skipped": [
    { "name": "billing", "reason": "spec.md not yet committed" }
  ]
}
```

**Guarantees**:

- `checked` is present on every result, including when `enabled` is false (where it is `0`).
- `checked` equals the length of `capabilities`.
- No existing field is renamed, removed, or changes type. A consumer reading only `capabilities` and `skipped` today is unaffected.
- The process exits `0` for every result, including all-skipped and drift-found.

## Human-readable output

Exact strings, since the point of the change is what a reader sees.

**All skipped, one shared reason** — the counts line is last, and no success glyph appears anywhere:

```
ℹ ai-providers: spec.md not yet committed; skipping drift check
ℹ billing: spec.md not yet committed; skipping drift check
0 checked, 2 skipped (spec.md not yet committed)
```

**All skipped, mixed reasons** — the parenthetical is omitted, because the notes above carry the reasons:

```
ℹ ai-providers: spec.md not yet committed; skipping drift check
ℹ billing: git unavailable or --root is not a git repo; skipping drift check
0 checked, 2 skipped
```

**Checked and clean** — the success claim, narrowed and counted:

```
✓ All 4 checked capabilities in sync.
```

**Checked and clean, with skips** — both halves stated:

```
ℹ billing: spec.md not yet committed; skipping drift check
✓ All 4 checked capabilities in sync.
1 skipped (spec.md not yet committed)
```

**Enabled but nothing configured**:

```
No capabilities configured.
```

**Feature disabled** — the empty string; the command prints nothing.

## Fold-back log line

Written to stderr, one per capability actually written. Counts are of applied changes.

**All changes applied** — unchanged from today:

```
[companion] Living-spec fold: checkout ← +2 added, ~1 modified, -0 removed, ↻0 renamed (capabilities/checkout/spec.md)
```

**Some changes dropped** — counts reflect what landed, and the drop is named:

```
[companion] Living-spec fold: checkout ← +2 added, ~0 modified, -0 removed, ↻0 renamed (capabilities/checkout/spec.md) — 3 change(s) skipped: no matching requirement heading
```
