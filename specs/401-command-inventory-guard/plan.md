# Implementation Plan: Guard the command inventory against drift, and complete the command reference

## Summary

The extension declares seventeen commands in its manifest, but nothing checks that the rest of the world agrees with that list. This feature adds one check that reads the manifest as the single authority and holds three downstream surfaces against it: the command files the installer writes into each AI tool's directory, the project's install records, and the two documents that describe the commands. It reports every disagreement by name and exact path and fails the build on any of them.

The check is a stdlib-only Python script alongside the repository's existing manifest-versus-disk guards, so it joins the same CI sweep with no new tooling. It reuses the manifest reader already in the shared helper module rather than parsing the manifest a second time — and to keep that genuinely single-sourced, the packaging guard's own manifest read is repointed at the same helper instead of keeping its private copy.

Two repairs ride along, both of them things the new check reports on its first run: this project's install records still describe the pre-rename command set, and the two documents are missing one and eleven commands respectively.

## Project Structure

```
speckit-extension/
├── extension.yml                        # authority: provides.commands (17 entries) — unchanged
├── scripts/
│   ├── _command_parts.py                # + declared_commands(): the one manifest-name reader
│   ├── package-manifest.py              # repointed at the shared reader (drops its private regex)
│   └── check-command-emissions.py       # NEW — the drift check
├── tests/
│   └── test_command_emissions.py        # NEW — one failing case per drift direction
├── README.md                            # Commands table: regrouped by family, +living-move
├── docs/commands.md                     # completed to all 17 commands
└── CHANGELOG.md                         # [Unreleased] entry

.specify/                                # tracked install records — repaired
├── extensions.yml                       # hooks: 4 capture steps → current names
└── extensions/.registry                 # registered_commands: 8 retired names → current, per agent

.github/workflows/ci.yml                 # runs the new check alongside the existing gates
```

**Structure Decision** — The check lives in `speckit-extension/scripts/` next to `check-shape-parity.py` and `package-manifest.py`, which are the repository's existing manifest-versus-reality gates; it follows their shape (stdlib only, a `check()` returning a list of problem strings, `main()` printing them and returning an exit code) so the test suite and CI pick it up unchanged.

## Constitution Check

| Principle | Assessment |
|---|---|
| Extension isolation — the shipped extension must not depend on `.claude/**` or `.specify/**` | **PASS.** The check is a repository-maintenance gate, not runtime behavior. It is not on any path the installed extension executes, and no shipped command body calls it. It *reads* `.specify/` and the install areas, which is exactly what a maintenance gate should do; nothing at runtime gains a dependency on them. |
| Two extensions, two sets of docs | **PASS.** Every change is under `speckit-extension/` or is install state, so the spec-kit extension's own README and CHANGELOG are updated and the root ones are not. |
| The release flow owns the version bump | **PASS.** No version is touched. The changelog entry goes under `[Unreleased]`; `extension.yml` `version`, the README badge, and `publishing.md` are left alone. |
| A release-critical list written as prose will drift — make it machine-readable and gate it | **PASS.** This is the principle the feature implements. The command inventory currently lives as prose in two documents and as records in two install files, checked by nothing; after this change all four are gated against `extension.yml`. |
| One fact, one derivation | **PASS**, and improved. The new check does not introduce a second manifest reader — it adds one to the shared helper module and repoints the existing packaging guard at it, so the repository ends with fewer manifest parsers than it started with. |
| Stdlib only | **PASS.** No `yaml` module is available in this environment, so the manifest reader stays a narrow regex over the `provides.commands` block, consistent with the existing tooling. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md) for the decisions and the alternatives rejected.

## Phase 1 — Design & contracts

- [data-model.md](./data-model.md) — the entities the check reasons about and the two naming translations it performs.
- [contracts/check-command-emissions.md](./contracts/check-command-emissions.md) — the script's invocation, output shape, exit codes, and the exact problem strings each drift direction produces.
