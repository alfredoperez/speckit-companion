# Register living specs — Living Spec

## Purpose

A project turns living specs on by listing its capabilities in one registry file: which code each capability owns and where its spec lives. Everything else in the feature reads that registry, so a registry that is wrong, half-written or out of step with the files on disk breaks every other living-spec command at once.

## Requirements

### Living specs are off until the registry turns them on
<!-- touches: apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/scripts/resolve-spec-paths.py -->

Living specs SHALL do nothing unless `living-specs.yml` at the project root says `enabled: true`. With no registry, or with it disabled, every living-spec command reports nothing and exits successfully, and specify, plan and completion behave exactly as they do without the feature.

#### Scenario: a project with no registry
- **WHEN** any living-spec command runs in a project that has no `living-specs.yml`
- **THEN** it prints an empty result and exits successfully

### The registry at the project root is the one that answers
<!-- touches: apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/scripts/register-capability.py -->

When `living-specs.yml` exists it SHALL be the only source of capabilities, even when it disables the feature. A project that still keeps its capabilities in the older `.specify/companion.yml` keeps working, and the next registration or move carries that whole set into `living-specs.yml` and removes the old block.

#### Scenario: both files are present
- **WHEN** the project has a `living-specs.yml` and an older block in `.specify/companion.yml`
- **THEN** only the capabilities in `living-specs.yml` are used, and the older block is left alone and reported

#### Scenario: only the older config exists
- **WHEN** a capability is registered in a project that has only the older block
- **THEN** every older capability is written to `living-specs.yml` with the new one, and the older block is removed

### A capability owns the files its globs match
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py, apps/speckit-extension/scripts/companion_config.py -->

A file SHALL belong to a capability when it matches any of the capability's `match` globs and none of its `exclude` globs. `**` crosses directories, `*` stays inside one path segment, and a trailing `/**` also matches the directory itself.

#### Scenario: an excluded test file
- **WHEN** a capability matches `src/checkout/**` and excludes `src/checkout/**/*.test.ts`
- **THEN** `src/checkout/cart/x.test.ts` belongs to no capability through that entry

### A spec lives centrally or next to its code
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py, apps/speckit-extension/scripts/companion_config.py -->

A capability with no `spec` path SHALL keep its spec at `capabilities/<name>/<name>.spec.md`, and one with an explicit `spec` path keeps it there. A `.rules.md` and a `.coverage.md` with the same base name travel with the spec as its colder siblings, and an older `.arch.md` still reads as the rules file. A capability whose declared spec path is empty fails the whole registry with an error naming that capability.

#### Scenario: a registry written before the central rename
- **WHEN** a capability declares no `spec` and only the older `capabilities/<name>/spec.md` exists
- **THEN** that older file is the capability's spec

### A spec nobody registered shows up as an orphan
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py -->

Listing every capability SHALL also list each `*.spec.md` of either layout that no capability claims, and treat it as a discovered capability named after its folder. Sibling tier files, other specs inside a registered capability's spec folder, and feature specs under `specs/` are never orphans.

#### Scenario: an unregistered central spec
- **WHEN** `capabilities/reports/reports.spec.md` exists and no capability claims it
- **THEN** `--orphans` lists it and `--all` shows it as a capability named `reports`

### A nested project answers for itself
<!-- touches: apps/speckit-extension/scripts/resolve-spec-paths.py, apps/speckit-extension/scripts/companion_config.py -->

A directory below the root that carries its own registry, or the older config, SHALL be treated as a separate project whatever that config says. Its specs never appear among the parent's orphans or capabilities, and `node_modules` is skipped the same way.

#### Scenario: a sandbox that turned living specs off
- **WHEN** a sample app inside the repo has its own `living-specs.yml` with `enabled: false`
- **THEN** none of its spec files appear in the parent project's listing

### Registering a capability never damages the registry
<!-- touches: apps/speckit-extension/scripts/register-capability.py, apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/commands/speckit.companion.living-adopt.md -->

Registering SHALL append one capability and keep every existing capability, comment and unrelated key. With no registry it creates an enabled one, registering a name that already exists changes nothing, and a registry that cannot be parsed is refused and left byte for byte as it was.

#### Scenario: the name is already registered
- **WHEN** a capability named `billing` is registered twice
- **THEN** the second run reports a no-op and the file is unchanged

#### Scenario: the registry has a syntax error
- **WHEN** registration runs against a registry that will not parse
- **THEN** it exits with an error and writes nothing

### Moving a spec moves the file and the registry together
<!-- touches: apps/speckit-extension/scripts/relocate-capability.py, apps/speckit-extension/commands/speckit.companion.living-move.md -->

`/speckit.companion.living-move` SHALL move a capability's spec and its tier siblings between the central and colocated layouts and rewrite the registry in one all-or-nothing step, without touching the spec's content. A failed registry write puts the files back, a capability already in the target layout is a no-op, and a capability whose globs span sibling folders or a whole area stays central because it has no folder of its own. Moving everything at once skips and reports a capability it cannot place and carries on with the rest.

#### Scenario: a capability with one area
- **WHEN** `billing`, matching `src/billing/**`, is moved to colocated
- **THEN** its spec and rules file land in `src/billing/` and the registry records the new `spec` path

#### Scenario: a capability spanning sibling folders
- **WHEN** a capability matching `src/pages/login/**` and `src/pages/register/**` is moved to colocated
- **THEN** it is left central and the report says why
