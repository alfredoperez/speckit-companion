# Feature Specification: Decouple the install banner from the beta setting

**Feature Branch**: `354-install-banner-beta-decouple`
**Created**: 2026-06-25
**Status**: Specified
**Issue**: #369

## Overview

The banner that offers to install the SpecKit Companion spec-kit extension is currently hidden whenever the Companion workflow beta is turned off. That means the people most likely to benefit from discovering the extension — those who have not yet opted into beta — never see the nudge to install it. This change makes the banner show on its own merits: it appears when the extension is missing and the user has not turned the prompt off, no matter what the beta setting says.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the install prompt without opting into beta (Priority: P1)

A developer who has the SpecKit Companion VS Code extension but has not turned on the Companion workflow beta opens a spec. Because the spec-kit extension is not installed, the install banner appears, inviting them to install it. They can act on the prompt regardless of the beta toggle.

**Why this priority**: This is the entire point of the fix — the audience that most needs the discovery nudge is exactly the one currently denied it.

**Independent Test**: With the beta setting off and the spec-kit extension not installed, open a spec in the editor or viewer and confirm the install banner renders.

**Acceptance Scenarios**:

1. **Given** the Companion workflow beta is off **and** the spec-kit extension is not installed **and** the install prompt has not been dismissed, **When** a spec is opened in the editor or viewer, **Then** the install banner is shown.
2. **Given** the Companion workflow beta is on **and** the spec-kit extension is not installed, **When** a spec is opened, **Then** the install banner is shown (unchanged from before).

### User Story 2 - Keep every existing way to suppress the banner (Priority: P1)

A developer who has already installed the extension, dismissed the banner, or explicitly turned the install prompt off must not be bothered by the banner. Decoupling from beta must not weaken any of those existing guards.

**Why this priority**: A discovery nudge that ignores the user's explicit "no" is worse than no nudge. These guards are the zero-regression contract.

**Independent Test**: Toggle each suppressing condition (installed, dismissed, prompt off) and confirm the banner stays hidden in each, independent of the beta setting.

**Acceptance Scenarios**:

1. **Given** the spec-kit extension is installed, **When** a spec is opened, **Then** the banner is hidden (regardless of beta or prompt setting).
2. **Given** the install prompt preference is explicitly `false`, **When** a spec is opened, **Then** the banner is hidden.
3. **Given** the user dismissed the banner this session, **When** a spec is opened, **Then** the banner stays hidden.

## Edge Cases

- Beta off, extension installed → no banner (install guard wins over beta-decoupling).
- Beta off, extension missing, prompt explicitly `false` → no banner (opt-out wins).
- Legacy tri-state string still stored for the install-prompt preference → coerced to a boolean as before; decoupling does not change that coercion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The install banner's visibility MUST NOT depend on whether the Companion workflow beta is enabled.
- **FR-002**: The install banner MUST be shown when the extension is missing AND the install prompt preference is enabled (default `true`) AND the user has not dismissed it.
- **FR-003**: The install banner MUST remain hidden when the extension is installed.
- **FR-004**: The install banner MUST remain hidden when the install prompt preference is explicitly `false`.
- **FR-005**: The install banner MUST remain hidden when the user has dismissed it for the session.
- **FR-006**: Both render sites (the spec editor and the spec viewer) MUST reflect the decoupled behavior identically, since both resolve visibility through the same shared helper.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With beta off and the extension missing and the prompt not dismissed, the banner renders in 100% of editor and viewer opens.
- **SC-002**: All three suppression conditions (installed, dismissed, prompt `false`) keep the banner hidden in 100% of cases, independent of the beta setting.
- **SC-003**: The test suite covers the "beta off + extension missing → banner shows" case and passes.

## Assumptions

- The render sites already resolve banner visibility through `readInstallPromptEnabled()` + `shouldShowInstallPrompt()`, so removing the beta short-circuit inside `readInstallPromptEnabled()` is sufficient and no call-site change is required.
- The dismissal guard lives at the render sites and is unaffected by this change.

## Verbatim Constraints

- `speckit.companion.installPrompt` — the preference the banner is gated on (default `true`).
- `readInstallPromptEnabled()` — the helper whose beta short-circuit is removed.
- `shouldShowInstallPrompt(enabled, installed)` — the pure gate, unchanged.
- `installBannerDismissed` — the session dismissal flag, unchanged.

## Approach

A small, surgical change. The fix lives in one helper; the render sites already consume it correctly.

- `src/speckit/specKitExtensionInstall.ts` — in `readInstallPromptEnabled()`, remove the `if (!isCompanionWorkflowEnabled(config)) return false;` short-circuit so the result depends only on the `speckit.companion.installPrompt` preference. Drop the now-unused `isCompanionWorkflowEnabled` import. Update the JSDoc to describe the decoupled gating.
- `src/features/spec-editor/installBanner.test.ts` — add a case asserting that `shouldShowInstallPrompt(true, false)` (prompt enabled, extension missing) renders the banner, framed as the beta-off-but-visible scenario, plus a note that visibility no longer reads the beta setting.
- Verify (no change expected) the two render sites `src/features/spec-editor/specEditorProvider.ts` and `src/features/spec-viewer/specViewerProvider.ts` already gate on `shouldShowInstallPrompt(readInstallPromptEnabled(), …)`.
- `README.md` — if the install-banner section documents the beta gating, correct it to the decoupled rule.

Dependencies: none beyond the existing helpers. No webview/CSS change.
