# Research: Start and continue a bug or an idea from Companion

## A second small screen, not a mode of Create Spec

**Decision**: A new webview and provider parameterised by kind, reusing Create Spec's stylesheet and class names.

**Rationale**: Create Spec's webview wires its image, workflow and paste handlers unconditionally and its provider holds one panel, so a mode would need guards everywhere and an open New Spec would be revealed in place of New Bug.

**Alternatives considered**: A `mode` field on the Create Spec panel.

## How the typed text reaches the assistant

**Decision**: The text is written to a file under the extension's storage. The prompt is the slash command, `slug=<slug>`, and one sentence naming that file. It goes through `executeInTerminal`.

**Rationale**: On `cmd.exe` the prompt text is placed on the command line with only quotes doubled, so typed text in the prompt would break the rule that it never reaches a shell. A path and a slug cleaned to `a-z0-9-` are safe there. Create Spec delivers its description the same way.

**Alternatives considered**: Sending the symptom as prompt text. Safe on POSIX shells, not on cmd.

## The slug

**Decision**: Derived in the webview while the developer types, from a helper both sides compile. The extension normalises it again, refuses an empty one, and refuses one whose folder exists. The webview gets the existing slugs at start so it can say so before sending.

**Rationale**: The slug becomes a folder name and rides in the prompt; the webview's value is not trusted.

## Buttons come from the files, and a click sends only an id

**Decision**: The extension computes `{ id, label, primary }` from the item it reads. The webview posts the id. The handler reads the item again, checks the id is among the actions that state offers, takes the slug from the folder, and looks the command up in a `Map`.

**Rationale**: A read-only panel may now send one message; that message must not carry a command or a slug. Recomputing on receipt also makes a stale page harmless.

**Alternatives considered**: Reusing the enhancement buttons. They render only in the full footer's dropdown, and their handler appends a quoted path, not `slug=`.

## Where the footer goes

**Decision**: A `ReportFooter` branch in `FooterActions`, driven by `navState.reportActions`, copied from the living-spec footer's markup and classes.

**Rationale**: Report panels have no footer today because they carry no viewer state. The living footer is the existing example of a nav-state-driven one.

## Following the files

**Decision**: Nothing new. A report panel's HTML is rebuilt whenever its files change, so buttons computed in that build follow them.

## Asking again

**Decision**: Assess again and Reopen from intake send the command with the slug and one sentence pointing at the existing folder.

**Rationale**: Those commands expect the original text, which Companion does not keep; the folder has it.

## Create spec from an idea

**Decision**: `speckit.openSpecEditor` accepts an optional description. It fills an empty editor; if the editor already holds text, Companion asks before replacing it. The description is the idea's title, the first paragraph of the decision's rationale, and the path of the assessment folder.

**Rationale**: Nothing is created until the developer sends it, and they can edit the description first.

## When the process extension is missing

**Decision**: The + command checks the extension folder first. If it is absent it shows a message with an Install button that runs the existing install command, and opens nothing.
