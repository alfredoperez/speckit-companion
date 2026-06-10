# Contract: Fast-Path Config Setting

## VS Code setting (`package.json` → `contributes.configuration`)

```jsonc
"speckit.companion.complexityFastPath": {
  "type": "boolean",
  "default": false,
  "scope": "window",
  "description": "When enabled, auto-detect small changes and fast-track them from specify straight to implement, skipping separate plan and tasks stages. Mirrors the tiny-change guardrail (5 files / 10 tasks). Off by default (opt-in beta) — the full pipeline runs on every change unless enabled. Applies only to the turbo /speckit.companion.* commands."
}
```

- `ConfigKeys.complexityFastPath = 'speckit.companion.complexityFastPath'` added in `src/core/constants.ts`.

## Project-level mirror (`.specify/companion.yml`)

```yaml
templateProfile: 'turbo'
complexityFastPath: true   # resolved boolean, written by the extension on activation
```

## Resolution contract (`companionPresetReconciler`)

```
resolveComplexityFastPath(settingValue):
  resolved = settingValue ?? false            # the VS Code setting is the source of truth
  write resolved into companion.yml           # machine-local cache the command body reads
  return resolved                             # default false (opt-in beta) when unset
```

The setting is mirrored into `companion.yml`; the file is a derived, gitignored cache, not an independent project override.

| VS Code setting | Resolved (and mirrored to companion.yml) |
|---|---|
| `true` | `true` |
| `false` | `false` |
| absent | `false` (opt-in default) |

The resolved value is mirrored back into `.specify/companion.yml` so the command body reads a single boolean.
