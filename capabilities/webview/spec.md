# Webview — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The webview layer is every pixel the extension renders inside VS Code: the spec editor, the workflow/document view, and the shared markdown, rendering, theming, and component utilities they all sit on. Without a single set of rules here, each webview re-invents escaping, theming, and messaging — and the ones that get it wrong ship an injection hole or an unreadable panel in someone's theme.

## Requirements

### Untrusted text never reaches markup as an attribute value

Any value that originates outside the rendering code — file content, filenames, workflow definitions, error text — MUST be placed into the DOM as element content or via explicit attribute-setting APIs. It MUST NOT be interpolated into an attribute position inside a string that is later assigned as markup, because the shared escaping helper neutralizes tag delimiters but not attribute quotes.

#### Scenario: Filename containing a quote character

- **WHEN** an attached image whose name contains a double quote is rendered into the attachment list
- **THEN** the name appears verbatim as visible text and inside the accessible label of its remove control
- **AND** no part of the name is interpreted as markup or as an additional attribute

#### Scenario: Externally authored workflow metadata

- **WHEN** the editor renders a chooser from workflow definitions supplied by configuration
- **THEN** each option's label and description are carried by DOM APIs rather than string interpolation into markup
- **AND** a definition containing quotes or angle brackets changes only what the user reads, never the document structure

### Rendered markdown escapes its source before applying inline formatting

The markdown pipeline MUST neutralize the source text's markup characters before it substitutes its own emphasis, code, and link elements, so that only formatting the pipeline itself introduces can become live markup.

#### Scenario: Spec document containing raw markup

- **WHEN** a spec line contains an inline script or tag written literally in the file
- **THEN** the line renders as visible literal text
- **AND** surrounding bold, italic, code, and link syntax in the same line still renders as formatting

### Screen-reader-only content stays in the accessibility tree

Content that exists only for assistive technology — status regions, form guidance, and any node referenced by a describing or labelling relationship — MUST be hidden with a visually-hidden technique that keeps the node rendered. It MUST NOT use `hidden` or `display: none`, which remove the node from the accessibility tree and silence the reference.

#### Scenario: A description target that is invisible on screen

- **WHEN** an input declares that its description lives in another node and that node is not meant to be seen
- **THEN** the node is clipped or moved off-screen rather than removed from layout
- **AND** the description is announced when the input receives focus

#### Scenario: Counter below its reveal threshold

- **WHEN** the character counter is under the threshold at which it becomes visible
- **THEN** it is visually hidden but still announced on demand, rather than dropped from the page

### Long-running work marks the content region busy and announces itself

While a webview is waiting on the extension, it MUST set the busy state on the content region that has become unusable — not on the transient overlay covering it — and MUST push a short human-readable message into a polite live region so the wait is perceivable without sight.

#### Scenario: Submitting a spec draft

- **WHEN** the extension signals that submission started
- **THEN** the page's content region is marked busy and every submit-path control is disabled
- **AND** a message describing what is happening is announced
- **AND** on completion or error the busy state and control disabling are both reverted

### Webviews inherit color and typography from the host theme

All webview styling MUST resolve through a shared token layer backed by VS Code's own theme variables, with hard-coded values used only as fallbacks. The token layer MUST provide per-theme overrides for light, dark, and high-contrast, and high contrast MUST NOT dilute foreground colors for hierarchy.

#### Scenario: User switches to a light theme

- **WHEN** the host theme changes
- **THEN** backgrounds, text, borders, and code colors follow without any webview restart
- **AND** diagram rendering is re-themed to match rather than staying on the previous palette

#### Scenario: High contrast is active

- **WHEN** the host is in a high-contrast theme
- **THEN** secondary and label text render at full foreground strength
- **AND** hierarchy is carried by size and weight instead of reduced contrast

### Subdued text tokens are justified by measured contrast, not by an assumed rendered color

Tokens derived by mixing the theme foreground toward transparency MUST be documented by the contrast ratio they are intended to clear, and readable body content MUST use the primary or body token rather than the metadata tokens.

#### Scenario: Reviewing a token that composites over its background

- **WHEN** a subdued token is defined as a partial mix of the theme foreground
- **THEN** its note states the contrast target it satisfies against the theme's background
- **AND** it does not claim a single fixed resulting color, since the value composites over whatever sits behind it

### Every message crossing the extension boundary belongs to a declared message set

Each webview MUST declare the full set of messages it can send and receive as a closed discriminated union keyed by a type field, and MUST ignore messages whose type is not in that set rather than acting on unrecognized input.

#### Scenario: An unrecognized message arrives

- **WHEN** the webview receives a message with a type it does not declare
- **THEN** nothing is rendered or dispatched and the webview stays in its current state

#### Scenario: A component needs to talk to the extension

- **THEN** it sends through the typed dispatch path so the message shape is checked at compile time
- **AND** cross-cutting concerns can later be added in one place rather than at every call site

### The webview asks for its initial state rather than assuming it arrived

A webview MUST signal readiness to the extension after its document is initialized and MUST populate workflow-dependent or configuration-dependent UI only from the state the extension sends back, so a slow or re-created panel never renders against stale or missing input.

#### Scenario: Panel restored after a reload

- **WHEN** the webview finishes initializing
- **THEN** it announces readiness before expecting configuration
- **AND** selectors and action buttons are built from the state the extension replies with

### Unsent user input survives webview teardown

Draft text and its attachment references MUST be persisted to the host-provided webview state on a debounce and restored on the next load, including the caret position, so hiding and reopening a panel does not lose typing.

#### Scenario: User types, switches away, comes back

- **WHEN** the panel is hidden and later restored
- **THEN** the previously typed content and caret position are restored
- **AND** derived UI such as the counter and the submit gate are recomputed from the restored content

### Destructive actions are gated by a second deliberate step or an undo window

An action that discards user work MUST NOT complete on a single unconfirmed activation. It MUST either require a second activation inside a short arming window, offer a time-boxed undo before the effect settles, or prompt for confirmation.

#### Scenario: Cancelling a draft with content

- **WHEN** the user cancels while the draft has non-whitespace content
- **THEN** confirmation is requested before the draft is discarded
- **AND** cancelling an empty draft proceeds without a prompt

#### Scenario: Arming window expires

- **WHEN** a two-click confirm is armed and the window elapses without a second activation
- **THEN** the control silently reverts to its unarmed state and the action does not fire

#### Scenario: Undo offered during a countdown

- **WHEN** an action is pending behind a countdown and the user activates undo or presses Escape
- **THEN** the pending action never fires
- **AND** the action fires exactly once if the countdown instead completes

### Delegated click handlers verify the event target before treating it as an element

Handlers that resolve a click by walking up from the event target MUST confirm the target is an element first, because it can be a non-element event target and the traversal would otherwise throw and dead-end the whole delegated region.

#### Scenario: Click lands on a non-element node

- **WHEN** a delegated handler receives an event whose target is not an element
- **THEN** the handler returns without error
- **AND** subsequent clicks on real controls in the same region still work

### Interactive primitives come from the shared component layer with a visual baseline

Buttons, badges, cards, inputs, tooltips, empty states, and toasts MUST be taken from the shared component catalogue rather than re-implemented per webview, and a non-trivial shared component MUST ship a story exercising its variants and states so the visual baseline stays honest.

#### Scenario: A new interactive affordance is needed

- **WHEN** a webview needs a primitive the catalogue already covers
- **THEN** it consumes the shared component instead of introducing parallel markup and styling

#### Scenario: A shared component gains a state

- **WHEN** a variant or state is added to a shared component
- **THEN** its story is updated in the same change to render that state

## Uncovered

- `webview/src/shared/components/*.stories.tsx` and `webview/src/spec-editor/__stories__/CreateSpec.stories.tsx` — story files were not read; the story-coverage requirement is stated from the catalogue's own documented convention rather than from the stories themselves. [inferred]
- `webview/src/spec-editor/__tests__/submitGate.test.ts` — not read.
- `webview/src/.DS_Store` — not source.
- `webview/src/spec-viewer/**` — out of scope; covered by its own leaf capability.
