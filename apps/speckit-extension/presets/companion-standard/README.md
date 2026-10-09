# companion-standard preset

The **stock** spec-kit pipeline, unchanged — same sections, same files as upstream — with Companion **timing capture** baked into every command body (so per-step durations and per-task cadence stay accurate for any dispatcher, not only the GUI). Overrides the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`) with the `wrap` strategy: each body is a `{CORE_TEMPLATE}` placeholder that spec-kit fills with the project's own stock command, so the stock text matches the spec-kit installed when the preset is added. After a spec-kit upgrade the VS Code extension re-adds the preset on its next start; without it, re-add the preset yourself. `checklist` and `taskstoissues` stay on stock.

This is the **default** profile. See the `commands-*` and `workflows-*` living specs for the full picture (profiles, the commands-vs-templates mechanism, the timing partial, selection).

## Install (local / dev)

```bash
specify preset add --dev ./speckit-extension/presets/companion-standard
specify preset list
specify preset resolve speckit.specify    # → companion-standard
```

Off / switch: `specify preset remove companion-standard` (or pick a different profile via the `speckit.companion.templateProfile` setting, which reconciles the presets for you).

## Shared parts

Every command body wraps the stock command with single-source blocks from [`../_parts/`](../_parts/): `timing.md` (the shared timing block every body ends with), and `concise.md` and `step-start.md` at the top of the four step commands. The blocks are expanded into whole, self-contained bodies by `speckit-extension/scripts/build.py`, and `speckit-extension/scripts/check_shape_parity.py` enforces that each fenced region matches its part byte-for-byte.
