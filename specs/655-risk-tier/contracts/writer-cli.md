# Contract

- `write-context.py --risk`: computes and stores `risk`; prints `[companion] Review depth: <tier> (<first reason>)`.
- `write-context.py --risk-raise <tier> "<reason>"`: raises; refused (declined, exit 0) for a lower or equal tier, an unknown tier or a blank reason.
- `.specify/companion.yml`: `risk: { high: [<glob>...], low: [<glob>...] }` extends the defaults.
- Overview: `Review depth: <tier>`; with a raise, `Review depth: <tier> · raised by the agent: "<reason>"`.
