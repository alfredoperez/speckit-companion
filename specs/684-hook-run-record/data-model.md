# Data model

## Hook record (`.spec-context.json` → `hookRuns[]`, append-only)

| Field | Type | Rule |
|---|---|---|
| `step` | string | the command the hook belongs to |
| `when` | `before` \| `after` | |
| `anchor` | string | node, phase or step it attaches to |
| `index` | integer ≥ 0 | its place among the hooks at that anchor |
| `type` | `command` \| `prompt` \| `node` \| `skill` | |
| `ref` | string | the skill or node name; `""` for `command` and `prompt` |
| `outcome` | `ran` \| `skipped` | anything else is refused |
| `reason` | string, optional | one line, newlines collapsed, at most 200 characters |
| `by` | `ai` | the assistant's own report |
| `at` | ISO-8601 UTC | stamped by the writer |

Never rewritten, never de-duped. `--set hookRuns=…` is refused like `history`.

## Hook outcomes answer (host → panel)

| Field | Type |
|---|---|
| `spec` | `{ name, path }` or `null` when the project has no run |
| `runAt` | the spec's newest activity time, or `null` |
| `runs` | the last record per hook key, each with `key = step/when/anchor/index` |
