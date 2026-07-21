# Data Model: living-sync

No persisted state is introduced. The feature reads existing structures and passes one in-memory object between the deterministic and AI halves.

## Drift result (extended, `drift.py --json`)

The existing result object gains one field and one mode of population; nothing is renamed or removed.

| Field | Type | Notes |
|---|---|---|
| `enabled` | bool | unchanged |
| `working` | bool | **new** — true when `--working` was passed; false otherwise |
| `checked` | int | unchanged semantics ("clean" vs "did not run") |
| `capabilities[]` | list | unchanged shape: `name`, `spec`, `commit` (8-char baseline), `drifted[]`, `inSync` |
| `capabilities[].drifted[]` | list | unchanged shape: `file`, `severity` (`tracked` \| `unspeced`); in working mode the set additionally includes uncommitted, deleted, and untracked files |
| `skipped[]` | list | unchanged: `name`, `reason` — same reasons in both modes |

**Validation rules**: a file appears at most once per capability (single diff + set-union with untracked); the capability's own spec document and reserved tier siblings never appear; exempt-glob matches never appear; default mode issues exactly today's git commands and renders identical human output — its JSON gains only the constant `working: false` field (a stable schema beats a conditional one).

## Sync plan (in-memory, consumed by the command body)

The `capabilities[]` entries of the working-mode drift result, filtered to `drifted` non-empty. Per entry the command uses: `name` (report key), `spec` (file to edit in place), `drifted[].file` (the scope of the update).

## Sync report (command output, not persisted)

| Element | Content |
|---|---|
| Synced | capability name + count of changed files folded |
| Skipped | capability name + verbatim drift skip reason (uncommitted-spec skips point at `living-adopt`) |
| Reminder | spec edits left uncommitted, to be committed with the code |
