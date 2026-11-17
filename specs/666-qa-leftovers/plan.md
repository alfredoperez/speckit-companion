# Plan: Release QA leftovers

## Summary

Five small fixes for the #920 items that still reproduce. The check snapshot keeps the git index's modification time when it copies it, so git re-reads same-second edits instead of trusting stale stat data. The Copilot board stops borrowing checkout file times for a spec that has a run record but no activity, on the card and in the sort. The site's preview script serves the built `dist/client` folder with Python's static server, because `astro preview` does not run with the Vercel adapter. The release QA stage script refuses a linked `node_modules`, the release QA guide says to run QA from its own worktree, and the inventory gate's failure message names `/install-local`.

## Project Structure

```text
apps/speckit-extension/scripts/capture.py            # copy2 keeps the index mtime
apps/speckit-extension/scripts/check-command-emissions.py  # failure hint
apps/speckit-extension/tests/test_receipts.py         # same-second regression test
apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/public/app.js     # card time
apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/spec-rules.mjs   # sort key
apps/copilot-canvas/tests/                            # card time + sort tests
apps/website/package.json                             # preview script
.claude/skills/release-qa/qa-stage.sh                 # linked node_modules gate
.claude/skills/release-qa/SKILL.md                    # own-worktree advice
```

**Structure Decision**: each fix lands where its cause is; no new modules.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no settings added or changed |
| II. Spec-Driven Workflow | PASS: receipts get more truthful |
| III. Visual and Interactive | PASS: the board shows less false data |
| IV. Modular Architecture | PASS: changes stay inside their modules |
| AI Provider Integration | PASS: untouched |
| User Interface | PASS: one card label can be empty, as it already is for specs with no time |
