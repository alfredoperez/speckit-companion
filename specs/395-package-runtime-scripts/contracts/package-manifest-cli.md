# Contract: `package-manifest.py` CLI

**Path**: `speckit-extension/scripts/package-manifest.py`
**Consumers**: the CI packaging gate, the unit test suite, and the publish flow's archive step.
**Runtime**: Python 3, standard library only (matches every other script in the directory).

Two callers code against this interface, so its flags and exit codes are the contract that keeps the archive and the gate in agreement by construction.

## `--check`

Verifies that the declared packing list and the closure derived from the shipped commands agree in both directions.

```bash
python3 speckit-extension/scripts/package-manifest.py --check
```

| Exit | Meaning |
|---|---|
| `0` | The sets agree. Prints a one-line confirmation with the script count. |
| `1` | Disagreement. Prints one line per offending script, each naming the script and its category (*needed but not packaged*, *packaged but unreachable*, *unclassified*, *declared but absent*). |

A failure must name the script. A bare "packaging check failed" is not sufficient — the whole point is that the next maintainer is told exactly which file to act on.

## `--copy-to <dir>`

Copies every script in the packing list into `<dir>`, creating it if needed. This is what the publish flow calls in place of the hand-typed `cp scripts/…` line.

```bash
python3 speckit-extension/scripts/package-manifest.py --copy-to /tmp/cb/companion-0.18.1/scripts
```

| Exit | Meaning |
|---|---|
| `0` | Every listed script was copied. Prints the count. |
| `1` | A listed script is missing from `scripts/`, or the destination cannot be written. Nothing partial is left behind silently — the failure is loud. |

`--copy-to` runs `--check`'s validation first and refuses to copy on a failed check. An archive is never built from a packing list that is known to disagree with the commands.

## `--list`

Prints the packing list, one filename per line, to stdout. For a maintainer inspecting the list or a shell pipeline that wants the names without reimplementing the parse.

```bash
python3 speckit-extension/scripts/package-manifest.py --list
```

Exit `0` always (the list is a declared constant).

## Importable surface

The test suite imports the module by file path (the established idiom for hyphenated scripts in this repo) and codes against these names:

| Name | Type | Meaning |
|---|---|---|
| `RUNTIME_SCRIPTS` | `frozenset[str]` | The declared packing list. |
| `BUILD_ONLY` | `frozenset[str]` | Scripts that must never ship. |
| `derive_closure()` | `-> set[str]` | The closure computed from the shipped command bodies. |
| `check()` | `-> list[str]` | The problems found; empty means the gate passes. |

`check()` returning a list of human-readable problem strings (rather than raising, or returning a bool) is what lets the unit test assert on *which* script is wrong, and lets the CLI print each problem on its own line.

## Verbatim constraints carried from the spec

`RUNTIME_SCRIPTS` is exactly these eight, spelled exactly this way:

```
write-context.py
status-context.py
derive-from-files.py
resolve-spec-paths.py
companion_config.py
register-capability.py
drift.py
check-coverage.py
```

`BUILD_ONLY` carries at least these five, plus `package-manifest.py` itself:

```
build-commands.py
check-shape-parity.py
assemble-nodes.py
capture-golden.py
_command_parts.py
```
