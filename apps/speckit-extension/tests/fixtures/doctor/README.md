# Doctor fixtures

Each subdirectory is a spec directory frozen in one broken shape, so a doctor check has exactly one thing to find. Tests read them; nothing writes them at runtime.

| Fixture | Shape |
|---|---|
| `dangling-start/` | `history[]` carries a step-level `start` for `plan` with no matching `complete`. |
| `unjournaled-tasks/` | `tasks.md` has `- [x]` markers whose task ids never appear as per-task completes. |
| `burst-journal/` | Every per-task complete is stamped inside a two-second window at the end of the step. |
| `attribution-anomaly/` | `specify` is closed `by: ai`, a step the extension is the only sanctioned closer of. |
| `records-disagree/` | `status: specified` with no step-level `specify` complete — the stepper cannot advance. |
| `records-consistent/` | Status, history, and files all agree; the triage must blame the display, not the capture. |
| `earliest-state/` | A single `specify` start and nothing else — the legitimate beginning of a run. Evaluated from a `now` inside the in-flight grace period it must produce no finding; evaluated much later the same record is a genuine dangling start. |
| `flattened-tasks/` | A task file whose user-story phases were replaced by top-level `## Wave N` headings. |
| `stuck-completion/` | A spec at `implemented` where completion was attempted and never landed. |
| `no-feature-json/` | A repository shape with `.specify/feature.json` missing, reproducing the foreign-repo completion failure. |
