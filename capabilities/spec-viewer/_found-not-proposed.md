# Found, not proposed: spec-viewer

One line per thing seen in the area and left out of the specs, with why.

- Broken run record offers a Reset context notification that backs the file aside and writes a fresh skeleton. Real user-facing behaviour, but it is the run record's contract rather than the viewer panel's; belongs with whoever owns the record.
- The install banner for the missing or outdated spec-kit extension, rendered inside the Overview with dismiss and a setting. Cross-cutting onboarding, not viewer reading or reviewing.
- Living spec mode: no rail, tier tabs, requirement cards, adopt and approve and undo, drift and coverage chips, Update button. Owned by another worker.
- Editing a single line in place from the viewer, and removing a line, exist as handlers but have no affordance that reaches them in the panel today. Dead path, not behaviour.
- A refine request for a line with an instruction is accepted and only shows a status message. Unimplemented, so there is nothing to specify.
- The viewer loads its syntax highlighter and diagram renderer from a public CDN at runtime, while the site's viewer page claims the viewer makes no runtime CDN requests. Looks like a real contradiction worth checking rather than a requirement to write down.
- The webview escapes element content but not attribute quotes, so user data must never be interpolated into an attribute. An engineering rule for the rules file, which this run skipped.
- Only the extension's single context writer may write the run record, and comment helpers stay side-effect free. Same: a rules-file constraint, not product behaviour.
- The outline's narrow threshold is duplicated between script and stylesheet and must match. Implementation detail with a known ceiling, not a requirement.
- Zoom on a diagram is scale only, with no pan and no memory across renders. Absence of a feature; the diagram behaviour itself is already covered under rendering.
- Suppressing metadata in the body that the header already shows, such as an input block or a literal slug line. A rendering detail of one convention, already inside the rendering requirement.
- Task sub-bullets folding into a disclosure and per-task capture summaries rendering under a task line. Same: detail under the conventions-render-as-structure requirement.
- Latest activity feed showing the last three recorded finishes inside the run log. A slice of the run log, which is already one requirement.
- Status labels that read differently on screen than in the record, such as tasking reading as Creating Tasks. Wording, not behaviour a planner needs.
- Webview render errors are posted to the extension's log channel. Diagnostics plumbing.
- Reduced motion is honoured across the panel's animations. Real and worth keeping, but it is a panel-wide chrome rule rather than a capability of reading a spec.
