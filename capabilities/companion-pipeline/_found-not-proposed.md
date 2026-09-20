# Found, not proposed: companion-pipeline

Things seen in this area and deliberately left out of the specs, with why.

## Build and packaging rules, not behaviour

- How a command body is assembled from a frame, ordered node files and shared parts, with frontmatter stripped and node markers wrapped in. A build rule: it decides how the text is produced, not what a run does.
- The golden command files and the byte-parity baseline that guards them. A test fixture for the build.
- The per-command instruction budget that fails a build when a command body grows past its ceiling. A build gate.
- Writing a command's emission per agent format, and leaving a Gemini TOML body alone rather than overwriting it. Install and packaging.
- The minimum spec-kit version the workflow declares, and why it is a bare floor rather than a dev-build one. Packaging, and it is already a comment in the file.
- `extension.yml`'s command list, scripts and hook registrations. Packaging manifest.
- The shipped example projects.

## Belongs to another area

- Recording a run: step start and finish stamps, the per-task journal, the requirement and decision capture, the lock two writers share, and a step closing itself rather than depending on its after-hook to close it. All of it is the run-record area's, and the self-closing rule in particular is a scar worth a requirement there (a run once sat eight minutes with its next step unreachable). **Unchecked deferral: nothing in these four specs says it.**
- Status, resume and doctor, including the doctor's check that a step which was given worker briefs actually dispatched them. Another worker owns those commands; the pipeline's own Uncovered notes the gap it leaves.
- Loading living specs into a step, folding deltas back at completion, and the reviewer implement dispatches over those deltas before folding. Living specs' area.
- Drawing the pipeline for the panel, and the panel's configuration forms. The VS Code side.

## Too small, or already said by the code

- The exact task line format, the `[P]` marker and the task id scheme. Notation a reader of `tasks.md` sees, not a rule a planner needs.
- Which named fragments ship for section swapping (requirement style, outcomes instead of stories, task-list variants). The swap mechanism is the rule; the list of fragments is content.
- Each optional node's own instructions, including the three failure lenses the gap review splits across. The recipe requirement says a project can add the node; the node's prose is its own.
- The per-node `reads` and `writes` declarations. Internal wiring; what matters is the document a step produces, which the specs say.
- `--dry-run` on the build. Said once as part of the all-or-nothing build requirement, not given its own line.
- The stock `/speckit.*` overlay preset's file-by-file list of which seven commands get timing capture. The count is in the spec, the list is not.
- The classify command being read-only. Implied by it being a verdict the workflow reads.
