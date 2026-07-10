# Quickstart Validation Guide: Wibey CLI Provider

**Branch**: `393-wibey-provider-support` | **Date**: 2026-07-09

## Prerequisites

- Wibey CLI installed: `wibey --version` prints a version string
- VS Code with SpecKit Companion extension loaded (`npm run compile` + F5 in the extension host)
- A workspace with at least one spec file (any `specs/*/spec.md`)

---

## Scenario 1: Provider appears in dropdown with friendly label

1. Open the SpecKit sidebar
2. Click the AI Provider config tree node (or open VS Code Settings → search `speckit.aiProvider`)
3. **Verify**: `"Wibey CLI"` appears as a selectable option (not the raw key `wibey`)
4. **Verify**: The option shows description `"Walmart's built-in AI coding assistant…"`

---

## Scenario 2: Workflow step dispatches to Wibey terminal

1. Set `speckit.aiProvider` to `wibey`
2. Open a spec in the SpecKit sidebar
3. Click the **Specify** (or any) workflow step button
4. **Verify**: A VS Code terminal titled `SpecKit - Wibey` opens (or is reused)
5. **Verify**: The terminal shows `wibey -p "…"` executing (or the prompt being sent)
6. **Verify**: No error toast, no crash

---

## Scenario 3: Refine dispatches to Wibey terminal

1. Set `speckit.aiProvider` to `wibey`
2. Open a spec in the viewer → hover over a section → click **Refine**
3. **Verify**: Terminal `SpecKit - Wibey` opens with the refinement prompt
4. **Verify**: The command format is `/speckit-*` (dash form), not `/speckit.*` (dot form)

---

## Scenario 4: CLI not installed — graceful error

1. Temporarily rename the `wibey` binary or set `speckit.aiProvider` to `wibey` in an environment without Wibey
2. Click any workflow step
3. **Verify**: A VS Code warning/error message appears referencing `curl -sSL https://wibey.walmart.com/cli/setup | bash`
4. **Verify**: No hanging terminal, no uncaught exception in the output channel

---

## Scenario 5: Steering explorer resolves `.wibey/` paths

1. Set `speckit.aiProvider` to `wibey`
2. Open the SpecKit steering explorer in the sidebar
3. **Verify**: The steering section header shows `Wibey CLI` (or `Wibey`)
4. **Verify**: The explorer lists the workspace-level steering file path (e.g., `WIBEY.md` or whichever was confirmed during implementation)
5. **Verify**: Skills under `.wibey/skills/` are listed if present

---

## Scenario 6: Switching providers does not break existing settings

1. Set `speckit.aiProvider` to `wibey`, use a workflow step
2. Switch back to `speckit.aiProvider: 'claude'`
3. **Verify**: `settings.json` has `"speckit.aiProvider": "claude"` (stored value unchanged)
4. **Verify**: Claude provider continues dispatching to the `claude` CLI normally

---

## Full regression check

```bash
npm test
```

All 1136 existing tests should pass. No provider-specific tests are added for `WibeyCliProvider` in Phase 1 (zero logic to test beyond the base class contract).

---

## Implementation verification checklist

- [ ] `wibey --version` succeeds (install check passes)
- [ ] `speckit.aiProvider: 'wibey'` persists correctly in settings.json
- [ ] Terminal title is `SpecKit - Wibey`
- [ ] Command sent uses dash format: `/speckit-specify` not `/speckit.specify`
- [ ] `autoApproveFlag: ''` — no extra flags prepended when `permissionMode = 'auto-approve'`
- [ ] `steeringFile` verified: update `PROVIDER_PATHS` if actual file name differs from `WIBEY.md`
- [ ] InnerSource issue opened on `genaica/wibey-vscode-extension` for `wibey.sendPrompt`
