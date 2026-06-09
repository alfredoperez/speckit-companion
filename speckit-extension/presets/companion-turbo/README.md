# companion-turbo preset

The **turbo** spec-kit pipeline — same commands, trimmed: no user-story section, tasks on a files/dependencies axis, a smaller spec folder (`spec.md` + `plan.md` + `tasks.md` + a trimmed `checklists/requirements.md`, with side files created on demand), and the same Companion **timing** baked in. Overrides the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`) — replace strategy, the spec-kit default (the `strategy` key is omitted in `preset.yml`); `checklist` and `taskstoissues` stay on stock.

The turbo **shape lives in the command bodies, not in document templates** — see [`docs/template-profiles.md`](../../../docs/template-profiles.md) for why (template overrides don't reach `specify`). The four pipeline command bodies here are also the source for the opt-in `/speckit.companion.{specify,plan,tasks,implement}` commands (kept in lockstep by `scripts/check-shape-parity.py`).

## Install (local / dev)

```bash
specify preset add --dev ./speckit-extension/presets/companion-turbo
specify preset resolve speckit.specify    # → companion-turbo
specify preset remove companion-turbo     # turn off (restores stock commands)
```

Prefer the `speckit.companion.templateProfile` setting (`standard` | `turbo` | `off`) — it routes which command family a spec dispatches, with both families staying installed at all times (no preset swap).

## Per-file turbo treatment

`spec.md` (no user stories; Overview + FR + SC + Assumptions) + a trimmed `checklists/requirements.md` (single self-check pass) · `plan.md` (files/deps Approach; side files — `research.md`/`data-model.md`/`contracts/`/`quickstart.md` — created on demand, only when they help build the change) · `tasks.md` (files/deps layers, no story grouping) · `clarify` (≤3 questions, inline) · `analyze` (lightweight, report-only) · `constitution` (principles without the propagation ceremony). Full table in `docs/template-profiles.md`.
