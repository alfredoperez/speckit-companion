# Contract: `check-command-emissions.py`

## Invocation

```bash
python3 speckit-extension/scripts/check-command-emissions.py
```

No arguments, no configuration, no network. Stdlib only. Runs from the repository root or from anywhere — paths resolve relative to the script's own location, matching `check-shape-parity.py`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Every surface agrees with the manifest. |
| `1` | At least one disagreement, or at least one input the check could not resolve. |

## Output

On success, one line:

```
[command-emissions] OK — 17 commands agree across 7 install areas, 8 agent records, and 2 documents
```

The three counts are derived from what was scanned, never asserted against literals, so the line doubles as evidence of how much surface the run actually covered. A run reporting fewer areas than expected is visible without reading the code.

On failure, a header and one line per finding:

```
[command-emissions] DRIFT
  - <finding>
  - <finding>
```

## Problem strings

Each drift direction produces its own prefix, so a test asserts the specific failure rather than merely that something failed.

| Direction | Line |
|---|---|
| Orphan on disk | `orphan emission: <path> — no command named <name> in extension.yml provides.commands` |
| Gap on disk | `missing emission: <name> — declared in extension.yml but absent from <area>` |
| Orphan in records | `stale record: <name> registered for <agent> — not in extension.yml provides.commands` |
| Gap in records | `unrecorded command: <name> — declared in extension.yml but not registered for <agent>` |
| Stale hook | `stale hook: <event> triggers <name>, which extension.yml no longer declares` |
| Undocumented command | `undocumented command: <name> — declared in extension.yml but absent from <document>` |
| Unknown install area | `unknown install area: <path> — holds Companion commands but is not in KNOWN_AREAS; add it there rather than leaving it unscanned` |
| Unresolvable entry | `unresolvable entry: <path> — inside <area> but matches no known naming shape` |

Findings are sorted so the output is stable across runs and diffable.

## Public surface for tests

The script exposes the same shape as the repository's existing gates, so a test drives the real code path rather than re-implementing the condition:

| Name | Contract |
|---|---|
| `check() -> list[str]` | Runs every assertion against the real repository and returns the problem strings. Empty means clean. |
| `check_area(area, names, root) -> list[str]` | The per-area disk comparison, callable against a temporary directory so a synthetic orphan or gap can be injected without touching the working tree. |
| `check_records(names, registry, extensions_yml) -> list[str]` | The record comparison, callable against synthetic record data. |
| `check_docs(names, docs) -> list[str]` | The documentation comparison, callable against synthetic text. |
| `discover_areas(root) -> list[str]` | Returns every directory holding a Companion-shaped entry, used to assert the known table is complete. |
| `KNOWN_AREAS` | The area table from the data model. A test asserts every directory `discover_areas` finds on the real repository is present here. |
| `main() -> int` | Prints and returns the exit code. |

Each helper takes its inputs as parameters rather than reading globals, so a test can feed it a synthetic broken input for each direction. A suite that only asserts the healthy state would pass against a `check()` hardcoded to return `[]`, so every direction in the table above gets a case that genuinely fails.

## Verbatim identifiers

These strings are pinned by the specification and must appear exactly as written:

- Script path: `speckit-extension/scripts/check-command-emissions.py`
- Manifest key read: `provides.commands` in `speckit-extension/extension.yml`
- Documents checked: `speckit-extension/README.md`, `speckit-extension/docs/commands.md`
- Records checked: `.specify/extensions/.registry`, `.specify/extensions.yml`
- Install areas: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/prompts/`, `.github/agents/`, `.qwen/commands/`, `.gemini/commands/`
- Excluded from the scan: `examples/`
- Family group names: `Pipeline`, `Run state`, `Living specs`, `Hooks (never invoke)`

## CI

Added to `.github/workflows/ci.yml` next to the existing shape-parity and packaging gates, and picked up automatically by the `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` sweep through its test module.
