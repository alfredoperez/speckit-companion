# Spec: Clear completed todos

## Summary

Let a reader clear every completed todo with one button.

## Requirements

- **R001** (MUST): A "Clear completed" button removes every todo that is ticked.
- **R002** (MUST): The button is hidden while no todo is ticked.
- **R003** (SHOULD): The count of remaining todos updates right away.

## Scenarios

### Clear the finished ones

**When** the reader presses "Clear completed" with three of five todos ticked
**Then** the three ticked todos are gone and the two open ones stay in order
