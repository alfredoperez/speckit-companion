# Data model

## StockHookRow (existing, gains fields)

- `own: boolean`: the entry's extension is not installed, so the board may edit and remove it.
- `prompt: string`: the prompt shown before an optional hook runs; empty when none.

## StockHookDraft (new)

- `command: string`, required, matches `^[A-Za-z0-9][A-Za-z0-9._:/-]*$`.
- `description: string`, required, trimmed, non-empty.
- `optional: boolean`.
- `prompt?: string`, trimmed; empty means none (on edit, removes the line).

## StockTemplateLayer (new)

- `kind: 'override' | 'preset' | 'extension' | 'core'`.
- `source: string`: the preset or extension id; empty for override and core.
- `path: string`: workspace-relative file.
- `strategy: 'replace' | 'prepend' | 'append' | 'wrap' | 'replace-section'`.

## StockTemplate (existing, gains fields)

- `layers: StockTemplateLayer[]`: top first; the last is the base the others compose onto.
- `inForce: StockTemplateLayer['kind']`: `layers[0].kind`.
