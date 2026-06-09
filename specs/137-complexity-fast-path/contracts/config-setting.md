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
resolveComplexityFastPath():
  if companion.yml has explicit `complexityFastPath` (boolean):  return it      # project wins
  else if VS Code setting is set:                                return setting
  else:                                                          return false   # default (opt-in beta)
```

| companion.yml | VS Code setting | Resolved |
|---|---|---|
| `false` | `true` | `false` (project wins) |
| `true` | `false` | `true` (project wins) |
| absent | `false` | `false` |
| absent | absent | `false` (opt-in default) |

The resolved value is mirrored back into `.specify/companion.yml` so the command body reads a single boolean.
