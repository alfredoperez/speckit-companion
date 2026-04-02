# Spec Viewer: Button & Status System Analysis

## 1. Spec Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Active : spec created

    state Active {
        [*] --> SpecOnly : spec.md exists
        SpecOnly --> HasPlan : plan.md created
        HasPlan --> HasTasks : tasks.md created
        HasTasks --> TasksComplete : all tasks checked (100%)
    }

    Active --> Completed : user clicks "Complete"
    Active --> Archived : user clicks "Archive"
    Completed --> Archived : user clicks "Archive"
    Completed --> Active : user clicks "Reactivate" (PROPOSED)
    Archived --> Active : user clicks "Reactivate" (PROPOSED)
```

## 2. Status Determination Priority Chain

```mermaid
flowchart TD
    A[Start: determine specStatus] --> B{".spec-context.json<br/>status === 'archived'<br/>OR currentStep === 'archived'|'done'?"}
    B -- Yes --> C["specStatus = 'archived'"]
    B -- No --> D{".spec-context.json<br/>status === 'completed'?"}
    D -- Yes --> E["specStatus = 'spec-completed'"]
    D -- No --> F{"taskCompletionPercent === 100?"}
    F -- Yes --> E
    F -- No --> G["extractSpecStatus(content)<br/>→ 'draft' | 'in-progress' | etc."]

    style C fill:#666,stroke:#999,color:#fff
    style E fill:#2d6a2d,stroke:#4a4,color:#fff
    style G fill:#335,stroke:#559,color:#fff
```

**Source:** `specViewerProvider.ts:462-475`

## 3. Sidebar Grouping

```mermaid
flowchart LR
    subgraph Sidebar["SPECS Sidebar Tree"]
        direction TB
        Active["🔀 Active<br/>(expanded, sorted newest-first)"]
        Completed["✅ Completed<br/>(collapsed by default)"]
        Archived["📦 Archived<br/>(collapsed by default)"]
    end

    subgraph Rules["Grouping Rules"]
        R1["status undefined OR 'active'"] --> Active
        R2["status === 'completed'"] --> Completed
        R3["status === 'archived'"] --> Archived
    end
```

**Source:** `specExplorerProvider.ts:97-112`

## 4. Top Bar: Completion Badge (REMOVE)

The `🌱 SPEC COMPLETED` badge is **redundant** — the Tasks step already shows completion percentage (e.g., "Tasks 100%"). Removing it:
- Reduces visual clutter in the top bar
- The percentage on the Tasks tab is the signal
- The **Complete** button appearing as primary CTA is the call to action

**Source to clean up:** `html/navigation.ts:20-74`

## 5. Current Footer Button Visibility

```mermaid
flowchart TD
    Status{"specStatus?"}

    Status -- "'archived'" --> ArchivedView["Show only:<br/>'Archived' badge<br/>(no buttons)"]

    Status -- "'spec-completed'" --> CompletedView["Show:<br/>Archive | Edit Source | Regenerate<br/>+ CTA if applicable"]

    Status -- "'active'/'draft'/'in-progress'" --> ActiveView["Show:<br/>Complete | Archive | Edit Source | Regenerate<br/>+ CTA if applicable"]

    subgraph CTA_Logic["CTA / Approve Button Logic"]
        direction TB
        Q1{"On which step?"} 
        Q1 -- "Step N (not last)" --> Q2{"Next step file exists?"}
        Q2 -- No --> ShowNext["Show: next step label<br/>(e.g. 'Plan', 'Tasks')"]
        Q2 -- Yes --> HideCTA["Hide CTA"]
        Q1 -- "Last step" --> Q3{"taskCompletion < 100%?"}
        Q3 -- Yes --> ShowImpl["Show: 'Implement'"]
        Q3 -- No --> HideCTA2["Hide CTA"]
    end

    ActiveView --> CTA_Logic
    CompletedView --> CTA_Logic

    style ArchivedView fill:#555,stroke:#777,color:#fff
    style CompletedView fill:#2d6a2d,stroke:#4a4,color:#fff
    style ActiveView fill:#335,stroke:#559,color:#fff
```

**Source:** `html/generator.ts:59-89, 148-167`

## 6. Current Button Visibility Matrix

| specStatus | Complete | Archive | Edit Source | Regenerate | CTA (Approve) |
|---|---|---|---|---|---|
| active/draft | ✅ | ✅ | ✅ | ✅ | conditional* |
| in-progress | ✅ | ✅ | ✅ | ✅ | conditional* |
| spec-completed | ❌ | ✅ | ✅ | ✅ | conditional* |
| archived | ❌ | ❌ | ❌ | ❌ | ❌ (badge only) |

\*See CTA Logic diagram above

## 7. Message Flow

```mermaid
sequenceDiagram
    participant User
    participant Webview as Webview (actions.ts)
    participant Handler as messageHandlers.ts
    participant Context as specContextManager.ts
    participant Sidebar as specExplorerProvider.ts

    User->>Webview: clicks button
    Webview->>Handler: postMessage({ type })

    alt type = 'completeSpec' or 'archiveSpec'
        Handler->>Context: setSpecStatus(dir, status)
        Context->>Context: write .spec-context.json
        Context->>Sidebar: speckit.refresh
        Sidebar->>Sidebar: getChildren() re-groups tree
        Handler->>Webview: updateContent() re-renders
    else type = 'approve'
        Handler->>Handler: resolve next workflow step
        Handler->>Handler: executeInTerminal(nextCmd)
    else type = 'regenerate'
        Handler->>Handler: resolve current step command
        Handler->>Handler: executeInTerminal(currentCmd)
    else type = 'editSource'
        Handler->>Handler: vscode.showTextDocument()
    end
```

## 8. Problems Identified

```mermaid
mindmap
  root((Problems))
    Too Many Buttons
      5 buttons visible on active specs
      Visually overwhelming
      Edit Source is redundant
    Inconsistent Complete
      Hidden when tasks=100% auto
      User never clicked Complete
      Confusing disappearance
    Regenerate Always Visible
      Shown after completion
      Could corrupt state
    No Undo Path
      No Reactivate from Completed
      One-way lifecycle
    Fragile Status
      3+ sources of truth
      spec-context.json status
      currentStep field
      taskCompletionPercent
      extractSpecStatus from content
```

## 9. Proposed: New Button Visibility

```mermaid
flowchart TD
    Status{"specStatus?"}

    Status -- "'archived'" --> Arch["Reactivate"]
    Status -- "'completed'" --> Comp["Archive | Reactivate"]
    Status -- "'active'" --> ActiveCheck

    ActiveCheck{"taskCompletion<br/>=== 100%?"}
    ActiveCheck -- Yes --> Done["**Complete** (primary) | Archive"]
    ActiveCheck -- No --> StepCheck

    StepCheck{"Current step?"}
    StepCheck -- "Spec (no plan)" --> S1["Regenerate | Archive | **Plan** (primary)"]
    StepCheck -- "Plan (no tasks)" --> S2["Regenerate | Archive | **Tasks** (primary)"]
    StepCheck -- "Tasks (<100%)" --> S3["Regenerate | Archive | **Implement** (primary)"]
    StepCheck -- "Next step exists" --> S4["Regenerate | Archive"]

    style Done fill:#2d6a2d,stroke:#4a4,color:#fff
    style Arch fill:#555,stroke:#777,color:#fff
    style Comp fill:#446,stroke:#668,color:#fff
```

### Proposed Visibility Matrix

| State | Primary CTA | Secondary | Removed |
|---|---|---|---|
| Active (spec, no plan) | Plan | Regenerate, Archive | Complete, Edit Source |
| Active (plan, no tasks) | Tasks | Regenerate, Archive | Complete, Edit Source |
| Active (tasks, <100%) | Implement | Regenerate, Archive | Complete, Edit Source |
| Active (tasks, 100%) | **Complete** | Archive | Regen, Edit Source |
| Completed | — | Archive, Reactivate | Regen, Edit Source |
| Archived | — | Reactivate | Everything else |

**Key changes:** Remove Edit Source, hide Regenerate after 100%, Complete only appears as primary when tasks done, add Reactivate for undo.

## 10. Full Lifecycle E2E Scenario

```mermaid
flowchart LR
    subgraph Step1["1. New Spec"]
        S1_Side["Sidebar: Active"]
        S1_Foot["Footer: Archive | Regen | **Plan**"]
    end

    subgraph Step2["2. Plan Created"]
        S2_Side["Sidebar: Active"]
        S2_Foot["Footer: Archive | Regen | **Tasks**"]
    end

    subgraph Step3["3. Tasks Created"]
        S3_Side["Sidebar: Active"]
        S3_Foot["Footer: Archive | Regen | **Implement**"]
    end

    subgraph Step4["4. Tasks 100%"]
        S4_Side["Sidebar: Active"]
        S4_Foot["Footer: Archive | **Complete**"]
        S4_Tasks["Tasks tab: 100%"]
    end

    subgraph Step5["5. Completed"]
        S5_Side["Sidebar: Completed"]
        S5_Foot["Footer: Archive | Reactivate"]
    end

    subgraph Step6["6. Archived"]
        S6_Side["Sidebar: Archived"]
        S6_Foot["Footer: Reactivate"]
    end

    Step1 -->|"click Plan"| Step2
    Step2 -->|"click Tasks"| Step3
    Step3 -->|"click Implement"| Step4
    Step4 -->|"click Complete"| Step5
    Step5 -->|"click Archive"| Step6
```

## 11. Test Coverage Plan

### Unit Tests: Button Visibility (`generator.ts`)

```
describe('footer button visibility')
  it('shows Complete, Archive, Edit, Regen for active specs')
  it('hides Complete when specStatus is spec-completed')
  it('shows only Archived badge when specStatus is archived')
  it('shows next step label when next doc does not exist')
  it('hides CTA when next doc already exists')
  it('shows Implement on last step when tasks < 100%')
  it('hides CTA on last step when tasks = 100%')
  it('resolves parent step for related docs')
  it('disables Edit Source when current doc does not exist')
```

### Unit Tests: Status Determination (`specViewerProvider.ts`)

```
describe('specStatus determination')
  it('returns archived when .spec-context.json status is archived')
  it('returns archived when currentStep is done')
  it('returns spec-completed when status is completed')
  it('returns spec-completed when taskCompletionPercent is 100')
  it('falls back to extractSpecStatus from content')
  it('spec-context.json archived overrides task completion')
```

### Unit Tests: Message Handlers

```
describe('lifecycle handlers')
  it('completeSpec sets status to completed and refreshes')
  it('archiveSpec sets status to archived and refreshes')
  it('shows notification on status change')

describe('action handlers')
  it('regenerate executes current step command')
  it('approve executes next step command')
  it('editSource opens document in text editor')
```

### Integration Tests: Sidebar Grouping

```
describe('spec explorer grouping')
  it('groups active specs under Active')
  it('groups completed specs under Completed')
  it('groups archived specs under Archived')
  it('treats undefined status as active')
  it('sorts active specs by creation date descending')
```

## 12. Key Files

| File | What to Change |
|---|---|
| `src/features/spec-viewer/html/generator.ts` | Button visibility logic (L59-89, L148-167) |
| `src/features/spec-viewer/specViewerProvider.ts` | Status determination (L462-475) |
| `src/features/spec-viewer/messageHandlers.ts` | Add reactivate handler |
| `src/features/spec-viewer/types.ts` | Add 'reactivateSpec' message type |
| `src/features/specs/specExplorerProvider.ts` | Sidebar grouping consistency |
| `webview/src/spec-viewer/actions.ts` | Wire up new button events |
| `src/features/spec-viewer/__tests__/` | Comprehensive tests |
