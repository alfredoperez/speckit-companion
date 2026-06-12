# Stable companion.zip asset + re-runnable install/update command

## Overview

The documented way to install and update the spec-kit extension (`id: companion`) hardcodes a version into the download URL (tag `speckit-ext-v0.3.0` and asset `companion-0.3.0.zip`), so anyone who copied the command is frozen on whatever version was pinned at the time — there is no stable URL and no update path. This delivers a genuinely stable download URL that survives every future release and a single re-runnable install/update command, so users can always pull the newest extension by re-running one line.

## Functional Requirements

- **FR-001** The release flow MUST publish a stable-named `companion.zip` asset reachable at a URL that does **not** change between releases, in addition to the existing archival version-named `companion-<ver>.zip`.
- **FR-002** The stable URL MUST remain valid even after a newer VS Code (`v*`) release is cut. Because this is a two-product repo where `v*` (VS Code) and `speckit-ext-v*` (spec-kit ext) releases interleave in one GitHub releases list, `…/releases/latest/download/companion.zip` MUST NOT be used — GitHub's `/releases/latest` resolves to the newest non-prerelease across *both* products, so it 404s the moment the next `v*` release becomes "latest".
- **FR-003** The stable URL MUST be served from a dedicated reusable release/tag (`companion-latest`) whose `companion.zip` asset is **force-replaced** on every `/publish-speckit-ext` run, yielding `…/releases/download/companion-latest/companion.zip` — a URL immune to product interleaving.
- **FR-004** The `/publish-speckit-ext` command MUST, after cutting the normal `speckit-ext-v<X.Y.Z>` release, create-or-update the `companion-latest` release and clobber its `companion.zip` asset with the current build (so the stable URL always serves the newest version).
- **FR-005** The `companion-latest` release MUST be marked **prerelease** so it never becomes the repo's `/releases/latest` and never triggers the VS Code Marketplace publish (`release.yml` keys off `v*` tags only; `companion-latest` is a non-`v*` tag, satisfying that constraint as well).
- **FR-006** `speckit-extension/README.md` MUST document the install command using the stable `companion-latest/companion.zip` URL, and MUST include an explicit "to update, re-run the same command with `--force`" instruction.
- **FR-007** `speckit-extension/docs/install.md` MUST document the same stable install/update command and the `--force` update line.
- **FR-008** `speckit-extension/docs/publishing.md` MUST document the `companion-latest` stable-asset step as part of the release process.
- **FR-009** `speckit-extension/extension.yml` `extension.version` MUST be bumped, and `speckit-extension/CHANGELOG.md` MUST gain a user-facing entry describing the stable install/update URL. Root `README.md`/`CHANGELOG.md`/`package.json` MUST NOT be touched.
- **FR-010** No release may be published as part of this change — the flow is wired so the *next* `/publish-speckit-ext` produces the stable asset.

## Success Criteria

- **SC-001** After the next real `/publish-speckit-ext`, the stable URL returns HTTP 200 for the newest build, and continues to return 200 after a subsequent VS Code `v*` release (no product-interleaving 404).
- **SC-002** A user can install and later update the extension by running one identical command (adding `--force` to update) — zero version strings to edit.
- **SC-003** README and install.md show the stable install/update command plus an update instruction; publishing.md documents producing the stable asset on every release.
- **SC-004** `python3 speckit-extension/scripts/check-shape-parity.py` passes and the project build/test suite is green.

## Assumptions

- The robust approach is a dedicated reusable `companion-latest` prerelease (the ticket's literal `/releases/latest/download/…` acceptance criterion is unsound for this two-product repo and is deviated from deliberately — documented as such).
- The community-catalog submission (ticket item 4) is long-term and out of scope here; this change covers the stable-URL + docs portion.
- The live HTTP-200 check (SC-001) can only be verified after the next real publish, since this change does not publish a release.

## Approach

Files to touch (docs + maintainer release tooling — no extension runtime code, no root README/CHANGELOG/package.json):

- `.claude/commands/publish-speckit-ext.md` — after the existing `gh release create speckit-ext-v$V …` step, add a step that force-updates a reusable `companion-latest` **prerelease** with the same build's zip, copied to the stable asset name `companion.zip`. Implementation: `cp /tmp/cb/companion-$V.zip /tmp/cb/companion.zip`, then `gh release delete-asset companion-latest companion.zip -y` (ignore-if-absent), and either create the release if missing (`gh release create companion-latest … --prerelease --target main`) or upload the asset with `--clobber`. The `--prerelease` flag keeps it out of `/releases/latest`. Update the command's verify step and the closing "update version references" note to mention the stable URL.
- `speckit-extension/docs/publishing.md` — add the `companion-latest` stable-asset step to the Process list; note the prerelease flag and the resulting stable URL `…/releases/download/companion-latest/companion.zip`.
- `speckit-extension/README.md` — replace the two version-pinned install commands (top hero block + Installation section) with the stable `companion-latest/companion.zip` URL; add a "To update: re-run the same command with `--force`" line; bump the version badge.
- `speckit-extension/docs/install.md` — add the stable release-archive install command + the `--force` update line to the install section.
- `speckit-extension/extension.yml` — bump `extension.version` (0.3.0 → 0.4.0).
- `speckit-extension/CHANGELOG.md` — add a dated `0.4.0` section with a user-facing entry: stable install/update URL, re-runnable with `--force`.

Dependencies: docs edits are independent of each other; the publish-command edit is the load-bearing wiring. No source compilation depends on these, but `check-shape-parity.py` runs because `speckit-extension/**` changed.
