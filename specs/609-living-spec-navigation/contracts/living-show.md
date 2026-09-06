# Contract: `living-show`

Command: `/speckit.companion.living-show`
Body: `speckit-extension/commands/speckit.companion.living-show.md`
Backing call: `python3 .specify/extensions/companion/scripts/resolve-spec-paths.py`

## Flags

| Flag | Argument | Prints |
|---|---|---|
| `--headings` | capability name | Every requirement heading in that capability's spec, in file order, one per line. |
| `--requirement "name"` | requirement heading | That requirement's heading and full body, including its scenarios. Matched case-insensitively on trimmed text. |
| `--file <path>` | workspace-relative path | The requirements describing that file, grouped by capability, most-specific capability first. |

`--headings` and `--requirement` take a capability name; `--requirement` without one searches every capability and names the capability of each hit. `--json` is accepted alongside any mode and emits the same content as an object.

## Exit behaviour

Exit code is always `0`.

| Situation | Output |
|---|---|
| Living specs disabled or unconfigured | One line saying so. Nothing else. |
| Capability not registered | One line naming it, plus the registered capability names. |
| Capability registered but its spec file is missing | One line saying the capability has no spec on disk. Never "0 requirements". |
| Requirement name matches nothing | One line saying so, followed by the headings that do exist. |
| Requirement name matches more than one | The candidate headings, with their capabilities. No guess. |
| File matches no capability | One line saying so. |

## Invariants

- The requirement count printed for a capability equals `requirementIds()`'s count and the viewer outline's count, for every capability.
- A requirement with no `touches` marker is returned by `--file` for any file its capability claims.
- Read-only. The command never writes any file.
