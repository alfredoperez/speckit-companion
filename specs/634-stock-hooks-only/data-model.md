# Data Model: Capture plain SpecKit runs with hooks only

No new stored data. Two existing shapes change.

## Hook registrations in `extension.yml`

| Event | Command | Writes |
|---|---|---|
| `before_specify` | `speckit.companion.before-step` | nothing; reads the clock |
| `before_plan` | `speckit.companion.before-step` | plan start, status `planning` |
| `before_tasks` | `speckit.companion.before-step` | tasks start, status `tasking` |
| `before_implement` | `speckit.companion.before-step` | implement start, status `implementing` |
| `after_specify` | `speckit.companion.after-specify` | specify start at the noted time, then specify finish, status `specified` |
| `after_plan`, `after_tasks`, `after_implement`, `before_converge`, `after_converge` | unchanged | unchanged |

All ten are `optional: false`. A start is refused when the step already has one, so a start VS Code recorded at dispatch stands.

## Preset operations the VS Code extension may issue

Before: `add`, `enable`, `remove`. After: `remove` only.

| Installed preset | Operation |
|---|---|
| `companion-standard` | remove |
| `companion-turbo` | remove |
| `companion-lean` | remove |
| `sdd-lean` | remove |
| none of these | none |

A preset counts as installed when its folder exists under `.specify/presets/`. A failed removal is logged and retried on the next start, because the folder is still there.

## Run record on a plain SpecKit run

Unchanged in shape. What differs is who writes it:

| Entry | With the preset | Hooks only |
|---|---|---|
| step start | preset line, or VS Code at dispatch | `before_*` hook, or VS Code at dispatch |
| step finish | `after_*` hook, preset line as backup | `after_*` hook; the VS Code prompt still asks the agent to close as backup |
| per-task finish | preset line per task | `after_implement` sync, one call |
| per-task summary | preset line per task | the VS Code prompt only; none on a terminal run |
