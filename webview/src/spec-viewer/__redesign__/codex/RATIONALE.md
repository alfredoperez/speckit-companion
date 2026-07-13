# Header direction

The existing document view stacks a spec identity header, a global stale banner, and a run-facts strip before content begins. The proposed example reduces that to one global header.

- Spec identity, status, branch, update date, and compact run facts share the top bar.
- The stale state belongs to the selected `Plan` document, so its explanation and `Regenerate` action move beside that document's title.
- The rail uses `Overview` as a normal destination rather than a mode toggle.
- The document table of contents remains local to the reading surface and collapses into a disclosure in narrower containers.
- At split-pane widths, the metric cells reduce to `Run details`, preserving the title and branch instead of wrapping the header into another band.

Stories are titled under `Redesign/Codex/` and all files remain inside the Codex investigation directory.
