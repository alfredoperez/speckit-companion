---
id: load-living-specs
name: Load living specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs, only when this project keeps them.** If a `living-specs.yml` sits at the repository root, or `.specify/companion.yml` has a `livingSpecs` block, read `.specify/extensions/companion/commands/reference/living-specify-load.md` and follow it before drafting. Otherwise skip this silently and draft as usual: it must never fail or slow the command.
