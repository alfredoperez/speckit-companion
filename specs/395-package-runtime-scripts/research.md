# Phase 0 Research: Ship every runtime script the commands call

## Decision 1 — Keep a declared packing list and compare it against a derived closure, rather than deriving the closure alone

**Decision**: `package-manifest.py` declares `RUNTIME_SCRIPTS` explicitly, and `--check` derives the closure from the shipped command bodies independently, then asserts the two sets are equal in both directions.

**Rationale**: The tempting move is to delete the list entirely and have the publish step copy whatever the scanner derives — then there is nothing to drift. But that makes the scanner a single point of silent failure: if a future script is reached by a form the scanner doesn't recognize, a pure derivation just doesn't copy it, the archive ships short, and nobody finds out until a user's install breaks — the exact failure we are fixing, reintroduced with fewer moving parts and no alarm. With a declared list, the same scanner gap instead shows up as *"declared but not derived"* and fails the build loudly. The two-way compare converts every possible disagreement — a new dependency the maintainer forgot to declare, or a reference form the scanner can't see — into a named, blocking error.

**Alternatives considered**:
- *Derived-only (no declared list)*: rejected — fails silently on a scanner gap, as above.
- *Declared-only (a list plus a "does the file exist" check)*: rejected — that is essentially today's state with a spell-checker bolted on. It cannot detect that a command has started calling something new, which is the drift that caused this bug.

## Decision 2 — Put the packing list in a script, not in `extension.yml`

**Decision**: The list lives in `speckit-extension/scripts/package-manifest.py`.

**Rationale**: `extension.yml` is the spec-kit extension manifest. It is validated against spec-kit's published schema when the catalog entry is reviewed, and it is the file the installer parses. A non-schema key such as `package.runtime_scripts` would be, at best, ignored and, at worst, a validation failure on a catalog submission — a real risk taken for a purely cosmetic gain, since nothing in spec-kit would ever read the key. A script in `scripts/` is already the repo's idiom for build-time gates (`check-shape-parity.py`, `assemble-nodes.py`, `build-commands.py`), gets to be executable rather than inert data, and can be imported by the test suite the same way the tests already import hyphenated modules by path.

**Alternatives considered**:
- *A key in `extension.yml`*: rejected — schema risk on the catalog submission, no consumer inside spec-kit.
- *A standalone `package.txt` / `MANIFEST.in`*: rejected — inert data still needs a program to check and to copy it, so it adds a file without removing one, and a plain list can't express the build-only exclusion set the check needs.

## Decision 3 — Derive the closure by scanning the installed script path form, then following sibling imports to a fixed point

**Decision**: The roots are every `.specify/extensions/companion/scripts/<name>.py` occurrence in the shipped command bodies and workflows. From each root, follow the script's own references to sibling scripts, repeating until the set stops growing.

**Rationale**: Commands invoke scripts by exactly one textual form — the installed path — which makes the root scan a precise, single-anchor regex rather than a heuristic. A direct scan alone is not enough: half the closure is reachable only indirectly (`companion_config.py` is named by no command; it is imported by the resolver and by the registration script). Following each script's own sibling references is what turns 6 directly-named scripts into the true 8.

Three reference forms occur in the codebase and the resolver must handle all three, because each is load-bearing for a different script:

| Form | Example | Why it exists |
|---|---|---|
| Plain import | `import companion_config as cc` | Underscore names are legal Python identifiers, so they import normally. |
| `importlib.import_module("…")` | `import_module("write-context")` | Hyphenated names are not legal identifiers, so they go through `import_module` with a string. |
| Load by filename | `spec_from_file_location(…, ".../resolve-spec-paths.py")` | Same hyphen problem, solved by path instead. Used by `drift.py`, `check-coverage.py`, **and `write-context.py`**. |

All three resolve to a *string literal or bare name that matches a sibling script*, so one resolver handles them: collect candidate names from the source, keep the ones that match a file in `scripts/`, discard the rest (standard-library imports fall away for free, since `os` and `json` are not sibling scripts). Fixed-point iteration with a visited set makes a dependency cycle terminate rather than spin.

**Alternatives considered**:
- *Real AST analysis / an import graph tool*: rejected — overkill for thirteen single-directory stdlib scripts, and the load-by-filename form is invisible to an import graph anyway (it is a string argument, not an import statement).
- *Ship the whole `scripts/` directory*: rejected — that is a deny-list by another name. It would drag the build/test scripts and their golden fixtures into every user's install, and the publishing doc explicitly warns against swapping the allow-list back to an exclusion list, because that is how the package silently bloated before.

## Decision 4 — Land the gate in the existing CI `capture-suite` job, via both a unittest and an explicit step

**Decision**: Add `tests/test_packaging.py` (picked up by the existing `python3 -m unittest discover -s speckit-extension/tests`) and an explicit `package-manifest.py --check` step in the `capture-suite` job, next to the `check-shape-parity.py` and `assemble-nodes.py --check` steps.

**Rationale**: The unittest is what makes the gate run for a developer locally and in the discover sweep; the explicit CI step is what makes a packaging failure *legible* in the CI log as a packaging failure rather than as one red test among many. The two sibling gates in that job already follow this shape, so this matches the established pattern rather than inventing a new one. This is the job that must go red, because it is the one that stands between a merge and a release.

**Alternatives considered**:
- *A new check inside `check-shape-parity.py`*: rejected — that script's contract is command-body parity (part fences, golden equality, timing fences). Packaging is an unrelated concern, and folding it in would muddy a script whose docstring is a precise three-assertion contract.
- *Only a CI step, no test*: rejected — it would not fail for a developer running the suite locally before pushing.

## Decision 5 — Patch-level version bump

**Decision**: `0.18.0` → `0.18.1`.

**Rationale**: Nothing about the extension's interface, commands, or behavior changes for a user who somehow already had a working install. Files that were always supposed to be in the package are now in the package. That is the definition of a patch.
