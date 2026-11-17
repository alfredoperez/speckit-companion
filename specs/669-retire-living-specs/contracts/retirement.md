# Contract: what a project sees after the retirement

## Commands removed

`speckit.companion.living-adopt`, `living-move`, `living-drift`, `living-show`, `living-validate`, `living-coverage`, `living-sync`.

## Doctor output

- Config holds `livingSpecs:` → one info line, verbatim: `livingSpecs is retired; safe to delete`
- Constitution names flow-back or living specs → one info line naming Companion's flow-forward model and the steps page section.
- The `drift` check is gone from the report and its JSON.

## `write-context.py` flags removed

`--living-specs`, `--living-spec-skip`, `--fold-living-spec`.

## VS Code removed

View `speckit.views.livingSpecs`, every `speckit.livingSpecs.*` command and context key, the status bar item, the `livingSpec.*` telemetry events, the builder's living-specs chip.

## Site

`/docs/results/living-specs` redirects to `/docs/steps#how-companion-keeps-specs`.
