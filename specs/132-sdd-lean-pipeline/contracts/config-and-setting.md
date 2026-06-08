# Contract: feature toggle (`features.sddLean` + `speckit.features.sddLean`)

Two surfaces, one effective state. `.specify/sdd.config.yml` is the persisted source of truth (FR-010); the VS Code setting is the user-facing control that writes through to it and reconciles the preset.

## Project config — `.specify/sdd.config.yml`

```yaml
features:
  sddLean: true   # default true for Companion-managed projects (opt-out)
```

- Written by install scaffolding (FR-008) with `true`.
- Unknown keys preserved (read-merge-write); never clobber sibling `features.*`.

## VS Code setting — root `package.json`

```jsonc
"contributes": {
  "configuration": {
    "properties": {
      "speckit.features.sddLean": {
        "type": "boolean",
        "default": true,
        "description": "Use the SDD-lean shape (no user stories, files/dependencies tasks) for spec-kit pipeline commands in this project."
      }
    }
  }
}
```

## Reconciliation behavior

| Effective state | Action taken | Resulting shape |
|-----------------|--------------|-----------------|
| `true` (default) | ensure `specify preset add sdd-lean` + `enable` | stock pipeline commands emit SDD-lean shape |
| `false` | `specify preset remove sdd-lean` (Research R2 — not just `disable`) | stock spec-kit shape restored (user stories present) |

- Toggling the setting writes `features.sddLean` into `.specify/sdd.config.yml` and runs the matching `specify preset` action.
- Reconciliation is idempotent: re-applying `true` when already added is a no-op; `false` when already removed is a no-op.
- The namespaced `/speckit.companion.*` commands are NOT governed by this toggle — they always emit the SDD-lean shape.

## Acceptance (FR-006, FR-007, FR-010)

- Fresh Companion-managed project: `features.sddLean: true` present; stock `/speckit.specify` → no user-story section (SC-001).
- Set the setting to `false` → next stock `/speckit.specify` produces the stock template **with** a user-story section, no residual SDD-lean sections (SC-004).
- When both surfaces are present, the effective state is resolved from `.specify/sdd.config.yml` (documented single source of truth).
