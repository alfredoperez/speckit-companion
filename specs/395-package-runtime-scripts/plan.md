# Implementation Plan: Ship every runtime script the commands call

**Branch**: `395-package-runtime-scripts` | **Spec**: [spec.md](./spec.md) | **Issue**: #432
**Size**: `normal`

## Summary

The spec-kit extension's release archive is assembled from a hand-typed `cp scripts/…` line that is duplicated in two documents and checked by nothing. It has fallen three scripts behind the eight the shipped commands actually invoke, so `/speckit.companion.adopt`, `.drift`, and `.coverage` cannot run at all from a real install, and `specify` / `plan` silently lose their living-spec context.

The fix introduces one machine-readable packing list — `speckit-extension/scripts/package-manifest.py` — that both consumers read: a `--check` mode that gates the build, and a `--copy-to <dir>` mode that the publish flow uses to fill the archive. The check derives what the commands *actually* need (scan the shipped command bodies for the installed script path form, then follow each script's own sibling imports to a fixed point) and asserts that derived set equals the declared list in both directions. A needed-but-unpacked script fails the build and names itself; so does a packed-but-unneeded one. The declared list is kept rather than replaced by the derived set on purpose: if the scanner ever misses a reference form, a bare derivation would silently drop a script, whereas the two-way compare turns any disagreement — scanner gap or new dependency — into a loud failure.

No command body text changes, so the existing golden/part-parity gates stay untouched.

## Project Structure

```
speckit-extension/
├── scripts/
│   ├── package-manifest.py        # NEW — the single packing list + --check / --copy-to
│   ├── write-context.py           # runtime (ships)
│   ├── status-context.py          # runtime (ships)
│   ├── derive-from-files.py       # runtime (ships)
│   ├── resolve-spec-paths.py      # runtime (ships)  ← was missing from the archive
│   ├── companion_config.py        # runtime (ships)  ← was missing
│   ├── register-capability.py     # runtime (ships)  ← was missing
│   ├── drift.py                   # runtime (ships)  ← was missing
│   ├── check-coverage.py          # runtime (ships)  ← was missing
│   ├── build-commands.py          # build-only (never ships)
│   ├── check-shape-parity.py      # build-only
│   ├── assemble-nodes.py          # build-only
│   ├── capture-golden.py          # build-only
│   └── _command_parts.py          # build-only
├── tests/
│   └── test_packaging.py          # NEW — runs the gate under the CI unittest discover
├── docs/publishing.md             # step 5 stops restating the file list
├── README.md                      # what ships in the archive
└── CHANGELOG.md                   # user-facing entry under [Unreleased]

.claude/commands/publish-speckit-ext.md   # step 5 stops restating the file list
.github/workflows/ci.yml                  # capture-suite gains the packaging gate
```

**Structure Decision**: The packing list lives in `scripts/` next to the scripts it lists, as a normal CLI script matching the repo's existing `check-*.py` / `build-*.py` convention (hyphenated name, CLI-invoked, importable by path the way the tests already import hyphenated modules). It deliberately does **not** go into `extension.yml`: that manifest is validated against spec-kit's own published schema by the catalog, and adding a non-schema key risks a rejected submission for no gain.

## Constitution Check

| Principle | Assessment |
|---|---|
| Extension isolation — extension behavior must not depend on `.claude/**` or `.specify/**` source files | **PASS**. This change is exactly *about* isolation: it makes the shipped archive self-sufficient. The gate proves every script a shipped command reaches for is inside the package. No runtime behavior is added that reads dev-workspace files. |
| Two extensions, two sets of docs | **PASS**. Everything user-facing lands in `speckit-extension/README.md` and the `[Unreleased]` section of `speckit-extension/CHANGELOG.md`; `/publish-speckit-ext` owns the `extension.yml` version bump at release time. The root README/CHANGELOG/`package.json` are untouched. `.github/workflows/ci.yml` and `.claude/commands/publish-speckit-ext.md` are shared repo tooling, not either extension's docs. |
| A shipped command or script must be declared or the installer skips it | **PASS**. `package-manifest.py` is build-only and is intentionally *not* declared in `provides.commands` — it never ships. The eight runtime scripts are not commands and need no manifest entry; they need to be in the *archive*, which is precisely what this change guarantees. |
| Docs are part of the change | **PASS**. `docs/publishing.md`, the extension README, and the CHANGELOG are updated in this same change. |
| Changelog voice — user-facing, no internal file/symbol names | **PASS**. The entry describes the commands that now run, not the scripts or the scanner. |
| No spec/PR identifiers or narrative comments in code | **PASS**. The new script is documented by a short module docstring stating the contract; no `(#432)` markers, no history narration. |

No violations. No Complexity Tracking table needed.

## Phase 0 — Research

See [research.md](./research.md). The load-bearing findings: the closure is eight scripts (confirmed by following all three sibling-import forms to a fixed point, including a fourth reference site inside `write-context.py` that loads the resolver by filename); and a declared-plus-derived two-way compare is strictly safer than a pure derivation.

## Phase 1 — Design

- [data-model.md](./data-model.md) — the packing list, the reference scan, and the closure.
- [contracts/package-manifest-cli.md](./contracts/package-manifest-cli.md) — the `--check` / `--copy-to` / `--list` interface both consumers code against.

Constitution re-checked against the final design: still all PASS.

## Approach

1. Write `package-manifest.py`: declared `RUNTIME_SCRIPTS` (8) and `BUILD_ONLY` (5), a reference scanner over the shipped command bodies, a transitive sibling-import resolver with cycle protection, and the three CLI modes.
2. Wire the gate into CI and into a unittest so it runs under the existing `unittest discover`.
3. Repoint both publish documents at `--copy-to`, deleting the hand-typed file lists.
4. Write the README entry and the CHANGELOG entry under `[Unreleased]`; the release flow bumps the version when it cuts the build.
5. Prove it: build an archive with the new step and confirm all eight scripts land and every build-only script stays out; run each previously-broken command's script against a real spec dir from inside a scratch install.
