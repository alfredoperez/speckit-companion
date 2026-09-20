# Viewer Living Cards — Living Spec

## Purpose

How the webview renders a living spec: an outline navigable by requirement, and requirement cards whose edges, pills and links show each requirement's state, source and relationships.

## Requirements

### A living spec is navigable by requirement
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts -->

A living spec's document outline SHALL list every requirement once, in document order, without the reader turning on subsections. The outline SHALL be absent when the capability has one requirement or none. A feature spec's outline is unchanged.

#### Scenario: a large living spec is opened
- **WHEN** it renders
- **THEN** every requirement appears once in the outline, in order

#### Scenario: a capability with a single requirement
- **WHEN** it renders
- **THEN** no outline is shown

### An outline row carries a dot only for a requirement that needs attention
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts -->

A row SHALL carry a dot in its card's state colour when the requirement is adopted, drifted or new on this branch, and none when it is confirmed.

#### Scenario: a confirmed requirement whose coverage was never computed
- **WHEN** its row renders
- **THEN** it has no dot and no coverage mark

### An outline row says in words what its marks mean
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts -->

Each row's single accessible name SHALL state its state, the number of path patterns its `touches` marker names, and its coverage when known. The drawn marks SHALL be hidden from assistive technology. The count is of patterns, not files, because one pattern can claim a whole directory.

#### Scenario: a drifted requirement touching two patterns
- **WHEN** a screen reader reaches its row
- **THEN** it hears the heading, that it drifted, and two patterns

### A requirement after the Uncovered section is still a requirement
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A requirement heading SHALL become a card and a row wherever it sits, because fold-back appends to the end of the file. The Uncovered section SHALL stay outside every card.

#### Scenario: a requirement appended past the Uncovered section
- **WHEN** the cards and the outline are built
- **THEN** it is a card and a row, and the Uncovered text does not join the card above it

### A heading inside a fenced block is not a requirement
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A heading inside a code fence SHALL be neither a card nor an outline row, matching what every other reader counts.

#### Scenario: a spec quotes a requirement heading in a code block
- **WHEN** it renders
- **THEN** the quoted heading adds no card and no row

### The viewer can be told which requirement to bring into view
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts, apps/vscode/webview/src/spec-viewer/messageHandlers.ts -->

On the extension's request the viewer SHALL bring the named requirement into view, switching from the Overview to the document first and honouring reduced motion. A heading that matches no rendered requirement SHALL leave the scroll position untouched.

#### Scenario: the Overview is showing when a requirement is revealed
- **WHEN** the extension names a requirement
- **THEN** the document pane comes to the front with that requirement in view

#### Scenario: the heading matches nothing
- **WHEN** the extension names it
- **THEN** the view and scroll position do not change

### An adopted requirement says it was transcribed and where from
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A card with an `adopted` marker SHALL show an Adopted pill explaining that no run has confirmed it, and name the file it was transcribed from under its title.

#### Scenario: a requirement was transcribed by adoption
- **WHEN** its card renders
- **THEN** it shows the Adopted pill and "from" the source file

### An adopted requirement can be approved from its card
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts, apps/vscode/webview/src/spec-viewer/actions.ts -->

An adopted card SHALL offer Approve, posting the requirement's heading to the extension.

#### Scenario: an adopted requirement is approved
- **WHEN** the reader picks Approve
- **THEN** the heading is posted to the extension, which changes the file

### A requirement card's left edge shows its state
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A card's left edge SHALL be the accent colour when confirmed, the review colour when adopted, the warning colour when drifted and the success colour when new. New outranks adopted, and drifted outranks new.

#### Scenario: a requirement whose touched file changed
- **WHEN** the extension reports it drifted
- **THEN** its card redraws with the warning edge

### Only a card that needs attention shows a state pill
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A card SHALL show a pill for each non-confirmed state it is in, and a confirmed card SHALL show none.

#### Scenario: a new requirement that also drifted
- **WHEN** its card renders
- **THEN** it shows both the Drifted and the New pill

### A card lists the paths its requirement touches
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts, apps/vscode/webview/src/spec-viewer/actions.ts -->

Each path pattern in a requirement's `touches` marker SHALL appear on its card as a control that reveals it in the Explorer.

#### Scenario: a requirement touching two patterns
- **WHEN** the reader clicks one of them on its card
- **THEN** the Explorer reveals that path

### A requirement card lists what it leans on and what leans on it
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts, apps/vscode/webview/src/spec-viewer/actions.ts -->

A card SHALL list "Leans on" and "Leaned on by", each only when non-empty. Each resolved entry SHALL open that spec at that requirement.

#### Scenario: a resolved entry is clicked
- **WHEN** the reader activates it
- **THEN** the viewer opens that spec scrolled to that requirement

### A broken requirement link shows as written and does nothing
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

A link naming a heading or capability that does not resolve SHALL render as its original text, marked broken, and not be clickable.

#### Scenario: a link names a heading that does not exist
- **WHEN** the card renders
- **THEN** the link shows its original text, marked broken

### A living spec's marker comments render nothing, and a draft shows once
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/renderer.ts -->

The `touches`, `adopted`, `reviewed`, `aligns` and `capability` comments SHALL render nothing, in any document, inside a card or not. Any other comment still renders as a template disclosure.

#### Scenario: a marker sits outside any requirement card
- **WHEN** the document renders
- **THEN** nothing is drawn for it

#### Scenario: an ordinary comment in a feature spec
- **WHEN** it renders
- **THEN** it is a template disclosure

### A draft's banner line is not rendered in the body
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts -->

The `[DRAFT]` banner line SHALL be stripped from the rendered body, so the header badge is the only draft mark on screen.

#### Scenario: a draft is opened in living mode
- **WHEN** it renders
- **THEN** no banner text appears in the body
