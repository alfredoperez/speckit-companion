# Fix stale publisher handle "alfredo-dev"

## Overview

The extension is published under the `alfredoperez` publisher (`alfredoperez.speckit-companion`), but the repository still references the retired `alfredo-dev` handle in several places. The dead handle silently disables the in-app update check and points install/listing links at a non-existent (404) Marketplace/OpenVSX listing. This change replaces every stale reference with the correct handle and hardens the update checker so it identifies itself by its real extension id and only compares against VS Code releases.

## Functional Requirements

- **FR-001** The system MUST resolve the current extension version using the extension's own id rather than the hardcoded stale handle, so the in-app update check can read the installed version.
- **FR-002** The update checker MUST select the newest release whose tag matches a VS Code version tag (`v<major>.<minor>.<patch>`) and MUST ignore spec-kit extension releases (`speckit-ext-v*`) when determining whether a newer version is available.
- **FR-003** Every occurrence of the publisher handle `alfredo-dev.speckit-companion` in source, CI workflows, editor config, and documentation MUST be replaced with `alfredoperez.speckit-companion`.
- **FR-004** The OpenVSX listing reference using the `alfredo-dev` namespace MUST be replaced with the `alfredoperez` namespace.
- **FR-005** After the change, no reference to the `alfredo-dev` handle MUST remain anywhere in the tracked repository (excluding build artifacts under `dist/`).
- **FR-006** All install commands and Marketplace/OpenVSX listing links MUST resolve to the live `alfredoperez` listing.

## Success Criteria

- **SC-001** With an outdated version installed, the in-app update notification fires and the output log records the current installed version (no "Could not get current extension version" bail).
- **SC-002** The update checker compares the installed version only against VS Code (`v*`) releases and never against `speckit-ext-v*` releases.
- **SC-003** A repository-wide search for `alfredo-dev` (excluding `node_modules`, `.git`, and `dist/`) returns zero matches.
- **SC-004** Every install command and listing link in the repo points at `alfredoperez.speckit-companion` and resolves (HTTP 200).

## Assumptions

- `alfredoperez` is the correct, settled publisher identity everywhere; `alfredo-dev` is purely leftover. `package.json` `publisher` has been `alfredoperez` since 2025-12-02.
- Build artifacts under `dist/` are regenerated on compile and are not edited by hand; they are excluded from the stale-handle sweep.
- The GitHub releases list co-mingles two products (VS Code `v*` and spec-kit `speckit-ext-v*`); the update checker is concerned only with the VS Code product.
- The OpenVSX namespace mirrors the publisher handle (`alfredoperez`).

## Approach

Files to touch:

- `src/speckit/updateChecker.ts` — replace `getExtension('alfredo-dev.speckit-companion')` with id derived from `this.context.extension.id`; replace the `/releases/latest` fetch with a `/releases` fetch that filters to tags matching `^v\d+\.\d+\.\d+$`, sorts, and picks the newest (ignoring `speckit-ext-v*`). Reuse the existing `isNewerVersion` comparison.
- `.github/workflows/release.yml` — replace `alfredo-dev` in the two `--install-extension` lines, the Marketplace `itemName` URL, and the OpenVSX URL.
- `.vscode/launch.json` — replace `alfredo-dev` in the `--enable-proposed-api` arg.
- `speckit-extension/README.md` — replace `alfredo-dev` in the two Marketplace links and the `--install-extension` command.
- `CHANGELOG.md` — add a user-facing entry (update notifications fire again; install links resolve).

Dependencies: none. The `GitHubRelease` type already carries `tag_name`; fetching an array of releases needs no new type beyond `GitHubRelease[]`.
