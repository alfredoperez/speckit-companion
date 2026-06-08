# Quickstart: Verify the OpenCode Prompt-Flag Fix

## Prerequisites

- OpenCode CLI installed (`npm install -g opencode-ai`) and on `PATH` (`opencode --version` works).
- The extension built with this change and loaded (F5 Extension Development Host, or installed locally).

## Automated check

```bash
npm test -- openCodeDispatch
```

Expect: OpenCode's dispatched command uses `opencode run "…"` (not `-p`), and the Qwen/Copilot regression assertions still pass.

## Manual check (the real-world repro from issue #202)

1. Set the provider: `"speckit.aiProvider": "opencode"` in settings.
2. Open a spec that has a `tasks.md` (or any spec with a Plan/Implement action available).
3. Trigger a prompt-dispatching SpecKit action (e.g. **Implement**, **Plan**, or **Analyze**).
4. Watch the split-view terminal. The command sent should read:

   ```
   opencode run "$(cat "…/prompt-<timestamp>.md")"
   ```

   (PowerShell shows the `Get-Content -Raw` form.)

### Pass

OpenCode starts working on the prompt — it reads the message and begins its task. **(SC-001, SC-003)**

### Fail (pre-fix behavior)

The terminal shows `opencode -p "…"` and OpenCode prints its **usage/help** screen without acting on the prompt.

## Regression spot-check (optional)

Switch the provider to `qwen` or `copilot`, trigger the same action, and confirm the dispatched command still contains `-p ` exactly as before. **(SC-002)**
