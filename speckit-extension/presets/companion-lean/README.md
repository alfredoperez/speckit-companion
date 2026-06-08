# companion-lean preset

The **lean** spec-kit pipeline — same commands, trimmed: no user-story section, tasks on a files/dependencies axis, a smaller spec folder (≈3 files vs 8), and the same Companion **timing** baked in. Overrides the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`) — replace strategy, the spec-kit default (the `strategy` key is omitted in `preset.yml`); `checklist` and `taskstoissues` stay on stock.

The lean **shape lives in the command bodies, not in document templates** — see [`docs/template-profiles.md`](../../../docs/template-profiles.md) for why (template overrides don't reach `specify`). The four pipeline command bodies here are also the source for the opt-in `/speckit.companion.{specify,plan,tasks,implement}` commands (kept in lockstep by `scripts/check-shape-parity.py`).

## Install (local / dev)

```bash
specify preset add --dev ./speckit-extension/presets/companion-lean
specify preset resolve speckit.specify    # → companion-lean
specify preset remove companion-lean      # turn off (restores stock commands)
```

Prefer the `speckit.companion.templateProfile` setting (`standard` | `lean` | `off`) — it reconciles the two presets so only one is ever installed.

## Per-file lean treatment

`spec.md` (no user stories; Overview + FR + SC + Assumptions) · `plan.md` (files/deps Approach; research folded in; `data-model.md`/`contracts/` only when relevant; no `quickstart.md`) · `tasks.md` (files/deps layers, no story grouping) · `clarify` (≤3 questions, inline) · `analyze` (lightweight, report-only) · `constitution` (principles without the propagation ceremony). Full table in `docs/template-profiles.md`.
