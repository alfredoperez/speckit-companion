# Research: "Assumed" is a coverage state

**Decision**: `assumes` is one string per requirement, replaced on rewrite like `title`. **Rationale**: one line says what the requirement leans on; a list needs merge rules nobody asked for. **Alternatives considered**: a list of assumptions.

**Decision**: one `isTraced` predicate in the webview drives the Coverage count and the header strip. **Rationale**: three copies of `tests.length > 0` exist and would drift. **Alternatives considered**: patching each count.

**Decision**: order rows untraced, then assumed, then tested. **Rationale**: gaps lead; an assumed row is accounted for but weaker than a test. **Alternatives considered**: assumed with untraced, which would read as a gap.

**Decision**: the Copilot canvas and the Claude Code mod keep counting tested rows for now. **Rationale**: they mirror the logic by hand; slice 1 drew the same line. **Alternatives considered**: all four surfaces in one slice.
