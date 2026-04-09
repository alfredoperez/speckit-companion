# Research: Archive Button Left Alignment

## Research Tasks

### 1. Current Footer Layout Structure

**Decision**: The footer already has a two-section layout (`actions-left` and `actions-right`) using flexbox with `margin-right: auto` on `.actions-left` to push it left. No CSS changes needed.

**Rationale**: The existing CSS infrastructure fully supports the desired layout. The Archive button just needs to move from the `actions-right` div to the `actions-left` div in `FooterActions.tsx`.

**Alternatives considered**: None — the layout system is already designed for left/right separation.

### 2. Archive Button State Visibility

**Decision**: The Archive button appears in three state branches in `FooterActions.tsx` (lines 43-61). All three instances must be consolidated into a single Archive button rendered in `actions-left`, conditional on `!isArchived`.

**Rationale**: Currently the Archive button is duplicated across three conditional branches in `actions-right`. Moving it to `actions-left` allows a single conditional render (`!isArchived`) outside the state branching logic.

**Alternatives considered**: 
- Keep three separate Archive buttons in each branch → rejected because moving to left allows consolidation into one instance, reducing duplication.

### 3. Existing Left-Side Elements

**Decision**: The `actions-left` div currently contains: Edit Source button, Toast notification, and enhancement buttons (active state only). The Archive button will be added after Edit Source and before Toast.

**Rationale**: Placing Archive next to Edit Source groups secondary/utility actions together on the left. The Toast should remain after buttons so it doesn't shift button positions.

**Alternatives considered**:
- Place Archive after Toast → rejected because Toast visibility changes would shift the Archive button position.
- Place Archive before Edit Source → rejected because Edit Source is the most commonly used left-side action and should remain first.
