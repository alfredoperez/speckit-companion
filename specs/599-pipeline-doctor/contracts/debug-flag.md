# Contract: the debug switch

## Declaration

```yaml
# .specify/companion.yml
debug: true
```

- Top-level key, sibling to `commands:` and `livingSpecs:`.
- Read through the existing `companion_config.load_config`, so an absent file means `false` with no warning and a malformed file means `false` with one warning — the loader's existing failure table, unchanged.
- Any value that is not the boolean `true` means `false`. There is no `debug: verbose` tier.

## Effect

When `debug` is `true`, the body assembly appends the `debug-timing` part to each assembled pipeline command body, using the same conditional append that already places the `orchestrator` part:

```
<!-- speckit-companion:part debug-timing -->
…the instrumentation text…
<!-- /speckit-companion:part debug-timing -->
```

When `debug` is `false`, the part is **not appended**. The rendered body contains neither the fence nor the text — the assembled output is byte-identical to today's frozen golden, which the existing parity gate enforces.

## Timing

The flag is consumed at render time — when bodies are assembled and installed — not at dispatch time. A change to the flag therefore affects the next dispatched command and cannot affect a command already in flight. This is a property of the architecture (the agent reads a static file), not a policy.

## Pinned identifiers

| Identifier | Value |
|---|---|
| Config file | `.specify/companion.yml` |
| Config key | `debug: true` |
| Part name | `debug-timing` |
| Part file | `speckit-extension/presets/_parts/debug-timing.md` |
