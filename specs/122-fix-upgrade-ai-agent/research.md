# Research: Fix Upgrade Agent & Stale Setting Docs

**Branch**: `122-fix-upgrade-ai-agent` | **Date**: 2026-06-04

This is a two-part correctness fix. The research below resolves every unknown the spec raised: what the spec-kit CLI actually accepts as an agent identifier, how each extension provider maps to one of those identifiers, how the IDE-Chat provider resolves to a host-appropriate agent, and exactly where the phantom `speckit.workflowEditor.enabled` setting still lives.

## 1. Spec-kit CLI's real agent list

**Decision**: Treat the CLI's `--ai` accepted set as the authoritative whitelist; the extension only ever emits a value from it.

**Finding**: Running `specify init --help` against the installed CLI prints the accepted `--ai` values:

```
agy, amp, auggie, bob, claude, codebuddy, codex, copilot, cursor-agent,
devin, forge, gemini, goose, iflow, junie, kilocode, kimi, kiro-cli,
lingma, opencode, pi, qodercli, qwen, roo, shai, tabnine, trae, vibe,
windsurf, or generic
```

`claude-code` is **not** in this list — that is the root of the bug (`Error: Unknown agent 'claude-code'`). The valid identifier for Claude is `claude`. The help text also states the CLI "default[s] to Copilot in non-interactive sessions," which makes `copilot` the natural fallback for any host we can't otherwise resolve.

**Rationale**: The CLI's own `--help` output is the single source of truth for what it accepts; anchoring the extension's mapping to it guarantees we never originate an identifier we know to be invalid (FR-002, FR-005).

**Alternatives considered**: Hardcoding a curated subset — rejected because it drifts from the CLI; the CLI list already covers every provider we support.

## 2. Provider → spec-kit agent mapping

**Decision**: A single pure mapping from the extension's `AIProviders` enum to a CLI agent identifier, used by every upgrade path.

| Extension provider (`speckit.aiProvider`) | spec-kit `--ai` agent |
|-------------------------------------------|-----------------------|
| `claude` (terminal)                       | `claude`              |
| `claude-vscode` (Claude VS Code panel)    | `claude`              |
| `gemini`                                  | `gemini`              |
| `copilot`                                 | `copilot`             |
| `codex`                                   | `codex`               |
| `qwen`                                    | `qwen`                |
| `opencode`                                | `opencode`            |
| `ide-chat`                                | host-dependent (see §3) |
| *(missing / empty / unrecognized)*        | `claude` (safe default) |

**Rationale**: Seven of the eight providers have a one-to-one CLI agent; `claude-vscode` shares Claude's scaffolding so it also maps to `claude` (spec assumption confirmed). The unrecognized-value fallback is `claude` because that is already the extension's declared default for `speckit.aiProvider` (package.json `default: "claude"`), so a stale/renamed enum degrades to the same agent a fresh install would use — consistent with the existing PROVIDER_PATHS fallback pattern. (FR-001, FR-003, FR-005, FR-007)

**Alternatives considered**: Reusing the spec-kit metadata written at `specify init` time — rejected per spec: the user's configured provider, not init metadata, is authoritative for the upgrade target.

## 3. IDE-Chat host → agent resolution

**Decision**: When the provider is `ide-chat`, resolve the agent from the detected host editor, reusing the extension's existing host-detection signals (`vscode.env.uriScheme`, falling back to `appName`).

| Detected host (`HostIde`) | spec-kit `--ai` agent |
|---------------------------|-----------------------|
| `vscode`                  | `copilot`             |
| `cursor`                  | `cursor-agent`        |
| `windsurf`                | `windsurf`            |
| `antigravity`             | `agy`                 |
| `unknown`                 | `copilot` (default)   |

**Finding**: `IdeChatProvider.detectHostIde()` already classifies the host into exactly these five buckets from stable `vscode.env` signals. Every bucket has a corresponding CLI agent: VS Code's built-in chat is Copilot, Cursor is `cursor-agent`, Windsurf is `windsurf`, and Antigravity's `agy` identifier is in the CLI list. An unrecognized fork falls back to `copilot`, which matches the CLI's own non-interactive default.

**Rationale**: Host detection already exists and is exercised by the IDE-Chat dispatch path; routing the upgrade through the same detector keeps a single source of truth and guarantees a valid identifier is always sent (FR-004). The current `detectHostIde()` is an instance method on `IdeChatProvider`; to consume it from the upgrade path without constructing a provider, it will be extracted to a standalone exported function with the method delegating to it (behavior-preserving for IDE-Chat dispatch).

**Alternatives considered**: Duplicating the uriScheme/appName check inside the resolver — rejected; duplicated host detection is precisely the kind of drift that produced the original `claude-code` bug. One detector, one truth.

## 4. Where the upgrade agent is emitted

**Decision**: Fix both terminal-emitting paths through the shared resolver.

**Finding**: The literal `--ai claude-code` appears in exactly two dispatch sites, both in `src/speckit/detector.ts`:

- `upgradeProject()` (line 235) — the standalone "Upgrade Project" action.
- `upgradeAll()` (line 260) — the combined "upgrade CLI + project" action.

`detector.ts` currently reads no configuration. Both sites build a `specify init --here --force --ai <agent>` terminal command. Routing both through one `getConfiguredSpecKitAgent()` helper guarantees neither path can reintroduce a hardcoded identifier (FR-006).

**Rationale**: Two call sites, one resolver — the spec's "every upgrade path uses the same resolution" requirement maps directly onto a single shared function.

## 5. The phantom `speckit.workflowEditor.enabled` setting

**Decision**: Remove every live-setting reference from docs and code; the setting is genuinely gone from the extension's `package.json` contributions.

**Finding**: A repo-wide search locates exactly three references and confirms the setting is **not** declared in `package.json`:

- `docs/how-it-works.md:339` — lists `speckit.workflowEditor.enabled // boolean` in the Configuration Keys block.
- `docs/how-it-works.md:596` — troubleshooting step "Workflow editor not showing: Check `speckit.workflowEditor.enabled`".
- `src/core/constants.ts:60` — `workflowEditorEnabled: 'speckit.workflowEditor.enabled'` in `ConfigKeys`. This constant has **zero** other usages anywhere in `src/` or `webview/`, so removing it is safe and inert.

README.md and CHANGELOG.md contain no references. The workflow editor today is not gated by any user setting, so the troubleshooting entry has no valid replacement target and should be removed (or repointed at the actual cause) rather than rewritten to name another toggle.

**Rationale**: The setting key must have a single, consistent (absent) status across docs and code (FR-008, FR-009, FR-010). Since the constant is unreferenced, this is a pure deletion with no runtime behavior change.

**Alternatives considered**: Re-introducing the setting to match the docs — rejected per spec assumption: the removal was intentional; the docs are what's stale.

## Open questions

None. All NEEDS CLARIFICATION from Technical Context are resolved.
