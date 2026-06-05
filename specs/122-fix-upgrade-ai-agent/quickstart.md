# Quickstart: Verify the upgrade-agent fix & doc cleanup

**Branch**: `122-fix-upgrade-ai-agent`

How to confirm both defects are fixed after implementation.

## Part A — Upgrade agent (automated)

```bash
npm test -- detector
```

Expect the new resolver + dispatch tests to pass: every provider maps to a valid agent, `ide-chat` resolves per host, unrecognized providers fall back to `claude`, and `claude-code` never appears.

```bash
grep -rn "claude-code" src/speckit/detector.ts
```

Expect **no matches** (SC-003).

## Part B — Upgrade agent (manual, in Extension Development Host)

1. Press F5 to launch the Extension Development Host.
2. Set `speckit.aiProvider` to `codex` in settings.
3. Run the **Upgrade Project** command. Confirm the spawned terminal shows `specify init --here --force --ai codex` and the CLI does **not** print `Unknown agent` (SC-001, SC-002).
4. Repeat with `gemini` (→ `--ai gemini`) and with the default `claude` (→ `--ai claude`, no `claude-code` anywhere) (SC-004).
5. Set provider to `ide-chat` and run **Upgrade Project**: in plain VS Code expect `--ai copilot`; in Cursor expect `--ai cursor-agent` (US3).
6. Set provider to a junk value (e.g. via `settings.json` hand-edit `"speckit.aiProvider": "claude-code"`) and run upgrade: expect fallback `--ai claude`, no error (SC-005).
7. Repeat step 3 via the **combined CLI + project upgrade** path and confirm it sends the same `--ai` value (FR-006).

## Part C — Stale setting docs

```bash
grep -rn "workflowEditor.enabled" docs/ README.md src/ webview/
```

Expect **zero matches** (SC-006, SC-007) — gone from `docs/how-it-works.md` (both the Configuration Keys block and the troubleshooting list) and from `src/core/constants.ts`.

## Done when

- `npm test` is green.
- `grep` for `claude-code` (in detector) and `workflowEditor.enabled` (repo-wide) both return nothing.
- A non-Claude provider upgrades without an unknown-agent error.
