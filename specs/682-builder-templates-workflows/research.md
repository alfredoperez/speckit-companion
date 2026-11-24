# Research: Templates and saved workflows

## Preview without rendered text

- **Decision**: draw an outline: each section heading, then the chosen fragment's name and summary, or "As shipped" for an untouched one. Say that the full text is in the template file.
- **Rationale**: the host sends headings, fragment names and summaries only; inventing body text would fake data.
- **Alternatives considered**: a new host message returning the composed document. Rejected: out of scope for a webview slice and a protocol change.

## When picks are written

- **Decision**: stage picks in the modal and send one `setTemplateSection` per changed heading on Done.
- **Rationale**: the design has Cancel and Done; writing on every click would make Cancel a lie.
- **Alternatives considered**: write on click and close on Done. Rejected for the reason above.

## Which node gets the Document row

- **Decision**: the node whose `writes` or `mayWrite` holds the template file name with `-template` removed; else the step's first `author` node; else its first node.
- **Rationale**: keeps the feature reachable when names do not line up.
- **Alternatives considered**: a host field naming the node. Rejected: protocol change.

## Selected, not built

- **Decision**: remember the workflow switched to in this panel session; show the line while that workflow is in force and the build kind needs a build.
- **Rationale**: the graph says which workflow is active and whether the build is current, not that a switch just happened.
- **Alternatives considered**: show it whenever the build is stale. Rejected: a stale build from a hook edit is not a workflow selection.
