# Contract: Spec Explorer actions

The identifiers tests and `package.json` code against.

## Commands (`contributes.commands`)

| Command id | Title | Behavior |
|---|---|---|
| `speckit.livingSpecs.drift` | SpecKit: Check Living-Spec Drift | Dispatch `/speckit.companion.drift <capability>` via `executeSlashCommand` (capability from the invoked tree node; bare command when invoked without one) |
| `speckit.livingSpecs.coverage` | SpecKit: Check Requirement Coverage | Dispatch `/speckit.companion.coverage <capability>` likewise |
| `speckit.livingSpecs.adopt` | SpecKit: Adopt Code Area into Living Spec | Dispatch `/speckit.companion.adopt` (no argument — the wizard prompts for the area) |
| `speckit.livingSpecs.refresh` | SpecKit: Refresh Spec Explorer | Fire the provider's `onDidChangeTreeData` (recomputes health) |

## Menus (`contributes.menus`)

- `view/title` on `view == speckit.views.livingSpecs`: `refresh` (icon, `navigation` group) and `adopt` (icon or overflow).
- `view/item/context` on `view == speckit.views.livingSpecs && viewItem == living-specs-capability`: `drift`, `coverage` (inline-or-context group `livingSpecs@1/@2`).
- No per-node actions for `viewItem == living-specs-capability-missing` or info nodes.

## Dispatch strings (verbatim)

- `/speckit.companion.drift <name>` · `/speckit.companion.coverage <name>` · `/speckit.companion.adopt`

## Model API

```ts
readCapabilityHealth(workspaceRoot: string, cap: ResolvedCapability, opts?: { timeoutMs?: number }): Promise<CapabilityHealth>
```

Best-effort: resolves (possibly with absent fields) — never rejects.
