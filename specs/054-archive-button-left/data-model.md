# Data Model: Archive Button Left Alignment

## Entities

No new entities, fields, or data model changes. This feature is a pure UI layout change.

## State Transitions

No changes to spec status transitions. The Archive button continues to emit the `archiveSpec` message type regardless of its position.

## Footer Button Layout (Updated)

| Spec Status | Left Side | Right Side |
|-------------|-----------|------------|
| active | Edit Source, **Archive**, Toast, Enhancement buttons | Regenerate, Approve/Plan |
| tasks-done | Edit Source, **Archive**, Toast | Complete |
| completed | Edit Source, **Archive**, Toast | Reactivate |
| archived | Edit Source, Toast | Reactivate |
