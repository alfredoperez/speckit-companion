# Plan: Implement fans out large Foundational waves

## Summary

Implement stops building the whole Foundational phase itself. As with plan's readers and design-doc writers in #758, the decision lives in `dispatch-briefs.py`, not in prose: a new `--waves` mode reads `tasks.md`, splits the Foundational phase into waves at its `⟶ Wait` join lines, and prints worker briefs for every wave of four or more tasks, with the tasks of one wave spread across at most four workers. Implement runs it at the start of Foundational and dispatches what it prints; waves it does not list stay inline, and Setup and Polish stay inline as before. Each worker checks in, so the doctor's `dispatch` check can name an implement that skipped its wave workers, and the maintainer's subagent tally imports the same wave splitter, so the tally and the instruction cannot disagree.

## Project Structure

```
speckit-extension/
  scripts/dispatch-briefs.py          # --waves mode, wave splitter shared with the tally
  scripts/doctor_checks.py            # check_dispatch also covers implement's waves
  nodes/implement/implement-exec.md   # step 3: Foundational goes through --waves
  nodes/implement/_frame.md           # Outline no longer says foundational is inline
  nodes/tasks/tasks-doc.md            # sentence describing how implement dispatches
  commands/ + tests/golden/commands/  # rebuilt from nodes
  tests/test_dispatch_briefs.py       # --waves split, threshold, doctor check
  tests/test_dispatch_threshold.py    # old "Foundational always stays" assertion replaced
  docs/commands.md, CHANGELOG.md
.claude/scripts/subagent-tally.py     # implement expectation counts qualifying waves
.claude/commands/fix-tickets.md       # tally description
capabilities/companion-commands/pipeline.spec.md  # via the fold
```

**Structure Decision**: extend `dispatch-briefs.py` rather than add a script, because the check-in, the trace op and the doctor check already exist for plan; the tally imports its splitter by path.

## Constitution Check

| Principle | Assessment |
|---|---|
| Extension isolation (only the `.vsix` and the spec-kit extension ship) | PASS: behavior lives in shipped nodes and scripts; `.claude/` edits are repo tooling only |
| Docs are part of the change | PASS: commands doc, changelog, living spec delta, `/fix-tickets` text |
| Never fail the host command | PASS: `--waves` exits 0 on any error, like the other modes |
