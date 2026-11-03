# Research: Companion steps read spec-kit's template stack

## Ask spec-kit's resolver rather than re-implement its order

- **Decision**: run `.specify/scripts/bash/resolve-template.sh <stem>` with the project as the working directory and `SPECIFY_INIT_DIR` set.
- **Rationale**: the order (override, presets by priority with replace/append/prepend/wrap, extension layers, core) and the preset composition live in spec-kit and change with it. Calling it means Companion always agrees with a stock run.
- **Alternatives considered**: a Python port of the order. Rejected: a second derivation of the same fact drifts, and preset composition is not trivial.

## Fall back to the core file when the script cannot run

- **Decision**: no script, or no `bash` on the path, reads `.specify/templates/<name>` as today. A script that runs and exits non-zero is an error that stops the build.
- **Rationale**: older installs and PowerShell-only projects keep working unchanged. A real resolver failure (for example a preset that needs PyYAML) would otherwise silently give a different template than stock runs use.
- **Alternatives considered**: treat every failure as a fallback. Rejected: that hides exactly the mismatch this slice exists to remove.

## Ignore Companion's own old copy in the extension layer

- **Decision**: when the resolver's answer is byte-equal to Companion's old copy under `.specify/extensions/companion/templates/`, use the core file; after a successful write, delete those old copies.
- **Rationale**: an earlier build left that copy, and spec-kit ranks it above core. Without the guard the first new build would read its own stale output as if it were a team override.
- **Alternatives considered**: delete the old copies before resolving. Rejected: the build must write nothing when it fails.

## Name the doctor check `built`

- **Decision**: a new check `built`, separate from the existing `template` check, which is about the shape of `tasks.md`.
- **Rationale**: the two answer different questions, and reusing the name would mix their findings.
- **Alternatives considered**: `templates`. Rejected: too close to `template` in the report's column.
