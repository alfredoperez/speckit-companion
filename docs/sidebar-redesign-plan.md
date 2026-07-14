# SpecKit Companion Sidebar Redesign Plan

**Status:** Ready for implementation handoff  
**Surface:** Native VS Code Activity Bar container and TreeViews  
**Primary files:** `package.json`, `src/features/specs/`, `src/features/steering/`, `src/features/settings/`, `assets/icons/`  
**Reference:** `docs/sidebar.md` and the current sidebar implementation  

## Handoff instruction

Implement this plan as a focused sidebar design pass. Preserve existing command IDs, stored settings, lifecycle behavior, multi-select behavior, and native VS Code TreeView semantics. Make changes incrementally, add or update automated tests for every contribution or tree-model behavior changed, and finish by updating the sidebar documentation and screenshots.

Do not replace the native TreeViews with a webview. Do not add custom CSS or invent custom hover, focus, selection, or context-menu implementations. VS Code must remain responsible for row height, indentation, keyboard navigation, focus, selection, hover surfaces, and menu rendering.

---

## 1. Problem statement

The sidebar has a sound functional foundation, but its design language has drifted:

- four related views use partially overlapping names and hierarchy;
- detailed emoji-style SVGs, Codicons, provider logos, and brand assets compete at the same 16 px tree scale;
- the Specs title toolbar can expose too many icon-only actions at once;
- hover actions and right-click menus do not use the same grouping or coverage;
- several file-backed rows have no reveal actions while similar rows do;
- some tooltips expose raw values, reconstruct inaccurate paths, or mention the wrong provider file;
- active and completed trees can open into hundreds of rows by default;
- empty views can occupy substantial vertical space without a useful next action;
- command capitalization and terminology vary between otherwise parallel actions.

The redesign should make the sidebar feel like one coherent VS Code-native product: quiet, scannable, semantically colored, predictable, and compact.

## 2. Goals

1. Establish one icon system for functional UI and reserve custom art for identity.
2. Clarify the relationship between feature specs and living specs.
3. Reduce default tree density and unnecessary scrolling.
4. Limit permanently visible toolbar actions to the most common operations.
5. Make hover actions, context menus, and title actions predictable and safe.
6. Use concise, consistent, action-oriented copy everywhere.
7. Give every file-backed item a consistent open/reveal experience.
8. Preserve native accessibility and theme compatibility.
9. Cover the contribution manifest and tree presentation logic with tests.

## 3. Non-goals

- Redesigning the spec viewer or editor webviews.
- Changing spec lifecycle rules or status persistence.
- Changing provider dispatch, provider IDs, or setting values.
- Replacing VS Code TreeView rendering with HTML.
- Adding animation beyond the existing native `sync~spin` running indicator.
- Introducing a new icon package.
- Renaming files or directories on disk.
- Removing advanced actions from the Command Palette.

## 4. Native VS Code constraints

- Tree row dimensions, font, selection, focus, hover background, indentation, and disclosure arrows come from VS Code and should not be simulated.
- Icon-only title and inline actions receive their hover labels from contributed command titles. Those titles must therefore be short and unambiguous.
- `ThemeIcon` should be preferred for semantic and functional icons because it inherits normal, dark, light, and high-contrast theme behavior.
- Custom SVGs remain appropriate for product identity and official provider marks, but should not be used for generic concepts already represented by Codicons.
- Menu visibility must continue to use `when` clauses and per-item `contextValue`.
- Existing command IDs should remain stable even when their user-facing titles change.

---

## 5. Target information architecture

### 5.1 View names

Use these names in the SpecKit Activity Bar container:

| Current | Target | Rationale |
|---|---|---|
| Specs | Specs | Already concise; clearly means feature specs once the next view is renamed. |
| Spec Explorer | Living Specs | Distinguishes durable capability documentation from feature specs. |
| Steering | Steering | Existing product term; no rename in this pass. |
| Settings | Settings & Feedback | Accurately describes all four rows in the view. |

Do not rename command IDs or view IDs. Only change contributed display names and documentation.

### 5.2 Recommended view order and visibility

The canonical contribution order should be:

1. **Specs** — visible and expanded by default.
2. **Living Specs** — collapsed by default; only contributed when Companion is installed, as it is today.
3. **Steering** — visible, with VS Code retaining the user's expansion state.
4. **Settings & Feedback** — collapsed and hidden by default, as Settings is today.

Users can reorder views in VS Code. Do not attempt to override a saved user order.

### 5.3 Specs tree

Target structure:

```text
Specs
  Active (4)                         expanded by default
    393-wibey-provider-support       collapsed by default
    _00_demo-specified               collapsed by default
    _01_demo-planned                 collapsed by default
    _02_demo-tasked                  collapsed by default
  Completed (205)                    collapsed by default
  Archived (N)                       collapsed by default
```

Rules:

- Keep group counts.
- Keep the group order Active, Completed, Archived.
- Continue omitting groups with zero items.
- Active group starts expanded.
- Completed and Archived start collapsed.
- Individual spec nodes start collapsed, including Active specs.
- The existing Collapse All / Expand All command may still change individual spec states for the current session.
- Preserve stable IDs so VS Code can retain manual expansion across refreshes.
- Preserve duplicate-name disambiguation with the parent path.
- Preserve current filtering and sorting behavior.

### 5.4 Living Specs tree

Target structure:

```text
Living Specs
  Capabilities
    Authentication        central · 5/6 covered
      Spec
      Architecture
      Coverage
  Orphans
    legacy-auth.spec.md
```

Rules:

- Keep Capabilities before Orphans.
- Keep capability rows collapsed by default.
- Keep health summaries short and in the description.
- Keep exact paths and full explanations in tooltips.
- When disabled, show a single informative row: `Living Specs are off`.
- Disabled tooltip: `Enable livingSpecs in .specify/companion.yml to track capability specs.`
- When enabled but empty, show: `No living specs yet`.
- Empty-state tooltip: `Adopt a code area to create and register your first living spec.`
- An empty view must never render as a blank panel. The provider must always return an informative row for disabled, empty, loading, or recoverable error states.

### 5.5 Steering tree

Target top-level structure:

```text
Steering
  Companion
  <Configured Provider>
    Project
      <provider steering file or Create Project Rule>
      Agents
      Skills
      Settings
    User
      <provider steering file or Create User Rule>
      Agents
      Skills
      Settings
  Steering Docs
  SpecKit Project Files
    Constitution
    Scripts
    Templates
  References
```

Rules:

- Stop rendering `Create Global Rule` and `Create Project Rule` as loose root rows.
- Put each missing-file action inside the corresponding Provider > User or Project group.
- Use **User** consistently; do not alternate between Global and User.
- Rename `SpecKit Files` to `SpecKit Project Files`.
- Do not force Companion into an arbitrary second slot with `splice`. Build the root list in the target order explicitly.
- Only show sections that contain content, except Provider and installed Companion, which serve as stable entry points.
- Keep leaf filenames literal. Developers need to see the actual `.sh`, `.md`, `.json`, `.toml`, and `.yml` names.

### 5.6 Settings & Feedback tree

Keep the current four rows, in this order:

1. Open Settings
2. Report a Bug
3. Request a Feature
4. Rate on Marketplace

Use native Codicons. No additional grouping or separators are needed for four rows.

---

## 6. Icon system

### 6.1 Principles

- Use Codicons/`ThemeIcon` for functional and semantic concepts.
- Keep the SpecKit seedling Activity Bar icon if it remains legible and monochrome in light, dark, and high-contrast themes.
- Keep the moss asset only as the Companion product identity.
- Keep official provider logos for provider rows.
- Do not use literal Unicode emoji in labels, titles, descriptions, or tooltips.
- Retire detailed Fluent Emoji-style SVGs from generic tree categories.
- Do not color decorative icons. Color only meaningful status or brand icons.
- Never rely on color alone: status must also be communicated by icon shape, grouping, label, description, or tooltip.

### 6.2 Specs icon mapping

| Element/state | Target icon | Color |
|---|---|---|
| Active group | `ThemeIcon('pulse')` | Default foreground |
| Completed group | `ThemeIcon('pass-filled')` | `testing.iconPassed` |
| Archived group | `ThemeIcon('archive')` | Muted/default foreground |
| New spec/no current step | `ThemeIcon('beaker')` | Default foreground |
| Active spec | `ThemeIcon('beaker')` | `charts.blue` |
| Running spec | `ThemeIcon('sync~spin')` | Theme default |
| Implemented, awaiting confirmation | `ThemeIcon('beaker')` | `charts.yellow` |
| Confirmed completed spec | `ThemeIcon('beaker')` | `testing.iconPassed` |
| Completed document step | `ThemeIcon('pass')` | `testing.iconPassed` |
| Current document step | `ThemeIcon('circle-filled')` | `charts.blue` |
| Existing partial/non-current document | `ThemeIcon('circle-outline')` | Default/muted |
| Missing document | No icon | Description says `not created` |

Completed and archived spec children must not silently lose their status icons. Render a green pass for an existing completed step regardless of the parent lifecycle. Archived specs may use the same document status icons at normal or muted theme color; do not leave structurally identical rows blank solely because the parent is archived.

Related-document rows may remain iconless when that absence is deliberately used to show nesting. Their tooltip must show the exact relative path.

### 6.3 Living Specs icon mapping

| Element | Target icon |
|---|---|
| Capabilities group | `library` |
| Orphans group | `question` |
| Existing capability | `symbol-namespace` |
| Drifted capability | `symbol-namespace` with `list.warningForeground` |
| Missing capability | `circle-outline` |
| Spec tier | `book` |
| Architecture tier | `type-hierarchy` |
| Coverage tier | `checklist` |
| Disabled/empty information | `info` |

The existing Living Specs icon mapping is already close to the target; preserve it.

### 6.4 Steering icon mapping

| Element | Target icon or asset |
|---|---|
| Companion | Existing moss asset |
| Provider | Official provider brand asset |
| Project | `root-folder` |
| User | `account` |
| Steering Docs | `files` |
| SpecKit Project Files | `library` |
| Constitution | `law` |
| Scripts | `terminal` |
| Templates | `files` |
| References | `references` |
| Agents | `hubot` |
| Skills | `tools` |
| Settings | `gear` |
| Warning | `warning` using warning theme color |

Leaf files can remain iconless to preserve indentation and reduce visual noise.

### 6.5 Provider icon correctness

Extract provider-icon selection into a testable resolver rather than embedding it in `SteeringItem.providerIcon()`.

Requirements:

- Reuse the same host IDE detection used by `getProviderDisplayName()`.
- `ide-chat` mappings:
  - VS Code -> Copilot logo
  - Cursor -> Cursor logo
  - Windsurf -> Windsurf logo
  - Antigravity or unknown -> neutral chat/Codicon fallback, not Copilot
- Add assets or an intentional brand treatment for:
  - Wibey CLI
  - Wibey (VS Code)
- Claude and Claude VS Code may share the Claude logo.
- Monochrome provider marks must keep light/dark variants.
- Unknown providers must fall back to a neutral `ThemeIcon('hubot')` or `ThemeIcon('comment-discussion')`, not an unrelated brand.

---

## 7. Copy system

### 7.1 Style rules

- Use short Title Case for view names, section labels, commands, and menus.
- Use sentence case for descriptions, empty states, notifications, and tooltips.
- Prefer verbs for actions: `New`, `Open`, `Filter`, `Sort`, `Copy`, `Reveal`.
- Avoid `Click to`; the interactive surface already communicates clickability.
- Use ellipses only when an action opens another selection or input step.
- Use **User**, not **Global**, for user-scoped provider configuration.
- Use **Complete**, not **Completed**, in action labels.
- Keep actual filenames, command names, provider names, and paths exact.
- Do not expose raw enum keys or kebab-case lifecycle values in user-facing copy.
- Avoid redundant nouns when the surrounding view supplies context, but be specific in context menus where the target may otherwise be unclear.

### 7.2 Command title changes

Keep command IDs unchanged and update their contributed titles:

| Command ID | Current title | Target title |
|---|---|---|
| `speckit.create` | Create New Spec | New Spec |
| `speckit.specs.filter` | Filter Specs… | Filter… |
| `speckit.specs.filter.clear` | Clear Specs Filter | Clear Filter |
| `speckit.specs.sort` | Sort Specs… | Sort… |
| `speckit.specs.collapseAll` | Collapse All Specs | Collapse All |
| `speckit.specs.expandAll` | Expand All Specs | Expand All |
| `speckit.markCompleted` | Mark as Completed | Mark Complete |
| `speckit.specs.setStatus` | Set status… | Set Status… |
| `speckit.group.markAllCompleted` | Mark all as Completed | Mark All Complete |
| `speckit.group.archiveAll` | Archive all | Archive All |
| `speckit.group.reactivateAll` | Reactivate all | Reactivate All |
| `speckit.steering.create` | Create Custom Steering | New Steering Document… |
| `speckit.specs.copyName` | Copy Name | Copy Spec Name |
| `speckit.specs.copyPath` | Copy Path | Copy Spec Path |
| `speckit.specs.revealInExplorer` | Reveal in Explorer View | Reveal in VS Code Explorer |
| `speckit.specs.reveal` | Reveal in File Explorer | Reveal in File Manager |
| `speckit.revealItemInExplorer` | Reveal in Explorer View | Reveal in VS Code Explorer |
| `speckit.revealItemInOS` | Reveal in File Explorer | Reveal in File Manager |
| `speckit.livingSpecs.drift` | Check Living-Spec Drift | Check for Drift |
| `speckit.livingSpecs.adopt` | Adopt Code Area into Living Spec | Adopt Code Area… |

Use `Delete Spec` in the spec-row menus. If retaining the shared `speckit.delete` command title as `Delete` is necessary for other surfaces, contribute a menu-specific title only if supported cleanly; otherwise leave the shared title and rely on the confirmation copy to name the spec.

Review the wording `Install spec-kit Extension`. At minimum normalize capitalization to `Install SpecKit Extension`. If the installed artifact is specifically the Companion extension/preset, prefer `Install Companion Extension`, but verify the product name before changing it.

### 7.3 Row descriptions

Specs:

- Active row: `T004 · 22h ago` when both values exist.
- Task only: `T004`.
- Time only: `22h ago`.
- Do not prefix descriptions with a decorative leading `·`.
- Duplicate name: retain the parent directory instead of status metadata.
- Missing document: `not created`.

Living Specs:

- Central capability: `central`.
- Colocated capability: folder path or `next to code`.
- Coverage: append `3/5 covered`.
- Drift: append `drift` without a decorative bullet; the warning-colored icon already supplies the visual signal.
- Missing capability: append `not created`.

Agents and skills:

- Standardize counts as `3 tools`, never `Tools: 3` in one place and `3 tools` in another.

### 7.4 Tooltips

Tooltips should add information rather than repeat the label.

Specs group examples:

- Active: `Specs in progress`
- Completed: `Specs you marked complete`
- Archived: `Archived specs`

Spec row template:

```text
<spec name>
Status: Ready to Implement
Last activity: Plan completed · 22h ago
```

Requirements:

- Map raw lifecycle statuses to friendly Title Case labels.
- Use line breaks rather than joining every clause with em dashes.
- Omit unavailable lines instead of showing `undefined` or empty punctuation.

Document row template:

```text
<label> — <friendly status>
<workspace-relative path>
```

Related document tooltip:

```text
<workspace-relative path>
```

Do not reconstruct a filename from the display label. Use the stored `filePath` or `resourcePath`.

Provider missing-file action examples:

- `Create project-level GEMINI.md`
- `Create user-level QWEN.md`
- `Create project-level AGENTS.md`

Never hard-code `CLAUDE.md` for all providers.

---

## 8. Toolbar actions

### 8.1 Specs title toolbar

The Specs title bar should show no more than four actions at once.

Always visible:

1. Filter
2. Sort
3. More Actions
4. New Spec, positioned as the trailing/rightmost primary action

Do not show a separate Clear Filter icon. When Filter is opened, prefill the input with the current query. Submitting an empty value clears the filter. Keep the `speckit.specs.filter.clear` command available from the Command Palette for users who prefer it and for backward compatibility.

Move these actions out of the permanent title bar:

- Collapse All / Expand All
- Install Companion/SpecKit extension
- Upgrade

Add a command such as `speckit.specs.moreActions` with an ellipsis icon. It should open a QuickPick with sections or separators:

```text
View
  Collapse All / Expand All

Maintenance
  Install Companion Extension     when applicable
  Upgrade…                         when applicable
```

The QuickPick must only include actions currently valid under the same context gates used by the existing title contributions.

#### Sort picker

Keep Sort as a direct, one-click title action. A native VS Code QuickPick is the correct control for this five-option choice; do not replace it with a custom webview, modal, or cycling icon button. Make the existing picker quieter:

- Title: `Sort Specs`
- Placeholder: `Choose sort order`
- Keep the native checkmark on the current selection.
- Use short labels and descriptions:

| Label | Description |
|---|---|
| Number | Default · Highest number first |
| Name | A–Z |
| Date Created | Newest first |
| Date Modified | Recently edited first |
| Workflow Step | Current progress |

Do not repeat `sort`, `mode`, `specs`, or `by` inside every option. Do not add detail rows; five compact single-line choices are faster to scan. Preserve type-to-filter behavior supplied by QuickPick, but do not add an extra explanatory paragraph.

### 8.2 Living Specs title toolbar

Keep two actions:

- Refresh
- Adopt Code Area… as the trailing/rightmost action

Both icons require clear contributed titles/tooltips.

### 8.3 Steering title toolbar

Keep two actions:

- Refresh
- New Steering Document… as the trailing/rightmost action

### 8.4 Settings & Feedback title toolbar

No title actions are necessary.

---

## 9. Hover actions

### 9.1 Spec rows

Show at most two icons on hover:

1. Resume, only when currently eligible
2. More Actions…

The More Actions submenu should contain, in this order and with separators/groups:

1. Set Status…
2. Lifecycle action appropriate to the current state:
   - Mark Complete
   - Archive
   - Reactivate
3. Copy Spec Name
4. Copy Spec Path
5. Reveal in VS Code Explorer
6. Reveal in File Manager
7. Delete, isolated in a final danger group

Do not add a separate permanent Set Status hover icon; it is an advanced recovery action and belongs in More Actions.

### 9.2 Spec document rows

- Existing core document: show Open Source File on hover.
- Related document: also show Open Source File when a valid file URI exists.
- Missing document: show no source action.
- Do not add hover feedback to non-interactive information rows.

### 9.3 Steering rows

- Keep Refine on generated steering documents where the command is valid.
- Keep Install on the uninstalled Companion row.
- Do not add inline reveal icons to every file row; reveal belongs in the right-click menu to avoid visual noise.

### 9.4 Living Specs rows

No new inline actions are required. Open remains the primary row action; drift, coverage, and reveal actions remain in the context menu.

---

## 10. Right-click menus

### 10.1 Spec row context menu

Make the standard right-click menu match the hover More Actions submenu. Use explicit group names and numeric ordering; do not put Delete in the same undifferentiated modification group as status and lifecycle actions.

Target grouping:

```text
1_status
  Set Status…

2_lifecycle
  Mark Complete / Archive / Reactivate

3_copy
  Copy Spec Name
  Copy Spec Path

4_reveal
  Reveal in VS Code Explorer
  Reveal in File Manager

5_danger
  Delete
```

Keep current lifecycle `when` clauses and multi-select behavior.

### 10.2 Group header context menus

Keep lifecycle-specific bulk actions and confirmations:

- Active: Mark All Complete, Archive All
- Completed: Reactivate All, Archive All
- Archived: Reactivate All

Use Title Case. Keep filtered-list semantics and skip items already in the target state.

### 10.3 Document context menus

All existing core and related documents should offer:

- Reveal in VS Code Explorer
- Reveal in File Manager

Only offer Open Source File as an inline action, not as a redundant context item, unless native discoverability testing shows it is needed.

### 10.4 Living Specs context menus

Existing capability:

- Check for Drift
- Check Requirement Coverage
- Reveal in VS Code Explorer
- Reveal in File Manager

Tier and orphan file:

- Reveal in VS Code Explorer
- Reveal in File Manager

Missing capability:

- No reveal action until a file exists.

Add `living-specs-orphan` to the reveal menu eligibility. The generic reveal handler must resolve the orphan's exact path.

### 10.5 Steering context menus

Every file-backed Steering item should offer both reveal actions, including:

- generated steering documents;
- provider steering files;
- provider settings;
- agents;
- skills;
- Constitution;
- scripts;
- templates;
- reference files;
- Companion configuration, commands, and templates.

Only generated steering documents should offer Refine and Delete Steering. Do not expose destructive actions for provider or SpecKit-owned files unless a separate product requirement explicitly authorizes them.

Prefer a shared predicate or a common `file-backed` context-value suffix/flag over a long set of duplicated `when` clauses if it can be expressed safely in VS Code menu contributions. Otherwise enumerate the supported context values and test the list.

---

## 11. Accessibility and theme requirements

- Preserve native keyboard navigation and selection behavior.
- Every icon-only title or inline action must have a clear command title that works as its tooltip.
- Do not add hover transitions or animation to high-frequency tree rows.
- Use `ThemeIcon` and `ThemeColor` for semantic states.
- Verify light, dark, high-contrast light, and high-contrast dark themes.
- Verify 100%, 125%, 150%, and 200% UI zoom where available.
- Status must remain understandable without color:
  - different icon shapes;
  - group labels;
  - descriptions;
  - friendly tooltip status.
- Do not use emoji characters as icons or labels.
- Avoid custom SVGs with fine gradients, shadows, or filters at 16 px.
- Ensure spinning state is not the only running-state indication; the tooltip or description should still communicate that work is running.
- Empty-state rows must not have hover styling or commands unless they are genuinely actionable.

---

## 12. Implementation plan

### Phase 1 — Lock behavior and add manifest tests

1. Add tests that parse `package.json` and assert:
   - target view names;
   - maximum Specs title-toolbar action set;
   - explicit context-menu grouping and danger placement;
   - orphan reveal eligibility;
   - Steering reveal eligibility for all intended file-backed contexts;
   - lifecycle `when` clauses remain intact.
2. Preserve existing tests for Mark Complete eligibility, bulk actions, Resume gates, and provider labels.
3. Add test helpers for locating contributed commands and menu items by ID.

Files:

- `package.json`
- `src/features/specs/__tests__/specExplorerProvider.test.ts`
- a new focused manifest test if that keeps contribution assertions readable

### Phase 2 — Copy and view names

1. Rename Spec Explorer to Living Specs.
2. Rename Settings to Settings & Feedback.
3. Apply the command-title copy table without changing IDs.
4. Normalize group and tooltip capitalization.
5. Replace raw status tooltip values with a shared friendly status formatter.
6. Fix provider missing-file tooltips so they use the configured provider filename.
7. Fix related-document tooltips so they use exact paths.
8. Standardize agent and skill count descriptions.
9. Remove leading decorative dots from spec row descriptions.

Files:

- `package.json`
- `src/features/specs/specExplorerProvider.ts`
- `src/features/specs/lastTransition.ts` only if formatting belongs there
- `src/features/steering/steeringExplorerProvider.ts`
- `src/features/settings/overviewProvider.ts`

### Phase 3 — Specs density and status icons

1. Change individual spec default expansion from expanded to collapsed.
2. Keep Active group expanded and Completed/Archived collapsed.
3. Preserve explicit Collapse All / Expand All behavior.
4. Render completed document icons consistently under completed and archived specs.
5. Give existing partial/non-current documents an intentional muted status icon if it improves scanability without overstating completion.
6. Add tests for default and toggled collapsible states.
7. Add tests for document icon behavior across active, implemented, completed, and archived parents.

Files:

- `src/features/specs/specExplorerProvider.ts`
- `src/features/specs/__tests__/specExplorerProvider.test.ts`
- `src/features/specs/specsSidebarState.ts` if default expansion ownership belongs in the sidebar facade

### Phase 4 — Replace decorative category SVGs

1. Replace Specs group SVGs with themed Codicons.
2. Replace generic Steering category SVGs with themed Codicons.
3. Keep moss and official provider assets.
4. Remove unused SVG files only after confirming no code, docs, or packaging path references them.
5. Update `NOTICE.md` only if removing assets changes what is distributed and listed.
6. Add icon mapping tests where the tree model already exposes icon paths/types.

Files:

- `src/features/specs/specExplorerProvider.ts`
- `src/features/steering/steeringExplorerProvider.ts`
- `assets/icons/specs/`
- `assets/icons/steering/`
- `NOTICE.md` if necessary

### Phase 5 — Provider icon resolver

1. Extract a pure/testable provider icon key resolver.
2. Reuse host IDE detection from the provider display-name path.
3. Add Wibey branding or a documented neutral fallback.
4. Use a neutral chat icon for unknown IDE Chat hosts.
5. Test every supported provider ID and host IDE combination.

Files:

- `src/features/steering/steeringExplorerProvider.ts`
- optionally a new `src/features/steering/providerIcon.ts`
- `src/ai-providers/ideChatProvider.ts` only if a shared public host resolver is required
- `assets/icons/providers/`
- provider/steering tests

### Phase 6 — Toolbar consolidation

1. Add the Specs More Actions command.
2. Move Collapse/Expand, Install, and Upgrade into its QuickPick.
3. Keep Filter, Sort, More Actions, and New Spec in the title bar.
4. Remove Clear Filter from the title bar; prefill the current query in Filter and treat an empty submission as clear.
5. Simplify the Sort picker copy while preserving its current-selection checkmark.
6. Preserve command-palette availability for every moved or hidden action.
7. Test the More Actions QuickPick composition under:
   - Companion installed/uninstalled;
   - SpecKit detected/not detected;
   - CLI installed/not installed;
   - all-collapsed/expanded state.
8. Test the Sort QuickPick labels, descriptions, selected item, and persistence.

Files:

- `package.json`
- `src/features/specs/specCommands.ts`
- `src/features/specs/specsSidebarState.ts`
- `src/features/specs/specCommands.test.ts`

### Phase 7 — Context-menu coverage and ordering

1. Rebuild the direct spec-row context menu with the same groups as More Actions.
2. Add related-document source hover support.
3. Add Living Specs orphan reveal support.
4. Add reveal support to every file-backed Steering row.
5. Keep destructive Steering actions restricted to generated steering documents.
6. Verify the generic reveal resolver receives an exact URI/path from every newly eligible tree item.
7. Add manifest and handler tests for each context value.

Files:

- `package.json`
- `src/features/specs/specCommands.ts`
- `src/features/specs/specExplorerProvider.ts`
- `src/features/specs/livingSpecsExplorerProvider.ts`
- `src/features/steering/steeringExplorerProvider.ts`
- related tests

### Phase 8 — Steering hierarchy

1. Build root sections in explicit target order.
2. Move missing Project/User rule actions into their respective provider groups.
3. Rename SpecKit Files to SpecKit Project Files.
4. Ensure empty categories are omitted.
5. Remove fake loading flicker if `refresh()` can synchronously invalidate and let actual asynchronous children communicate loading. Do not retain a fixed 100 ms loading state solely for visual effect.
6. Add tests for multiple providers, installed/uninstalled Companion, missing steering files, and absent SpecKit content.

Files:

- `src/features/steering/steeringExplorerProvider.ts`
- Steering provider tests

### Phase 9 — Documentation and visual QA

1. Update `docs/sidebar.md` to match:
   - view names;
   - default expansion;
   - title toolbar;
   - icon meanings;
   - hover actions;
   - right-click menus;
   - Steering hierarchy.
2. Replace stale sidebar screenshots.
3. Capture at least:
   - dark theme, typical active/completed data;
   - light theme;
   - active filter;
   - hover actions;
   - spec context menu;
   - Living Specs empty and populated states;
   - Steering with provider and Companion expanded;
   - high-contrast theme.
4. Run compile, full Jest suite, and packaging build.

Files:

- `docs/sidebar.md`
- `docs/screenshots/sidebar.png` and any related screenshot documentation

---

## 13. Test plan

### 13.1 Automated tests

Required assertions:

- `npm run compile` passes.
- Full Jest suite passes with no changed snapshots unless intentionally introduced.
- Package manifest tests verify menu order, grouping, titles, icons, and gates.
- Specs provider tests verify:
  - group order and counts;
  - default collapsed spec nodes;
  - Active/Completed/Archived group defaults;
  - filter and sort behavior unchanged;
  - duplicate-name descriptions unchanged;
  - friendly status tooltips;
  - exact related-document tooltip paths;
  - icon state for new, active, running, implemented, completed, and archived specs;
  - document icons under each lifecycle.
- Living Specs tests verify:
  - disabled and empty states never return a blank root;
  - capability and orphan grouping;
  - exact path availability for reveal;
  - missing capability has no reveal command.
- Steering tests verify:
  - target root order;
  - missing rule actions are nested under Project/User;
  - provider-specific tooltip filenames;
  - provider icon resolution for all providers and IDE hosts;
  - file-backed rows expose resolvable paths.
- Specs More Actions tests verify every context combination.

### 13.2 Manual QA matrix

Test on macOS, Windows, or Linux where available, especially the file-manager reveal label and behavior.

| Scenario | Expected result |
|---|---|
| Fresh workspace with no specs | Specs shows the existing welcome/empty experience; no blank broken tree. |
| Four active specs | Active expanded; each spec collapsed. |
| 200+ completed specs | Completed collapsed; no initial sidebar flood. |
| Active filter | Filter input reopens with the current query; submitting empty clears it; counts and bulk actions apply to visible results. |
| Sort picker | Opens directly from the title icon with concise options and a checkmark on the current order. |
| Running spec | Spinner, friendly tooltip, and Resume/action gates remain correct. |
| Implemented spec | Yellow beaker and Mark Complete action. |
| Completed spec expanded | Child steps show coherent completed status icons. |
| Living Specs disabled | Informative `Living Specs are off` row. |
| Living Specs enabled but empty | `No living specs yet` with Adopt guidance. |
| Living Specs orphan | Both reveal actions work. |
| Claude/Gemini/Qwen/Codex/Wibey | Correct provider name, filename tooltips, and icon. |
| IDE Chat in VS Code/Cursor/Windsurf | Label and icon refer to the same host product. |
| IDE Chat in unknown host | Neutral IDE Chat label/icon; never Copilot branding by default. |
| Missing provider rule | Create action appears inside Project or User group. |
| Steering file-backed rows | Reveal actions appear and target exact files. |
| Dark/light/high-contrast themes | Icons remain legible; statuses do not depend on color alone. |
| Keyboard-only navigation | All rows, disclosure controls, title actions, inline actions, and menus are reachable. |

---

## 14. Acceptance criteria

The redesign is complete only when all of the following are true:

1. No generic category uses a detailed emoji-style SVG where a Codicon exists.
2. SpecKit identity and official provider marks are the only intentional custom-art exceptions.
3. Provider labels and icons always agree, including IDE Chat and Wibey.
4. The view is named Living Specs, not Spec Explorer.
5. The view is named Settings & Feedback, not Settings.
6. Individual spec rows start collapsed.
7. Completed and Archived groups start collapsed.
8. A populated sidebar with hundreds of completed specs does not flood the initial viewport.
9. No empty Living Specs state renders as a blank panel.
10. The Specs title bar shows at most four actions simultaneously.
11. Sort remains a direct title action and uses the compact native QuickPick defined in this plan.
12. Collapse/expand, install, and upgrade remain reachable through More Actions and the Command Palette.
13. Hover More Actions and the direct right-click spec menu use the same safe order.
14. Delete is isolated as the final danger action.
15. All file-backed Living Specs and Steering rows have both reveal actions.
16. Missing files do not expose reveal actions.
17. Tooltips never hard-code the wrong provider filename.
18. Related-document tooltips show exact paths.
19. Raw lifecycle keys are not visible in tooltips.
20. Command and group labels follow consistent Title Case.
21. Existing lifecycle, multi-select, filter, sort, Resume, and bulk-action behavior remains unchanged.
22. TypeScript compilation, Jest, and the production packaging build pass.
23. Sidebar documentation and screenshots match the shipped UI.

---

## 15. Suggested implementation order for Claude

Use this order to reduce rework:

1. Add manifest and tree-presentation regression tests.
2. Apply copy and view-name changes.
3. Change default expansion and document-status icon logic.
4. Replace generic custom SVG usage with Codicons.
5. Extract and test provider icon resolution.
6. Consolidate the Specs title toolbar.
7. Normalize hover and right-click coverage.
8. Rebuild Steering root hierarchy.
9. Run full automated and manual QA.
10. Update documentation and screenshots last.

Keep commits small enough to review by concern. A reasonable split is:

1. `test: lock sidebar contribution behavior`
2. `refactor: normalize sidebar copy and view names`
3. `fix: reduce spec tree default expansion`
4. `refactor: standardize sidebar icon system`
5. `fix: align provider labels and icons`
6. `feat: consolidate specs toolbar actions`
7. `fix: normalize sidebar context menus`
8. `refactor: clarify steering hierarchy`
9. `docs: update sidebar reference and screenshots`
