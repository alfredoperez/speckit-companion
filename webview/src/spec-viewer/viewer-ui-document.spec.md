# Viewer Document — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Rendering a spec's markdown as a commentable document: every line addressable and safely escaped, and the inline comments that attach to it re-anchored on every render, posted to the extension as the owner of the record, and closed once the spec settles.

## Requirements

### Rendered markdown is a commentable document, not just formatted text

The rendering pipeline MUST emit each source line as an addressable, hoverable unit carrying its own line number and an affordance to attach a comment, so annotation works anywhere in the document without a separate mode. Authoring scaffolding that belongs to the generator rather than the reader — front matter, notation legends, metadata already shown in the header — SHALL be stripped rather than rendered. Structured passages the specs use repeatedly (user stories, phased task lists, requirement blocks, acceptance scenarios, callouts) SHOULD be recognised and rendered as their own components rather than as generic prose, and those components stay commentable too.

The attach-a-comment affordance MUST name the specific line it targets in its accessible label rather than carrying a generic one, so that identical controls repeated down the document are distinguishable to assistive technology; the glyph inside it is decorative and MUST be hidden from that tree.

#### Scenario: a line's comment affordance is reached without a pointer
- **WHEN** the reader tabs to a line's add-comment control
- **THEN** it announces the particular line it will annotate, not a generic "add comment"
- **AND** the glyph inside it is hidden from assistive technology

#### Scenario: a document written with foreign line endings
- **WHEN** the source uses carriage returns
- **THEN** line endings are normalised before any block-level parsing
- **AND** the document renders as structure, not as one long paragraph

#### Scenario: the header already shows the spec's metadata
- **WHEN** the state carries the spec's identity
- **THEN** the document's own metadata block is stripped from the rendered body
- **AND** the reader does not see the same facts twice

### User text must never reach an HTML attribute unescaped

Markup that carries content from the document — a link target, an image description, a file reference, a title — MUST be built so the value cannot terminate the attribute it sits in. The escaping used for element *content* does not escape attribute quotes and is not sufficient here; such markup SHALL be assembled with DOM APIs, or escaped with an attribute-safe routine. The content policy is not a substitute for this and MUST NOT be relied on as one.

A destination taken from the document — a link target, an image source — MUST additionally be restricted to schemes that are safe to navigate to or load. A destination carrying a script-executing scheme SHALL NOT render as an active link or a loading image; it is rendered as inert text instead.

#### Scenario: a document contains a quote inside a file reference
- **WHEN** the value is placed into an attribute
- **THEN** the quote cannot close the attribute
- **AND** no additional attribute or handler can be introduced from document text

#### Scenario: a link points at a script-executing destination
- **WHEN** the document supplies a `javascript:` target
- **THEN** it is not rendered as an activatable link
- **AND** nothing the reader can click executes it

### Comments survive re-render by re-anchoring, and the card speaks for where it sits

Persisted comments MUST be restored inline on every render and after every state change, and restoration MUST be idempotent so repeated calls do not duplicate cards. Anchoring is best-effort and follows a fixed precedence — the stored line when its content still matches, else any line matching the stored text, else the first line under the stored heading, else the stored line if it still exists. A comment that matches nothing stays available in the consolidated list rather than being dropped. A restored card MUST describe the line it actually mounted onto; the stored anchor is the *input* to re-anchoring, never its output.

#### Scenario: the document drifts by a line
- **WHEN** a comment's stored line no longer matches but its text is found elsewhere
- **THEN** the card mounts on the line where the text now lives
- **AND** the card reports that line, not the stored one

#### Scenario: a document switch replaces the rendered body
- **WHEN** new content renders
- **THEN** stale mounts are cleared before comments are re-anchored
- **AND** no comment is left pointing at a removed element

### A teardown must unmount what it marked, not re-find it

Anything that marks an element on open — an editor, a comment container — MUST remember the element it marked and act on that reference when closing. Re-deriving the target on teardown by walking the DOM fails whenever the mount is not an ancestor-reachable relative of the trigger, and leaves the element stuck in its opened state forever.

#### Scenario: an editor opened next to a table row is closed
- **WHEN** the editor's container was inserted as a sibling rather than a descendant
- **THEN** the close path still finds and unmounts it
- **AND** the row loses its editing mark

### Comment mutations are posted to the extension, which owns the record

Adding, editing, or removing a comment MUST post the change to the extension rather than write anything itself; the local card is a rendering of the record, not the record. An edit that changes nothing, or that resolves to no target, SHALL be a no-op rather than a posted mutation. Dispatching refinement for a document MUST clear the local cards and let the refreshed record re-render them, so what is shown after the round trip is what was actually persisted.

The line-level structural actions (remove a story, scenario, task, section, or line) are likewise requests the webview posts, not edits it performs. They MUST be labelled as suggestions rather than as direct removals, so the reader is never told a click deletes content the webview does not itself remove.

#### Scenario: a comment is deleted
- **WHEN** the reader deletes a card
- **THEN** the removal is posted, the card unmounts, and focus returns to the line's own control
- **AND** the pending count updates

#### Scenario: a reader picks a structural line action
- **WHEN** the reader chooses to remove a story, scenario, task, section, or line from its menu
- **THEN** the control reads as a suggestion, not a direct removal
- **AND** the request is posted for the AI to act on rather than editing the document in place

### A settled spec is readable but not annotatable

Once a spec is completed or archived, its comments MUST still be visible — they are the record of what was asked — but every path that would create or change one SHALL be closed: the composer refuses to open, and mounted cards render without their action controls. This read-only decision SHALL follow the spec's live status, exactly as the footer's actions already do — it is re-evaluated when the status changes inside an open panel, never fixed at the moment the page was built.

#### Scenario: a completed spec is opened
- **WHEN** the reader hovers a line
- **THEN** the composer does not open
- **AND** existing comments remain visible without edit or delete controls

#### Scenario: a spec settles while its panel is open
- **WHEN** the status becomes completed during the session
- **THEN** the annotation paths close in place
- **AND** the reader does not have to reopen the panel for it to take effect

## Uncovered

The following files were not read in full — their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/markdown/preprocessors.ts` (read partially; only the first ~60 lines and the export inventory)
- `webview/src/spec-viewer/highlighting.ts`
- `webview/src/spec-viewer/components/InlineEditor.tsx`
