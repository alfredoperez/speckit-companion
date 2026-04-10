# Spec: Remove Terminal Toast

**Slug**: 057-remove-terminal-toast | **Date**: 2026-04-10

## Summary

Remove the "Opening terminal…" toast notification shown in the spec viewer when executing a workflow action that opens a terminal. The notification is unnecessary since the terminal opening is immediately visible to the user.

## Requirements

- **R001** (MUST): The "Opening terminal…" toast must no longer appear when a workflow action triggers terminal execution
- **R002** (MUST): Terminal execution itself must continue to work — only the toast is removed

## Scenarios

### Workflow action triggers terminal

**When** user clicks a workflow action button (e.g., Regen, Next) that executes in terminal
**Then** the terminal opens without any toast notification

### Other toasts unaffected

**When** other toast-producing actions fire (e.g., copy, archive)
**Then** those toasts still display normally

## Out of Scope

- Changing the terminal execution behavior itself
- Modifying other toast notifications
