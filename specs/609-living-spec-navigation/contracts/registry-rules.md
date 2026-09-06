# Contract: the `rules:` block

File: `living-specs.yml` (or the legacy `livingSpecs` block, unwrapped identically).
Normalizer: `load_living_specs_block` in `companion_config.py`.
Reader: `resolve-spec-paths.py`, emitted on `--rules` and inside the `--requirements-for --json` envelope.

## Shape

```yaml
rules:
  spec:
    - "one-line guidance"
  plan:
    - "one-line guidance"
```

The registry is read by a constrained YAML parser: block maps, block sequences, inline flow and quoted scalars only. No anchors, no aliases, no multi-line scalars. Guidance lines are quoted scalars.

## Normalized output

```json
{"rules": {"spec": ["…"], "plan": ["…"]}}
```

Always present, both keys always lists. Unset is `[]`, never `null`.

## Consumption

| Step | Reads |
|---|---|
| specify (`load-living-specs` node) | `rules.spec` only |
| plan (`gather-context` node) | `rules.plan` only |

A step that receives rules records them on `.spec-context.json` alongside `livingSpecs.loaded`, so a reader can tell what guidance the run was given.

## Failure behaviour

| Situation | Result |
|---|---|
| No `rules` key | Both lists empty. Nothing is said about rules anywhere. |
| `rules` is not a mapping | Both lists empty, one warning. The step continues. |
| A step key is not a list | That list empty, one warning. Other steps unaffected. |
| An unrecognized step key | Dropped, one warning. |
| The whole registry is malformed | Existing behaviour: no capabilities, no rules, one warning. The step continues. |

No failure mode fails the host step.
