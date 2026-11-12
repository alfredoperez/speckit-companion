---
id: load-living-specs
name: Load the living specs this plan touches
kind: investigate
command: plan
reads: []
---
**Read what is already written down before sending anyone to rediscover it, when this project keeps living specs.** If the spec's `.spec-context.json` lists any `livingSpecs.loaded`, read `.specify/extensions/companion/commands/reference/living-plan-load.md` and follow it before investigating the codebase. An absent or empty list means skip this; never decide from the config yourself.
