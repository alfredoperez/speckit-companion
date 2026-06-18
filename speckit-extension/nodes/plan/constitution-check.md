---
id: constitution-check
kind: gate
command: plan
reads: [plan-doc]
---
3. **Constitution Check** — add a `## Constitution Check` section to `plan.md` as a table: one row per constitution principle with a PASS / justified-violation assessment. This is a gate before Phase 0 research, re-checked after Phase 1 design. If a violation is genuinely necessary, justify it in a short **Complexity Tracking** table (violation | why needed | simpler alternative rejected). Omit Complexity Tracking when there are no violations; ERROR on an unjustified gate failure.
