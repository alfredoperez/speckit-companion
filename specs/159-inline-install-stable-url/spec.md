# Inline Install URL → stable rolling asset

> Resolves [#283](https://github.com/alfredoperez/speckit-companion/issues/283). Supersedes the residual of [#276](https://github.com/alfredoperez/speckit-companion/issues/276) (three of its four pinned URLs were already fixed by #280; this closes the fourth — the extension-code copy).

## Overview

The VS Code extension's in-editor "Install / Update spec-kit Extension" action is hardcoded to a version-pinned download URL (`speckit-ext-v0.3.0`), so every install banner and the Upgrade-menu update row install **v0.3.0** — now older than the shipped build, making "Update" a silent downgrade. This points that one remaining URL at the stable rolling asset the publish flow already maintains, so the in-editor action always pulls the newest extension and never needs a per-release edit again.

## Functional Requirements

- **FR-001** — The in-editor "Install spec-kit Extension" and "Update spec-kit Extension" actions MUST install the newest published spec-kit extension build, never a version-pinned older release.
- **FR-002** — The extension-code install URL MUST contain no version string (no `speckit-ext-vX.Y.Z` tag, no `companion-X.Y.Z.zip` asset); it MUST resolve to the stable rolling asset `…/releases/download/companion-latest/companion.zip`.
- **FR-003** — Publishing a new spec-kit-extension version MUST NOT require republishing the VS Code extension to keep the in-editor install URL current (zero code edits per release).
- **FR-004** — All in-editor install/update entry points (spec-editor banner, spec-viewer Activity-panel banner, Specs-view Upgrade… → Update spec-kit Extension, the `installSpecKitExtension` command) MUST funnel through the single shared URL constant — no caller carries its own pinned URL.
- **FR-005** — The catalog by-name switch (`USE_BY_NAME_INSTALL` / `BY_NAME_INSTALL`) MUST remain unchanged as the long-term by-name install path.
- **FR-006** — An automated test MUST guard the no-version-string invariant so a reintroduced pinned URL fails the suite.
- **FR-007** — The spec-kit-extension publish checklist MUST include a pre-tag verification that no version-pinned install download URL remains in shipped code or docs, so the treadmill cannot silently return.

## Success Criteria

- **SC-001** — After the fix, the in-editor Install/Update action installs the latest published spec-kit extension version (≥ current shipped), never v0.3.0.
- **SC-002** — A version-pattern grep over the shipped install path returns **0** matches.
- **SC-003** — Releasing a new spec-kit extension version requires **0** edits to VS Code extension code to keep the in-editor install current.
- **SC-004** — **100%** of in-editor install/update entry points resolve to the same single URL constant.
- **SC-005** — The test suite goes red if a version-pinned install URL is reintroduced (≥1 guarding test).
- **SC-006** — The publish checklist contains **1** verification step that blocks tagging when a version-pinned install URL is present.

## Assumptions

- The stable rolling asset `…/releases/download/companion-latest/companion.zip` is already live and serves the newest build — it is created/refreshed by the existing `/publish-speckit-ext` flow (publishing.md step 7) and is already the URL both READMEs and the catalog `download_url` use. This change only points the code at it; it does not change how that asset is produced.
- `--force` on `specify extension add` already makes the single command an idempotent install-or-update, so no separate update URL is needed.
- The README/docs copies of the install URL were migrated to the stable asset by #280; only the extension-code copy remains, so this change is code + a publish-checklist guard.
- GitHub retains old release assets, so the pinned `speckit-ext-v0.3.0` archive stays downloadable — anyone who copied the old URL is unaffected.
- The catalog by-name path stays off (`USE_BY_NAME_INSTALL = false`) until the spec-kit catalog lists the extension; flipping it is out of scope here.

## Approach

- **`src/speckit/specKitExtensionInstall.ts`** — replace the `RELEASE_URL` value with `https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip` and rewrite its doc comment to describe a stable rolling asset (drop the "v0.3.0 / install works TODAY" framing). Leave `USE_BY_NAME_INSTALL`, `BY_NAME_INSTALL`, and `buildInstallCommand()` untouched — they already interpolate `RELEASE_URL`, so every caller (FR-004) follows automatically.
- **`src/speckit/specKitExtensionInstall.test.ts`** — add a regression test asserting `RELEASE_URL` equals the stable asset and matches no version pattern (`/speckit-ext-v\d/`, `/companion-\d/`). The existing interpolation test keeps passing unchanged.
- **`speckit-extension/docs/publishing.md`** — add a short pre-tag verification: grep the shipped install path + docs for a version-pinned download URL; it must return nothing. Keeps the eliminated treadmill from sneaking back (FR-007 / SC-006).
- **`CHANGELOG.md`** (root) — one user-facing entry: the in-editor Install/Update action now always pulls the newest spec-kit extension instead of a pinned older version.
- **Dependencies**: T002 depends on T001 (test asserts the new value); T003 and T004 are independent docs/changelog edits and can run in parallel.
