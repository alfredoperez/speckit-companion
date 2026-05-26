# Debug: speckit.specify Prompt Flow

**Captured**: 2026-05-26  
**Triggered by**: Spec 108 (restyle-subdoc-tabs) creation via spec editor  
**Branch**: `107-fix-inline-comment-persistence`  
**Session temp file ID**: `1779810605047-x07gnt1`

---

## 1. What the user typed in the spec editor

```
work on /Users/alfredoperez/dev/GitHub/obsidian-vault/Projects/speckit companion/backlog/plan-extra-text-above-header.md
Stack this change on top of the branch/pr 107-fix-inline-comment-persistence
```

This is saved verbatim by `TempFileManager.createTempFileSet()` to:
```
~/Library/Application Support/Code/User/globalStorage/
  alfredoperez.speckit-companion/spec-editor/
  1779810605047-x07gnt1/spec.md
```

---

## 2. What the extension appends to that file

`SpecEditorProvider.handleSubmit()` (src/features/spec-editor/specEditorProvider.ts ~L270) calls
`tempFileManager.appendToMarkdownFile()` with a hardcoded instruction block.

The temp file on disk after append contains:

```
work on /Users/alfredoperez/dev/GitHub/obsidian-vault/Projects/speckit companion/backlog/plan-extra-text-above-header.md
Stack this change on top of the branch/pr 107-fix-inline-comment-persistence

## Post-Specification: Update .spec-context.json

After writing the spec file, create or update `.spec-context.json` in the same feature directory with:

{
  "workflow": "speckit",
  "selectedAt": "<current ISO timestamp>",
  "currentStep": "specify",
  "status": "active",
  "specName": "<human-readable name derived from directory slug, e.g. 046-my-feature → My Feature>",
  "branch": "<current git branch name from git rev-parse --abbrev-ref HEAD>",
  "stepHistory": {
    "specify": {
      "startedAt": "<current ISO timestamp>"
    }
  }
}

If the file already exists, merge these fields into the existing content.
Replace `<current ISO timestamp>` with the actual current time in ISO 8601 format.

IMPORTANT: Only update the `.spec-context.json` for the spec being created or edited. Do NOT modify `.spec-context.json` files in other spec directories.
```

---

## 3. The terminal command sent to the AI

```
const prompt = `${command} ${tempFileSet.markdownFilePath}`;
```

Resolves to:

```
/speckit.specify /Users/alfredoperez/Library/Application Support/Code/User/globalStorage/alfredoperez.speckit-companion/spec-editor/1779810605047-x07gnt1/spec.md
```

`command` = `workflow.stepSpecify` = `/speckit.specify`  
(from `formatCommandForProvider('speckit.specify')` in the SpecKit workflow definition)

---

## 4. How the AI receives it

The `/speckit.specify` mode instruction in Copilot receives the above as `$ARGUMENTS`.

The mode instruction says:
> "The text the user typed after `/speckit.specify` in the triggering message **is** the feature description."

So `$ARGUMENTS` = the file path string, **not** the feature description text directly.

The AI must:
1. Recognize `$ARGUMENTS` is a file path
2. Read the temp file to get user content
3. Parse the first line as a reference to *another* file (the Obsidian backlog item)
4. Read that second file for the actual feature description
5. Proceed with spec generation

This is **implicit multi-level indirection** — there is no explicit instruction telling the AI that `$ARGUMENTS` may be a file path or may point to yet another file.

---

## 5. What the backlog file contained

```markdown
---
title: The Plan tab has extra text above the header
project: speckit
priority: medium
...
---

# The Plan tab has extra text above the header

## Summary
On the Plan tab, the sub-document navigation (`Plan ·` + a `Checklists: Requirements` pill)
sits above the spec title and reads as stray text rather than a set of tabs.
Restyle that row with the `impeccable` design skill so the sub-documents are unmistakably
sub-tabs, and move the Requirements checklist out of Plan and under the Specification tab
— which should just be a configuration mapping that file to the Specification tab.

## What to build
- Restyle the sub-document navigation row (impeccable pass)
- Move the Requirements checklist under the Specification tab via config

## Scope
- IN: visual restyle of the sub-document/sub-tab row; config change for Requirements tab assignment
- OUT: checklist contents; top-level tab bar redesign; broader viewer header redesign
```

---

## 6. Hooks executed

From `.specify/extensions.yml`:

```yaml
before_specify:
  - extension: git
    command: speckit.git.feature
    enabled: true
    optional: false   # ← mandatory, auto-executed
    condition: null
```

Hook is mandatory with no condition → should have created a feature branch.  
User explicitly said to stack on `107-fix-inline-comment-persistence`, so branch creation was skipped by the AI.  
`specs/108-restyle-subdoc-tabs/` directory was pre-created (likely by a prior attempt or the hook having run previously).

---

## 7. Copilot mode instruction source

`.github/prompts/speckit.specify.prompt.md`:
```yaml
---
agent: speckit.specify
---
```

This is empty (just the frontmatter). The actual instructions come from the VS Code agent mode
definition for `speckit.specify`, injected as `<modeInstructions>` in the system prompt.

`.github/copilot-instructions.md` (workspace-level Copilot instructions):
```
<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/107-fix-inline-comment-persistence/plan.md`
<!-- SPECKIT END -->
```

This means **every Copilot interaction** in this workspace also gets instructed to read the 107 plan — potentially influencing AI behavior for non-107 sessions.

---

## 8. Issues identified

### Issue A — Implicit file-path convention not documented
`$ARGUMENTS` can be either:
- A literal feature description ("Add user authentication")
- A path to a temp file containing user text (via spec editor)
- User text that itself contains a path to a separate file (Obsidian backlog pattern)

None of these cases are explicitly described in the mode instruction. The AI works correctly by inference, but this is fragile.

### Issue B — `.spec-context.json` has no `transitions` array
The spec-context.json written by the AI (for spec 108) only has `stepHistory`, no `transitions[]`.
The Activity view is driven by `transitions`, so it always shows "No activity recorded yet" for AI-specified specs.

The extension appends instructions for `stepHistory` only — it does not instruct the AI to write a `transitions` entry.

**Fix location**: `specEditorProvider.ts` `specContextInstruction` block — add a transitions seed:
```json
"transitions": [
  {
    "step": "specify",
    "substep": null,
    "from": { "step": null, "substep": null },
    "by": "extension",
    "at": "<current ISO timestamp>"
  }
]
```

### Issue C — `copilot-instructions.md` bleeds into all sessions
The workspace-level instruction pointing to the 107 plan is injected for every Copilot request,
including unrelated ones (e.g., 108 spec creation). Low severity, but worth noting.

### Issue D — `speckit.git.feature` hook always runs, even when stacking
The mandatory `before_specify` hook has no condition to detect "user is stacking on an existing branch."
Result: the hook either creates a duplicate branch or the AI ignores it and the directory ends up
pre-created by the hook while the spec content is never written to it until this AI session.

---

## 9. Relevant source files

| File | Role |
|------|------|
| `src/features/spec-editor/specEditorProvider.ts` | Builds and sends the terminal prompt; appends spec-context instructions |
| `src/features/spec-editor/tempFileManager.ts` | Creates/tracks temp files in globalStorageUri |
| `.specify/extensions.yml` | Hook config (before_specify → speckit.git.feature) |
| `.github/prompts/speckit.specify.prompt.md` | Copilot agent mode file (empty body, just frontmatter) |
| `.github/copilot-instructions.md` | Workspace-level Copilot instructions (currently points to 107 plan) |
| `specs/108-restyle-subdoc-tabs/.spec-context.json` | Resulting context file (no transitions, Activity view empty) |
