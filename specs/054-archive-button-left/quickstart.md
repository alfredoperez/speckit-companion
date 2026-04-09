# Quickstart: Archive Button Left Alignment

## What to Change

**Single file change**: `webview/src/spec-viewer/components/FooterActions.tsx`

### Steps

1. **Add Archive button to `actions-left`** (after Edit Source, before Toast):
   ```tsx
   <div class="actions-left">
       <Button label="Edit Source" variant="secondary" onClick={send({ type: 'editSource' })} />
       {!isArchived && <Button label="Archive" variant="secondary" onClick={send({ type: 'archiveSpec' })} />}
       <Toast id="action-toast" />
       {isActive && enhancementButtons.map((btn) => (
           // ... existing enhancement buttons
       ))}
   </div>
   ```

2. **Remove Archive button from all three branches in `actions-right`**:
   - Remove from `isArchived || isCompleted` branch (line 45)
   - Remove from `isTasksDone` branch (line 50)
   - Remove from active state branch (line 55)

3. **Update `docs/viewer-states.md`** to reflect the new footer button matrix.

## Verification

- Open any active spec → Archive on left, Regenerate + Approve on right
- Open a tasks-done spec → Archive on left, Complete on right
- Open a completed spec → Archive on left, Reactivate on right
- Open an archived spec → No Archive button visible
