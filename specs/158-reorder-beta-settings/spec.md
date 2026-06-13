# Reorder Beta Features Settings and Mark Spec-Kit-Extension Dependencies

## Overview

Reorder the "Beta Features" settings in VS Code Settings to follow the adoption funnel instead of alphabetical order, and make explicit — with a consistent note and an install link — which toggles only function when the companion spec-kit extension is installed. This helps users understand what to enable first and why some toggles appear inert without the extension.

## Functional Requirements

- **FR-001** The Beta Features settings MUST display in this deliberate order: install prompt, template profile, turbo workflow picker, complexity fast path, resume, activity panel.
- **FR-002** Each setting that depends on the companion spec-kit extension MUST state that dependency in its description using consistent wording.
- **FR-003** Each dependency note MUST include a link to the README section explaining how to install the spec-kit extension.
- **FR-004** Settings that function without the spec-kit extension (the install prompt) MUST NOT carry a dependency note.
- **FR-005** The default value and runtime behavior of every Beta Features toggle MUST remain unchanged.
- **FR-006** The README "Configuration" section MUST be updated to reflect the new ordering and dependency notes in the same change.

## Success Criteria

- **SC-001** Opening VS Code Settings shows the six Beta Features toggles in the funnel order (install → template profile → turbo picker → fast path → resume → activity panel), 100% of the time.
- **SC-002** Every dependency-bearing toggle (template profile, turbo picker, fast path, resume, activity panel) shows the dependency note with a clickable install link; the install-prompt toggle shows none.
- **SC-003** All dependency notes use identical wording.
- **SC-004** Every toggle's default and behavior is byte-for-byte unchanged from before the change (only ordering and description text differ).

## Assumptions

- The README anchor for install instructions is `#install-the-spec-kit-extension` (the actual heading is `## Install the spec-kit Extension`); the originally-assumed `#installing-the-spec-kit-extension` does not exist, so the link target was adjusted to match.
- Dependency wording follows the issue suggestion: "Requires the [companion spec-kit extension](…)."
- Descriptions carrying a markdown link use `markdownDescription` (links do not render in plain `description`); descriptions without a link may stay as `description`.
- "Order" is expressed via the VS Code `order` property (1–6) on each setting; explicit numbering overrides the default alphabetical sort.
- The install prompt is treated as not depending on the extension because its purpose is to surface the missing extension.

## Approach

Files to touch:

- **`package.json`** — In the "Beta Features" configuration block (currently ~l.1023–1073), add an `order` property to each of the six settings following the funnel (`installPrompt`=1, `templateProfile`=2, `turboWorkflowPicker`=3, `complexityFastPath`=4, `resumeBeta`=5, `viewer.activityPanel`=6). For the five dependency-bearing settings, convert `description` → `markdownDescription` and append the consistent note: `Requires the [companion spec-kit extension](https://github.com/alfredoperez/speckit-companion#install-the-spec-kit-extension).` Leave `installPrompt` without a note. Do not change any `default`, `type`, `enum`, or `scope`.
- **`README.md`** — Update the "Configuration" section (Beta Features subsection) to reflect the new ordering and note which settings require the spec-kit extension, with the same install link. The actual heading is `## Install the spec-kit Extension`, so the link target is `#install-the-spec-kit-extension`.

Dependencies / ordering: README edit depends on confirming the install-instructions heading/anchor in the same file. No code/runtime changes — this is configuration metadata and docs only.
