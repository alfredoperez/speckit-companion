# Launch prep: spec-kit extension discovery, safety & one-click install

## Overview

A user who installs the SpecKit Companion VS Code extension is guided to install the companion **spec-kit CLI extension** in one click, nothing breaks if they have not, and the README sells and explains the value. The whole ticket reduces to two primitives — **detect** the spec-kit extension's install state, and a single **install/update** terminal action — with every UI surface (Create-Spec banner, Activity banner, sidebar affordance, upgrade menu) a thin consumer, plus a README launch overhaul.

## Functional Requirements

- **FR-001**: The extension MUST expose a single detection signal for whether the companion spec-kit extension is installed in the open project, reusing the existing on-disk check `isCompanionInstalled()` (presence of `.specify/extensions/companion/`). No VS Code marketplace lookup.
- **FR-002**: The detection signal MUST treat a preset-only project (presets present, extension dir absent) as **not installed**, because presets only swap `/speckit.*` bodies and never register the `/speckit.companion.*` family.
- **FR-003**: When a setting that hard-depends on the spec-kit extension is active (`templateProfile: turbo`, or the capture lifecycle hooks) and the extension is missing, the extension MUST fall back to the stock `/speckit.*` flow and surface a non-blocking warning, and MUST NEVER dispatch a `/speckit.companion.*` command the AI CLI cannot resolve.
- **FR-004**: The extension MUST provide one command (`speckit.companion.installSpecKitExtension`) that runs the install/update in a VS Code integrated terminal using `specify extension add companion --from <RELEASE_URL> --force`.
- **FR-005**: The release URL and the post-catalog by-name form MUST be defined in exactly one place as named constants (`RELEASE_URL`, `BY_NAME_INSTALL`) with a single clearly-marked TODO to switch to the by-name form once the catalog lists the extension.
- **FR-006**: The install action MUST also surface the prerequisite that the end user needs a github-source spec-kit CLI (stock PyPI `specify-cli` lacks the `extension` subcommand): `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force`.
- **FR-007**: The Create-Spec panel MUST show an install banner ONLY when the spec-kit extension is missing AND the relevant beta/feature flag is on, with a one-click install button and a README fallback link.
- **FR-008**: The Activity panel MUST show the same install banner under the same missing-and-flagged condition, with the same one-click install button and README fallback link.
- **FR-009**: The sidebar MUST offer a visible install affordance (icon + action) for the spec-kit extension, shown when it is missing.
- **FR-010**: The sidebar upgrade menu MUST add an "update spec-kit extension" entry alongside the existing upgrade control, running the same install/update action with `--force`.
- **FR-011**: Users who already have the spec-kit extension installed MUST see no install banners, no install affordance, and no fallback warnings — zero regression.
- **FR-012**: The root `README.md` MUST be overhauled with benefits, a per-feature explanation, install instructions for both extensions, and a mode-comparison section. Images MUST be explicit `![alt](docs/screenshots/<name>.png)` placeholders each preceded by an HTML `<!-- 🎨 IMAGE: <prompt> -->` comment; mode-comparison stats MUST be `<!-- TODO(eval): … -->` placeholders, never fabricated numbers.
- **FR-013**: All new behavior MUST live in `src/`, `webview/`, and `package.json` — never in `.claude/` or `.specify/` (reading `.specify/` for detection is allowed).

## Success Criteria

- **SC-001**: A user without the spec-kit extension sees a clear install prompt in BOTH the Create-Spec and Activity panels and can start the install without leaving the editor.
- **SC-002**: Turning on a feature that needs the spec-kit extension when it is missing produces zero broken or errored commands — the basic stock flow runs and the missing piece is explained.
- **SC-003**: The sidebar shows a visible install affordance when the extension is missing, and the upgrade control can also update it.
- **SC-004**: The README explains benefits and each feature (with image placeholders), shows install for both extensions, and has a mode-comparison section (with stat placeholders) — zero fabricated numbers, every image listed.
- **SC-005**: Users who already have the spec-kit extension see none of the above prompts (no banners, no warnings).
- **SC-006**: `npm run compile` is clean and `npm test` is green, including new unit tests for the detection→fallback logic and the gated banner/affordance visibility (missing vs installed).

## Assumptions

- The spec-kit extension is published at release `speckit-ext-v0.3.0`; install works today via the `--from <url>` release form. The by-name form resolves only after github/spec-kit's catalog review, so the install action ships against `--from <url>` with a constant/TODO to swap later.
- `isCompanionInstalled()` in `src/features/settings/companionPresetReconciler.ts` (added in #218) is the canonical detection primitive and is reused, not reimplemented.
- The existing beta-flag/badge precedent (`speckit.viewer.activityPanel` config pattern) is followed for the new banner gate, so banners can be flag-gated without new infrastructure.
- The terminal install action is the only install path — the spec-kit extension is a spec-kit CLI extension, not a VS Code marketplace extension, so there is no `vscode.extensions` install route.
