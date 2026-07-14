# Contract: Sidebar Contributions

The surface `src/features/specs/__tests__/manifest.test.ts` asserts against `package.json`. Every identifier below is exact; the Verbatim Constraints from the spec appear here unchanged.

## Views (`contributes.views.speckit`)

| id (unchanged) | title |
|---|---|
| `speckit.views.explorer` | `Specs` |
| `speckit.views.livingSpecs` | `Living Specs` |
| `speckit.views.steering` | `Steering` |
| `speckit.views.settings` | `Settings & Feedback` |

`when` clauses and `visibility` values are unchanged.

## Specs title bar (`contributes.menus["view/title"]` where `view == speckit.views.explorer`)

Exactly four entries, and no more may be added:

| command | group | notes |
|---|---|---|
| `speckit.specs.filter` | `navigation@1` | title `Filter…` |
| `speckit.specs.sort` | `navigation@2` | title `Sort…` |
| `speckit.specs.moreActions` | `navigation@3` | **new** command, icon `$(ellipsis)` |
| `speckit.create` | `navigation@9` | title `New Spec`, rightmost |

Removed from `view/title`: `speckit.specs.filter.clear`, `speckit.specs.collapseAll`, `speckit.specs.expandAll`, `speckit.companion.installSpecKitExtension`, `speckit.upgrade`. All remain registered commands and remain reachable from the Command Palette.

## Spec-row menus

Both `speckit.specs.rowMenu` (the hover submenu) and `view/item/context` for a spec row use the same groups, in this order:

```
1_status   Set Status…
2_lifecycle  Mark Complete / Archive / Reactivate
3_copy     Copy Spec Name, Copy Spec Path
4_reveal   Reveal in VS Code Explorer, Reveal in File Manager
5_danger   Delete
```

`speckit.delete` MUST be in `5_danger` in both surfaces and MUST NOT appear in any other group.

Inline actions on a spec row: at most `speckit.specs.resume` (gated exactly as today) and the `speckit.specs.rowMenu` submenu.

## Command titles (ids unchanged)

| id | title |
|---|---|
| `speckit.create` | `New Spec` |
| `speckit.specs.filter` | `Filter…` |
| `speckit.specs.filter.clear` | `Clear Filter` |
| `speckit.specs.sort` | `Sort…` |
| `speckit.specs.moreActions` | `More Actions…` |
| `speckit.specs.collapseAll` | `Collapse All` |
| `speckit.specs.expandAll` | `Expand All` |
| `speckit.markCompleted` | `Mark Complete` |
| `speckit.specs.setStatus` | `Set Status…` |
| `speckit.group.markAllCompleted` | `Mark All Complete` |
| `speckit.group.archiveAll` | `Archive All` |
| `speckit.group.reactivateAll` | `Reactivate All` |
| `speckit.steering.create` | `New Steering Document…` |
| `speckit.specs.copyName` | `Copy Spec Name` |
| `speckit.specs.copyPath` | `Copy Spec Path` |
| `speckit.specs.revealInExplorer` | `Reveal in VS Code Explorer` |
| `speckit.specs.reveal` | `Reveal in File Manager` |
| `speckit.revealItemInExplorer` | `Reveal in VS Code Explorer` |
| `speckit.revealItemInOS` | `Reveal in File Manager` |
| `speckit.livingSpecs.drift` | `Check for Drift` |
| `speckit.livingSpecs.adopt` | `Adopt Code Area…` |
| `speckit.livingSpecs.refresh` | `Refresh Living Specs` |
| `speckit.companion.installSpecKitExtension` | `Install Companion Extension` |

## Reveal eligibility (`view/item/context`)

Both `speckit.revealItemInExplorer` (`navigation@98`) and `speckit.revealItemInOS` (`navigation@99`) MUST match these context values:

- Living Specs: `living-specs-capability`, `living-specs-tier`, `living-specs-orphan`
- Steering: `steering-document`, `steering-file`, `provider-settings`, `agent`, `skill`, `skill-warning`, `speckit-constitution`, `speckit-script`, `speckit-template`, `companion-config-item`, `companion-command`, `companion-template`

Neither MUST match `living-specs-capability-missing` or `living-specs-empty`.

Destructive Steering actions (`speckit.steering.delete`) MUST match only `steering-document`.

## Living Specs rows

| state | label | tooltip |
|---|---|---|
| disabled | `Living Specs are off` | `Enable livingSpecs in .specify/companion.yml to track capability specs.` |
| enabled, empty | `No living specs yet` | `Adopt a code area to create and register your first living spec.` |

The root MUST never return an empty array.

## More Actions QuickPick composition

`buildMoreActions(ctx)` where `ctx = { allCollapsed, companionInstalled, speckitAvailable }` returns, in order:

1. separator `View`
2. `Collapse All` when `!allCollapsed`, else `Expand All`
3. separator `Maintenance` — only when at least one maintenance entry follows
4. `Install Companion Extension` — only when `speckitAvailable && !companionInstalled`
5. `Upgrade…` — only when `speckitAvailable`

## Sort QuickPick

Title `Sort Specs`, placeholder `Choose sort order`, five single-line options with a native check on the current mode:

| label | description |
|---|---|
| `Number` | `Default · Highest number first` |
| `Name` | `A–Z` |
| `Date Created` | `Newest first` |
| `Date Modified` | `Recently edited first` |
| `Workflow Step` | `Current progress` |
