# Data model: Retire living specs

## Spec record (`.spec-context.json`)

| Field | Before | After |
|---|---|---|
| `livingSpecs.loaded`, `loadedRequirements`, `rules`, `synced`, `skipped` | written by specify, plan, implement | never written; read for the old-record card only |
| `source`, `extends`, `supersedes` | lineage set by specify | unchanged; the site now explains them |

Unknown keys survive a merge write, so old blocks stay intact.

## Project config (`.specify/companion.yml`)

| Key | After |
|---|---|
| `livingSpecs:` | ignored by every reader; doctor prints one info line |
| `living-specs.yml`, `capabilities/` | never read, written, moved or deleted |
| node orders naming `load-living-specs` or `draft-spec-delta` | skipped with one warning |
