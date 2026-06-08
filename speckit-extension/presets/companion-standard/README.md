# companion-standard preset

The **stock** spec-kit pipeline, unchanged — same sections, same files as upstream — with Companion **timing capture** baked into every command body (so per-step durations and per-task cadence stay accurate for any dispatcher, not only the GUI). Overrides the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`) — replace strategy, the spec-kit default (the `strategy` key is omitted in `preset.yml`); `checklist` and `taskstoissues` stay on stock.

This is the **default** profile. See [`docs/template-profiles.md`](../../../docs/template-profiles.md) for the full picture (profiles, the commands-vs-templates mechanism, the timing partial, selection).

## Install (local / dev)

```bash
specify preset add --dev ./speckit-extension/presets/companion-standard
specify preset list
specify preset resolve speckit.specify    # → companion-standard
```

Off / switch: `specify preset remove companion-standard` (or pick a different profile via the `speckit.companion.templateProfile` setting, which reconciles the presets for you).

## Timing partial

Every command body ends with the shared timing block from [`../_shared/timing-partial.md`](../_shared/timing-partial.md). It is identical across both profiles and is enforced by `speckit-extension/scripts/check-shape-parity.py`.
