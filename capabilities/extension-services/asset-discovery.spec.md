# Asset Discovery — Living Spec

## Purpose

Lists the agents and skills the user or other tools authored, at every scope, without ever failing activation over a file the extension did not write.

## Requirements

### Discovering user-authored assets is best-effort and never breaks activation
<!-- touches: apps/vscode/src/features/agents/agentManager.ts, apps/vscode/src/features/skills/skillManager.ts -->

Listing agents or skills SHALL treat a missing directory or an unreadable file as nothing found there, log it, and continue.

#### Scenario: the user has no skills directory
- **WHEN** the skill list is requested
- **THEN** an empty list is returned and nothing is surfaced as an error

### A malformed definition surfaces as a flagged entry, not a missing one
<!-- touches: apps/vscode/src/features/skills/skillManager.ts -->

A skill whose frontmatter is absent or unparseable SHALL still be listed under its folder name and marked as needing attention, because the user's assistant may still load it and hiding it leaves nothing to fix.

#### Scenario: a skill's frontmatter is invalid YAML
- **WHEN** the skill list is built
- **THEN** the skill appears under its folder name, flagged, with an explanation on hover

### Assets are discovered at every scope and attributed to their origin
<!-- touches: apps/vscode/src/features/agents/agentManager.ts, apps/vscode/src/features/skills/skillManager.ts -->

Discovery SHALL cover project, user and installed-plugin scopes and record each asset's scope. Plugin assets SHALL be named under their plugin, so same-named assets from two plugins stay distinct.

#### Scenario: two plugins each provide a skill with the same name
- **WHEN** both are discovered
- **THEN** each is listed under its own plugin's name and neither displaces the other

### Skills are found where the active provider keeps them
<!-- touches: apps/vscode/src/features/skills/skillManager.ts, apps/vscode/src/features/agents/agentManager.ts -->

Skill discovery SHALL scan the active provider's own skills directory at both project and user scope, never one vendor's layout. Agents are still read from Claude's layout at both scopes, so another provider's agents directory is not listed yet.

#### Scenario: a non-default provider is configured
- **WHEN** skills are enumerated
- **THEN** that provider's skills directory is scanned at project and user scope, and its skills are listed

## Uncovered

_None. Every file in the area was read._
