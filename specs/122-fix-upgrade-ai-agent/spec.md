# Feature Specification: Fix Upgrade Agent & Stale Setting Docs

**Feature Branch**: `122-fix-upgrade-ai-agent`
**Created**: 2026-06-04
**Status**: Draft
**Input**: User description (from issue #190): two correctness defects where the extension emits or documents a value that doesn't exist. (1) `speckit.upgradeProject` always passes `--force --ai claude-code`; it ignores the configured AI provider and `claude-code` is not even a valid spec-kit agent (the CLI rejects it with `Error: Unknown agent 'claude-code'`). (2) The documentation describes a `speckit.workflowEditor.enabled` boolean setting that no longer exists in VS Code settings, so users go looking for a toggle that isn't there.

## Why This Matters

Both defects share a theme: the extension presents a value — to the CLI, or to the user in docs — that the rest of the system does not recognize. Each erodes trust that what the extension says matches what it does.

**Upgrade agent.** The "Upgrade Project" action is supposed to refresh a workspace's spec-kit scaffolding for the AI assistant the user actually works with. Today it ignores the user's configured provider and always asks spec-kit to scaffold for `claude-code` — an identifier the spec-kit CLI does not recognize. The result is a hard failure (`Unknown agent 'claude-code'`) for anyone, and even when it does not error it would scaffold the wrong assistant's command files. A user on Codex (the reporter's case) cannot upgrade their project at all. This makes a one-click maintenance action unusable and erodes trust that the extension respects the provider setting.

**Stale setting docs.** The `speckit.workflowEditor.enabled` setting was removed from the extension in an earlier change, but the documentation still lists it as a configuration key and points users at it for troubleshooting ("Workflow editor not showing: check `speckit.workflowEditor.enabled`"). A user following that guidance searches VS Code settings for a toggle that doesn't exist, then can't tell whether they've misconfigured something or the docs are wrong. The docs are the single source of truth for configuration in this project, so a phantom setting there is a real defect.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upgrade succeeds for a non-Claude provider (Priority: P1)

A user who has configured a non-Claude AI provider (e.g. Codex) runs the "Upgrade Project" action. The upgrade scaffolds for *their* assistant and completes without error.

**Why this priority**: This is the exact failure in the bug report — the command is completely broken for non-Claude users, who currently cannot upgrade at all. Fixing this restores the core capability and is the minimum viable outcome.

**Independent Test**: Set the provider to Codex, trigger "Upgrade Project," and confirm the dispatched upgrade names the Codex agent and the spec-kit CLI runs without an "Unknown agent" error.

**Acceptance Scenarios**:

1. **Given** the AI provider is set to Codex, **When** the user runs "Upgrade Project," **Then** the upgrade requests spec-kit scaffolding for the Codex agent and the CLI does not report an unknown-agent error.
2. **Given** the AI provider is set to Gemini, **When** the user runs "Upgrade Project," **Then** the upgrade requests the Gemini agent.
3. **Given** any supported provider is configured, **When** the user runs "Upgrade Project," **Then** the agent identifier sent to spec-kit is one the CLI recognizes.

---

### User Story 2 - Default Claude path no longer sends an invalid identifier (Priority: P1)

A user on the default Claude provider runs "Upgrade Project." The upgrade names the valid `claude` agent rather than the invalid `claude-code`, so the default experience succeeds too.

**Why this priority**: The invalid `claude-code` value breaks even the out-of-the-box default, not just non-Claude users. Both stories share one root cause, so the default path must be fixed in the same change.

**Independent Test**: Leave the provider at its default, trigger "Upgrade Project," and confirm the dispatched command names `claude` and contains no occurrence of `claude-code`.

**Acceptance Scenarios**:

1. **Given** the provider is left at the default, **When** the user runs "Upgrade Project," **Then** the upgrade names the `claude` agent and the literal string `claude-code` does not appear anywhere in the dispatched command.

---

### User Story 3 - Providers without a direct CLI agent still resolve safely (Priority: P2)

A user whose provider is an editor-surface choice rather than a terminal CLI (the Claude VS Code panel, or "IDE Chat" routed to the host editor) runs "Upgrade Project." The upgrade resolves that choice to a valid spec-kit agent and completes without error.

**Why this priority**: These providers have no obvious one-to-one terminal agent, so without explicit handling they would either fail or silently scaffold the wrong assistant. Important for correctness, but the reported break is the CLI providers in P1.

**Independent Test**: Set the provider to the Claude VS Code panel (and separately to IDE Chat), trigger "Upgrade Project," and confirm a valid agent identifier is sent and the CLI does not error.

**Acceptance Scenarios**:

1. **Given** the provider is the Claude VS Code panel, **When** the user runs "Upgrade Project," **Then** the upgrade resolves to the `claude` agent.
2. **Given** the provider is IDE Chat, **When** the user runs "Upgrade Project," **Then** the upgrade resolves to a valid agent identifier appropriate to the host editor (defaulting to a recognized agent when the host cannot be determined) and the CLI does not report an unknown-agent error.

---

### User Story 4 - Docs no longer point to a setting that doesn't exist (Priority: P2)

A user troubleshooting the workflow editor follows the documentation, which currently tells them to check a `speckit.workflowEditor.enabled` setting. That setting was removed, so the user must not be sent looking for it. After this change, the documentation no longer references the removed setting anywhere.

**Why this priority**: A phantom setting in the docs wastes user time and undermines confidence in the configuration reference, but unlike the upgrade defect it does not block a workflow. It is a documentation-correctness fix bundled here because it shares the "extension claims a value that doesn't exist" root theme.

**Independent Test**: Search the documentation and the extension's declared configuration for `speckit.workflowEditor.enabled` and confirm there are no remaining references that present it as a usable setting.

**Acceptance Scenarios**:

1. **Given** the `speckit.workflowEditor.enabled` setting is not declared by the extension, **When** a user reads the configuration reference and troubleshooting docs, **Then** they find no instruction to set or check `speckit.workflowEditor.enabled`.
2. **Given** the setting was removed, **When** the codebase is inspected, **Then** no orphaned reference to the removed setting key remains presented as a live configuration option.

---

### Edge Cases

- **Unknown / unset provider value**: If the stored provider setting is empty, missing, or holds a value the extension does not recognize (e.g. a renamed or stale enum), the upgrade falls back to a safe, valid default agent rather than sending an unrecognized identifier.
- **Both upgrade entry points**: The defect must be fixed wherever an upgrade is dispatched — the standalone "Upgrade Project" action and the combined "upgrade CLI + project" action must use the same provider-derived agent, so neither path can reintroduce `claude-code`.
- **Provider valid to the extension but not to the installed CLI**: The extension only sends identifiers from the spec-kit supported list; whether a specific CLI build accepts a given name is outside extension control, but the extension never originates an identifier it knows to be invalid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The upgrade action MUST derive the spec-kit agent identifier from the user's currently configured AI provider, rather than from a hardcoded value.
- **FR-002**: The upgrade action MUST NOT pass `claude-code` (or any other identifier outside the spec-kit CLI's supported agent list) to the CLI under any provider setting.
- **FR-003**: Each supported provider MUST map to a valid spec-kit agent identifier as follows: Claude (terminal) → `claude`; Claude VS Code panel → `claude`; Gemini → `gemini`; GitHub Copilot → `copilot`; Codex → `codex`; Qwen → `qwen`; OpenCode → `opencode`.
- **FR-004**: For a configured provider that does not correspond to a single terminal CLI agent (IDE Chat), the upgrade action MUST resolve to a valid agent identifier appropriate to the host editor, and MUST fall back to a recognized default agent when the host editor cannot be determined.
- **FR-005**: If the configured provider value is missing, empty, or unrecognized, the upgrade action MUST fall back to a single, valid default agent so the upgrade can never fail with an unknown-agent error.
- **FR-006**: Every code path that dispatches an upgrade (the standalone project upgrade and the combined CLI-plus-project upgrade) MUST use the same provider-to-agent resolution, so no path can reintroduce a hardcoded or invalid identifier.
- **FR-007**: The provider-to-agent mapping MUST remain consistent with the agent identifiers used elsewhere in the extension when scaffolding or dispatching for a given provider, so a project upgraded for a provider matches what that provider expects.
- **FR-008**: The documentation MUST NOT reference `speckit.workflowEditor.enabled` as a usable configuration setting, since it is no longer declared by the extension. Every place that presents it as a live setting (configuration-key listings and troubleshooting guidance) MUST be corrected or removed.
- **FR-009**: Any orphaned in-code reference that presents `speckit.workflowEditor.enabled` as a live configuration key (e.g. a constant naming it) MUST be removed so the setting key has a single, consistent (absent) status across docs and code.
- **FR-010**: If the underlying capability the removed setting once gated is still documented as togglable, the docs MUST be corrected to describe the current actual behavior (the capability is no longer gated by a user setting) rather than pointing at the nonexistent toggle.

### Key Entities

- **AI Provider setting**: The user's chosen assistant (Claude, Claude VS Code panel, Gemini, Copilot, Codex, Qwen, OpenCode, IDE Chat). Source of truth for which assistant the workspace should be scaffolded for.
- **Spec-kit agent identifier**: The value the spec-kit CLI accepts to scaffold an assistant's command files (e.g. `claude`, `codex`, `gemini`, `copilot`, `qwen`, `opencode`, `windsurf`, `cursor-agent`, `generic`, …). The extension must only ever emit a value from this recognized set.
- **Upgrade action**: The user-triggered operation that re-runs spec-kit scaffolding against the current workspace for a chosen agent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every provider the extension supports, running "Upgrade Project" completes without an "Unknown agent" error — 0 unknown-agent failures across the supported provider set.
- **SC-002**: The agent the upgrade scaffolds for matches the user's configured provider in 100% of supported-provider cases (a Codex user's upgrade scaffolds Codex, a Gemini user's scaffolds Gemini, etc.).
- **SC-003**: The literal identifier `claude-code` is never present in any dispatched upgrade command, under any provider setting.
- **SC-004**: A user who has never changed the default provider can run "Upgrade Project" successfully, with no regression from the prior default experience.
- **SC-005**: When the provider value is unrecognized or unset, the upgrade still completes successfully against a valid default agent rather than erroring.
- **SC-006**: A search of the documentation returns zero references that instruct the user to set or check `speckit.workflowEditor.enabled`.
- **SC-007**: A search of the codebase returns zero references that present `speckit.workflowEditor.enabled` as a live configuration key.

## Assumptions

- The set of providers the extension supports is: Claude (terminal CLI), Claude VS Code panel, Gemini, GitHub Copilot, Codex, Qwen, OpenCode, and IDE Chat. The mapping in FR-003/FR-004 covers all of them.
- The spec-kit CLI's recognized agent list includes at least `claude`, `codex`, `copilot`, `gemini`, `qwen`, `opencode`, `windsurf`, `cursor-agent`, and `generic` (per the CLI's own error output and current spec-kit releases). `claude-code` is not in that list; the corresponding value is `claude`.
- The Claude VS Code panel uses the same spec-kit scaffolding as the Claude terminal CLI, so both map to `claude`.
- For IDE Chat, the appropriate agent depends on the host editor (e.g. Copilot, Cursor, Windsurf). When the host cannot be identified, a recognized default agent is used so the command never errors. The exact host-detection behavior is an implementation detail; the requirement is only that a valid identifier is always sent.
- The user's configured provider is the single source of truth for the upgrade's target agent; the value previously stored in any spec-kit init metadata is not authoritative for this action.
- The `speckit.workflowEditor.enabled` setting was intentionally removed in a prior change; the documentation simply wasn't updated to match. The correct fix is therefore to bring the docs (and any orphaned code reference) in line with the setting's removal — not to re-introduce the setting.
- The project treats its documentation as the single source of truth for configuration, so a configuration reference that lists a nonexistent setting is a defect even though it changes no runtime behavior.

## Out of Scope

Issue #190 bundled five problems. This spec covers the two value-correctness defects (the upgrade agent and the stale setting docs). The remaining three were split into their own tracked issues and are **not** part of this spec:

- **Setup/onboarding clarity** — which components are required and how the VS Code extension relates to the command-line spec-kit workflow → tracked in #192.
- **Footer/step buttons** in the viewer appearing or disappearing after other buttons are clicked → tracked in #193.
- **The `analyze` step** not updating `.spec-context.json` and leaving the viewer asking for regeneration → tracked in #194.

This spec is limited to (a) making the upgrade action send a valid, provider-correct spec-kit agent identifier, and (b) removing the phantom `speckit.workflowEditor.enabled` setting from the docs and code.
