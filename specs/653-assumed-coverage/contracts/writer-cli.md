# Contract: recording an assumption

- `write-context.py --assumes <req> "<what>"`: upserts `coverage[<req>].assumes`. Blank text or a blank requirement writes nothing and says so; exit 0 either way.
- Batch: `{"coverage": [{"req": "FR-004", "assumes": "<what>"}]}` lands the same value. `assumes` may ride with `tasks`, `tests` and `title` in one entry.
- Visible states: `Tested` (today's "N tests"), `Assumed`, and the untraced `No test linked`.
