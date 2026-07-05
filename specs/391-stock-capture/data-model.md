# Data Model: Stock-mode capture

No schema changes to `.spec-context.json` — the enriched stock capture writes fields the schema and viewer already carry (`intent`, `expectations[]`, `context[]`, `approach`, `decisions[]`, `verified[]`, `coverage`, `step_summaries`, `task_summaries`). Two dispatcher-side shapes change:

## Writer reference (new concept, prompt layer)

| Field | Type | Rule |
|---|---|---|
| `writerPath` | `string` | Absolute path to the bundled `write-context.py`, computed by the builder from the extension install dir; falls back to the workspace-relative companion path when the extension can't resolve itself. Always rendered quoted (install paths contain spaces, e.g. `~/.vscode/extensions/...` under user dirs with spaces). |

Invariant: stock preamble output contains the writer path only in its bundled (or fallback) form — never the bare workspace companion path alongside it.

## Preamble function signatures (reshaped)

| Function | Change |
|---|---|
| `renderPreamble(step, specDir, dispatchUtc, companionInstalled, writerPath)` | gains `writerPath`; stock branch renders the capture block + writer commands with it. |
| `renderLifecyclePreamble(specDir, dispatchUtc, companionInstalled, writerPath)` | same. |
| `renderSpecifyCreationLifecyclePreamble(workflowName, specDir, dispatchUtc, companionInstalled, writerPath)` | same. |
| Slim companion variants | unchanged output (parameter ignored on that branch). |

## State transitions

None persisted. The capture block instructs the same additive, de-duped writer operations the companion bodies use; re-runs never duplicate (writer-side guarantee, already tested in the spec-kit extension's pytest suite).
