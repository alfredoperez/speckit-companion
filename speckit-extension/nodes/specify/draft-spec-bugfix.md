---
id: draft-spec-bugfix
name: Draft the spec as a fix contract
kind: author
command: specify
writes: spec.md
reads: [resolve-dir]
---
2. Create `<feature_directory>/spec.md` as a **fix contract**: three statements of behaviour rather than a set of user stories. A fix is not a feature — nobody wants it, they want the defect gone — and the story shape makes people invent a journey to hold a bug.

   Reproduce it before writing. A contract written from the report rather than from the behaviour describes the report.

   - **Why** *(mandatory)* — one or two sentences: who hits this, how often, and what it costs them.
   - **Current Behaviour (the defect)** *(mandatory)* — what happens today, as observable statements:
     - `WHEN [condition] THEN the system [the wrong thing it does]`
     Include how to reproduce it: the state, the steps, what you see.
   - **Expected Behaviour** *(mandatory)* — what should happen instead, in the same shape:
     - `WHEN [condition] THEN the system SHALL [the right thing]`
   - **Unchanged Behaviour** *(mandatory)* — the regression contract, and the section that earns this shape:
     - `WHEN [condition] THEN the system SHALL CONTINUE TO [existing behaviour]`
     Name the behaviour near the defect that must survive the fix. A fix that breaks its neighbour is a worse outcome than the defect, and this is the only place anyone writes that down before it happens.
   - **Root cause** *(when known)* — one or two sentences. If it is not known yet, say so; do not guess in the spec and then design against the guess.
   - **Success Criteria › Measurable Outcomes** *(mandatory)* — measurable `SC-001…` outcomes. For a fix these are usually "the reproduction no longer reproduces" plus the unchanged behaviours still holding.
   - **Verbatim Constraints** *(include only when the report pins exact values)* — an error string, a route, a column name: **verbatim, in backticks, exactly as written**.

**Log the requirements as they're born.** Record every Expected and Unchanged statement as a requirement in one call, each with its one-line text as the title (best-effort; skip silently if `python3` is unavailable):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --batch '{
  "coverage": [
    {"req": "FR-001", "title": "<the statement's one-line text>"},
    {"req": "FR-002", "title": "<…>"}
  ]
}'
```

**One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`.

3. Keep every statement observable. "Handles errors correctly" is not a contract; "WHEN the upload is cancelled mid-flight THEN the system SHALL leave no partial row" is. Each Unchanged statement should be something a test could hold, because the later steps will be asked to prove exactly these.
