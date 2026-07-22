# Contract: `record-living-specs.py` CLI

Deterministic recorder for the living specs that cover a change. Reused by the `specify` node bodies (`load-living-specs`, fast-path `finalize`).

## Invocation

```
python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <fd> --changed <file> [<file> …]
```

| Flag | Required | Meaning |
|---|---|---|
| `--feature-dir <fd>` | yes | Spec directory whose `.spec-context.json` receives `livingSpecs.loaded`. |
| `--changed <files…>` | yes | Repo-relative changed files to resolve capabilities for (append-style, one or more). |
| `--root <dir>` | no | Repo root the registry + resolver read from. Defaults to the feature dir's git repo root, else cwd. |

## Behavior

1. Load the living-specs registry via the shipped resolver's `load_living(root)` (which reads `living-specs.yml` or the legacy `livingSpecs` block).
2. If `enabled` is not true → write nothing, exit 0.
3. If no `--changed` files → write nothing, exit 0.
4. Run the resolver's `match_changed(files, living, root)`; take the matched capability names in resolver order (most-specific first).
5. If no matches → write nothing, exit 0.
6. Record the names onto `livingSpecs.loaded` via `capture.set_living_specs_loaded(feature_dir, names)` (merge, de-dupe, preserve order, never touch lifecycle keys).
7. On any exception (unreadable config, unresolvable dir, resolver error, missing dependency) → print one stderr line, exit 0.

## Guarantees

- **Exit code is always 0** — the recorder never fails the host command.
- **Additive only** — writes `livingSpecs.loaded`; never `history`/`status`/`currentStep`.
- **Idempotent** — merging matched names onto an existing list never duplicates.
- **Opt-in** — inert (writes nothing) when the feature is off or absent.
