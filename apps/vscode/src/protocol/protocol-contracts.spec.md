# Protocol Contracts — Living Spec

## Purpose

The message shapes and small runtime guards shared between the extension host and its webviews: the pipeline graph protocol, the spec viewer's message types, the spec editor's upload limits, and the install banner's shared markup.

## Requirements

### A build's staleness is one derived flag, not re-computed per caller
<!-- touches: apps/vscode/src/protocol/pipeline.ts -->

Whether a pipeline needs a build SHALL be true exactly when its build state is `stale` or `never-built`, and every reader of the graph SHALL treat the failure shape the same way: a graph carrying an `error` field is not a drawable graph.

#### Scenario: a graph's build state is `never-built`
- **WHEN** a caller asks whether it needs a build
- **THEN** the answer is true

#### Scenario: a graph response carries an `error` field
- **WHEN** a caller checks whether the response is a graph or a failure
- **THEN** it is recognized as a failure and not drawn as a pipeline

### An attachment is refused before it reaches the extension host
<!-- touches: apps/vscode/src/protocol/spec-editor.ts -->

A drafted spec's image, attachment and draft text SHALL be held to fixed size and count ceilings, so a caller can refuse an oversized attachment locally instead of discovering the limit on write.

#### Scenario: an image exceeds the per-image byte ceiling
- **WHEN** the editor checks it against `SIZE_LIMITS`
- **THEN** the image is refused before it is added to the draft

### A version rendered into the install banner cannot break out of its attribute
<!-- touches: apps/vscode/src/protocol/installBannerBody.ts -->

A version string interpolated into the banner's markup SHALL render only when it matches a plain `major.minor.patch` shape; anything else SHALL render as empty rather than passed through, because this markup reaches the page through `innerHTML`.

#### Scenario: a malformed or attacker-controlled version string is rendered
- **WHEN** the banner is built with it
- **THEN** the version field renders empty and adds no attribute or element

### The install and update banners share one body, so both surfaces agree
<!-- touches: apps/vscode/src/protocol/installBannerBody.ts -->

The extension-side banner and the webview's own rendering SHALL build the same markup, classes, `aria-label` and `data-*` attributes from the same prompt, and clicking a rendered banner SHALL recover the prompt that built it from those attributes alone.

#### Scenario: a rendered banner is clicked
- **WHEN** its `data-*` attributes are read back
- **THEN** the recovered prompt matches the one the banner was built from, defaulting to an install prompt when no update kind is present

## Uncovered

_`viewer.ts` holds the spec viewer's message-type declarations (`ViewerToHost`, `HostToViewer`, `NavState`) and a re-export from `installBannerBody.ts`; it carries no runtime behavior of its own — the behavior those messages drive is described in the `spec-viewer-*` specs that send and receive them. `pipeline.ts`'s graph and message types are likewise structural beyond the two guards above, described where the pipeline builder specs use them._
