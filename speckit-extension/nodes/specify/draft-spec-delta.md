---
id: draft-spec-delta
name: Draft the spec as a delta
kind: author
command: specify
writes: spec.md
reads: [resolve-dir]
---
2. Create `<feature_directory>/spec.md` describing **only what changes**. This is the brownfield shape: the system already behaves some way, and a full specification of behaviour that is not moving buries the part that is. Write for a business stakeholder — plain language, **what** and **why**, not **how**. Reserve `inline code` for literal identifiers a reader would copy.

   Read the current behaviour before writing. If living specs or prior specs describe this area, they are what you are proposing to change; a delta written without reading them is a guess.

   - **Why** *(mandatory)* — one or two sentences on the problem and why now. Not a restatement of the request.
   - **What Changes** *(mandatory)* — a short list of the changes, each one line. Mark anything that breaks existing behaviour **BREAKING**.
   - **Added Requirements** — behaviour that does not exist today. A numbered `FR-001…` list, each a single testable MUST/SHOULD statement, each with at least one scenario:
     - `**Given** … **When** … **Then** …`
   - **Modified Requirements** — behaviour that exists and is changing. State the requirement **in full, as it will read afterwards**, not as a diff: a partial restatement loses the half nobody restated, and the next reader cannot tell what the whole rule is. Note the previous value in parentheses where it helps — `(previously: 30 minutes)`.
   - **Removed Requirements** — behaviour going away. Each needs **Reason** and **Migration**: what replaces it, or what someone relying on it should do instead. A removal with neither is a bug report, not a specification.
   - **Unchanged, and must stay that way** — the behaviour near this change that must not move. This is the regression contract; name it here and the later steps have something to protect.
   - **Edge Cases** — the boundary and error questions this change introduces.
   - **Success Criteria › Measurable Outcomes** *(mandatory)* — measurable, technology-agnostic `SC-001…` outcomes.
   - **Assumptions** — the informed defaults you chose for anything left open.
   - **Verbatim Constraints** *(include only when the request pins exact, must-match values)* — a `data-testid`, a route, an endpoint, a CLI flag, an env var, a config key, exact UI copy, a column name: record it **verbatim, in backticks, exactly as written**. Do **not** paraphrase, normalize casing, or pluralize; downstream steps MUST use these exact strings.

**Log the requirements as they're born.** The moment the requirements are written, record them all — added and modified alike — in one call, each with its one-line text as the title (best-effort; skip silently if `python3` is unavailable):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --batch '{
  "coverage": [
    {"req": "FR-001", "title": "<the requirement's one-line text>"},
    {"req": "FR-002", "title": "<…>"}
  ]
}'
```

**One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`.

3. Keep it business-readable, and keep it a delta. If a section would restate behaviour this change does not touch, cut it — except **Unchanged, and must stay that way**, which exists precisely to state what is not moving. If nothing behavioural changes at all (a refactor, tooling, a docs pass), say so plainly in **Why** and leave the requirement sections empty rather than inventing a requirement to fill them.
