# Data Model: Ship every runtime script the commands call

The feature has no persisted state. Its "data" is three in-memory sets computed at check time and one declared constant. All of it lives in `speckit-extension/scripts/package-manifest.py`.

## Declared: the packing list

**`RUNTIME_SCRIPTS`** — the set of script filenames that ship inside the release archive. The single source of truth; both consumers read it.

| Entry | Reached how |
|---|---|
| `write-context.py` | Named directly by nearly every command |
| `status-context.py` | Named directly by the status command |
| `derive-from-files.py` | Imported by `status-context.py` |
| `resolve-spec-paths.py` | Named directly by specify / plan / adopt; also loaded by `write-context.py` |
| `companion_config.py` | Imported by `resolve-spec-paths.py` and `register-capability.py` |
| `register-capability.py` | Named directly by the adopt command |
| `drift.py` | Named directly by the drift command |
| `check-coverage.py` | Named directly by the coverage command |

**`BUILD_ONLY`** — scripts that exist in `scripts/` and must never enter the archive: `build-commands.py`, `check-shape-parity.py`, `assemble-nodes.py`, `capture-golden.py`, `_command_parts.py`, and `package-manifest.py` itself.

**Invariant**: `RUNTIME_SCRIPTS` and `BUILD_ONLY` are disjoint, and together they account for every `*.py` file in `scripts/`. A new script that is on neither list fails the check — a script cannot be introduced without a deliberate decision about whether it ships.

## Derived: the reference scan

**`Root`** — a script filename named directly by shipped text.

- **Source**: every command file declared under `provides.commands` in `extension.yml`, plus the shipped `workflows/`.
- **Anchor**: the installed path form, `.specify/extensions/companion/scripts/<name>.py`. This is the only way a command can invoke a script at runtime, which makes it an exact anchor rather than a guess.
- **Current value**: `write-context.py`, `status-context.py`, `resolve-spec-paths.py`, `register-capability.py`, `drift.py`, `check-coverage.py` (6).

## Derived: the closure

**`Closure`** — the roots plus everything reachable from them through sibling references, to a fixed point.

An edge exists from script A to sibling script B when A's source contains a name resolving to B, in any of three forms:

| Form | Captured as |
|---|---|
| `import companion_config` / `from companion_config import …` | bare module name |
| `importlib.import_module("write-context")` | quoted module name (may contain hyphens) |
| `spec_from_file_location(…, "…/resolve-spec-paths.py")` | quoted filename |

Candidate names that do not match a file in `scripts/` are discarded, which drops standard-library imports (`os`, `json`, `argparse`) with no explicit allow-list of stdlib names.

**Termination**: a `visited` set guards the walk, so a cycle (A imports B, B imports A) or a self-reference terminates.

**Current value**: the 6 roots plus `derive-from-files.py` and `companion_config.py` = the 8 in `RUNTIME_SCRIPTS`.

## The assertion

```
Closure == RUNTIME_SCRIPTS
```

Checked in both directions, each failure naming the offending script:

| Condition | Meaning | Message |
|---|---|---|
| `Closure - RUNTIME_SCRIPTS` non-empty | A command needs a script the archive won't carry. This is issue #432. | *needed but not packaged* |
| `RUNTIME_SCRIPTS - Closure` non-empty | The list carries a script nothing needs — or the scanner failed to see a real reference. Either way, look. | *packaged but unreachable* |
| A `scripts/*.py` on neither list | A new script with no shipping decision. | *unclassified* |
| A `RUNTIME_SCRIPTS` entry missing from disk | A typo or a deleted script. | *declared but absent* |
