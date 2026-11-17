# Living specs: what retired, and why

Living specs kept a registry of capability specs beside the code and folded each finished feature's changes back into it. Companion now follows one model instead: flow-forward. Each change gets its own spec folder, a completed spec is final, and lineage links (`source`, `extends`, `supersedes`) connect related folders. Converge does not replace what living specs did. This is a deliberate cut, not a swap.

Nothing in your project is deleted. Your `capabilities/` folder, `living-specs.yml` and any `livingSpecs:` block in `.specify/companion.yml` stay where they are; Companion just stops reading and writing them. The doctor prints one line when the old setting is still there.

## Capabilities that retired

| What | What it did | Why it went |
|---|---|---|
| Registry | `living-specs.yml` listed each capability and where its spec lived, central or colocated | Nothing keeps it current once fold-back is gone |
| Drift | Reported source files changed since a capability's spec was last committed | Needs a registry to compare against |
| Coverage | Mapped each requirement to the tests that cover it | Needs the coverage tier files |
| Fold-back (sync) | Merged a finished feature's deltas into the capability specs | Flow-forward keeps each change in its own folder |
| Adoption | Drafted capability specs for existing code areas | Produced registry entries nobody would maintain |
| Move, show, validate | Moved a spec between layouts, printed one slice, checked its shape | Tools for the registry's files |

## Spec-kit extension commands removed

`speckit.companion.living-adopt`, `living-move`, `living-drift`, `living-show`, `living-validate`, `living-coverage`, `living-sync`.

## Pipeline behavior removed

- Specify and plan no longer load capability specs before drafting, and specify no longer drafts spec deltas.
- Implement no longer reviews and folds deltas at the end.
- The Brownfield workflow preset drafts a plain spec.
- The doctor's drift check is gone.
- `write-context.py` drops `--living-specs`, `--living-spec-skip` and `--fold-living-spec`.

## VS Code extension removed

- The Living Specs sidebar view and its status bar item.
- Its commands: set up, adopt, sync, validate, drift, coverage, move, open, open for file, refresh, update, copy name and path, delete.
- Opening a capability spec in the viewer with its requirement cards, approve and remove actions, and undo.
- The on-save shape check for capability specs.
- The Workflow Builder's living-specs chip.
- The `livingSpec.opened`, `livingSpec.drift` and `livingSpec.sync` telemetry events.

## Record fields

New specs no longer write `livingSpecs.loaded`, `loadedRequirements`, `rules`, `synced` or `skipped`. Old specs keep them, and their Overview still shows the living specs card, with names as plain text.

## Site

The Living specs page now redirects to "How Companion keeps specs" on the Steps page.
