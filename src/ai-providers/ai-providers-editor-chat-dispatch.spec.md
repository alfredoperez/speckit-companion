# Editor Chat Dispatch — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Providers that hand work to the host editor's chat or another extension's panel resolve their target at dispatch time and never auto-submit into a surface that cannot resolve the command.

## Requirements

### Dispatch targets are probed at dispatch time, not assumed

Surfaces the extension does not own — a host editor's chat, another extension's panel — SHALL be resolved by checking what is actually registered at the moment of dispatch, in a per-target preference order, degrading through fallbacks. When no target resolves, the provider MUST surface an actionable message naming a way forward and MUST NOT throw. `[inferred]` The degradation ladder ends at copying the command to the clipboard and opening the surface, so a target that accepts no programmatic input still works with one user paste.

#### Scenario: the host editor exposes no chat command
- **WHEN** none of the candidate chat commands are registered in the running editor
- **THEN** the user is warned that no built-in chat was found and told to switch to a CLI provider
- **AND** a host that ships its own CLI provider (an Antigravity host, whose `agy` CLI the dedicated Antigravity provider runs) is named directly rather than pointed at the generic switch-to-CLI hint
- **AND** nothing throws

#### Scenario: the host drops the prompt it is handed
- **WHEN** a target opens its chat but discards the supplied query
- **THEN** the command is placed on the clipboard and the user is told to paste and press Enter

### Commands are not auto-submitted into a surface that cannot resolve them

Before a SpecKit command is fired into a host editor's chat, the extension SHALL check that spec-kit has scaffolded those commands for that editor. When it has not, the command MUST be prefilled rather than submitted, and the user MUST be told why, with a route to initialize.

#### Scenario: the workspace is not spec-kit initialized
- **WHEN** a command is dispatched to a host chat with no spec-kit scaffolding present
- **THEN** the chat opens with the command prefilled but not submitted
- **AND** the user is warned and offered the initialize action
