# Living-specs sandbox matrix

Real sandboxes that prove the living-specs write-back loop closes — the shipped scripts run against baked repos via `--root`, every value captured from a real process, nothing hand-authored. Sandboxes live gitignored under `examples/bench-sandboxes/`; evidence JSON is committed under `evidence/`.

## Re-run

```bash
# The round-3 matrix — the standing answer to "did living specs regress?"
node ls-r3.mjs                 # 8 scenarios across 4 sandboxes → evidence/LS-R3.json + evidence/S*.json

# The original LS1–LS8 demos (one at a time)
node ls-demos.mjs LS3          # LS1 | LS2 | LS3 | LS4 | LS5 | LS6 | LS8
```

Both exit non-zero if any assertion fails, so they gate in CI as-is.

## The round-3 matrix (`ls-r3.mjs`)

Four sandboxes, canonical root `living-specs.yml`:

| Sandbox | Registry | Exercised by |
|---|---|---|
| `ls-r3-central` | central (`capabilities/<name>/spec.md`), enabled | S3, S4, S8 |
| `ls-r3-coloc` | colocated (`src/<area>/<name>.spec.md`), enabled | S2, S6 |
| `ls-r3-unadopted` | none | S5 |
| `ls-r3-off` | present, `enabled: false` | S7 |

| # | Scenario | Proves |
|---|---|---|
| S1 | Install sanity | the shipped resolver + scripts run against all four registry shapes |
| S2 | Simple change adds a requirement (colocated) | the gate records the capability + breadcrumb, and the fold updates the colocated spec once |
| S3 | Normal change adds a requirement (central) | the same loop on the central layout, `check_living_spec.py` green |
| S4 | Change adds nothing (central) | without a skip note the fold shouts "the loop did not close"; with one it's byte-identical + "correctly nothing" |
| S5 | Not adopted → adopt | an unadopted area resolves nothing until registered, then loads; re-adopt detects the existing capability |
| S6 | Go around the pipeline | a direct commit shows as drift; after the spec updates, drift clears |
| S7 | Disabled | every verb no-ops — the gate breadcrumb reads "skipped (not configured)", the fold is inert |
| S8 | Idempotency | re-folding is a byte no-op |

The only seeded inputs are the prose an AI would write (a feature spec, a delta block, a skip reason). The scripts under test do the rest for real, which is what exercises the deterministic pre-draft gate and the completion-accountability backstop.
