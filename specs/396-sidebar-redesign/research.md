# Phase 0 Research: Sidebar Redesign

## Decision — Lock the contributed manifest with a parsing test before touching anything

**Decision**: Add `src/features/specs/__tests__/manifest.test.ts` that reads `package.json` and asserts the contributed view titles, the Specs title-bar action ceiling, the spec-row menu grouping (including Delete's isolation), reveal eligibility per context value, and the lifecycle `when` clauses. Land it first, in its pre-change form where it locks today's behavior, then evolve its expectations alongside each phase.

**Rationale**: Every acceptance criterion in the design plan is a statement about the *manifest* or about a tree item's `iconPath` / `collapsibleState` / `tooltip`. Neither is covered today, so a presentation refactor of this size has nothing holding it down. A manifest test is cheap (plain JSON parsing, no VS Code host) and is the only way to keep "at most four title actions" and "Delete is in its own group" true a year from now.

**Alternatives considered**: Integration tests against a real VS Code host — far slower, needs `@vscode/test-electron`, and still cannot assert the *ceiling* on title actions declaratively. Rejected.

## Decision — Extract the provider-icon choice into a pure resolver

**Decision**: Create `src/features/steering/providerIcon.ts` exporting a pure `resolveProviderIconKey(providerId, host)` that returns a discriminated result (`{ kind: 'asset', file }`, `{ kind: 'mono', name }`, or `{ kind: 'codicon', id }`), plus a `detectHostIde()` that reuses the same signals `getProviderDisplayName()` already uses (`vscode.env.uriScheme`, `vscode.env.appName`). `SteeringItem.providerIcon()` becomes a thin adapter that turns the result into a `Uri` / `{light,dark}` / `ThemeIcon`.

**Rationale**: Today the icon logic lives inline in the tree-item constructor and disagrees with the label path: `getProviderDisplayName()` returns `'IDE Chat'` for an unrecognized host, while the icon code falls through to the **Copilot** logo. That is a live bug — a Cursor-fork or Antigravity user sees a competitor's brand on their own row. The only way to prove the label and the icon agree for every (provider × host) pair is to make both testable and enumerate the matrix.

**Alternatives considered**: Fixing the ternary in place. Rejected — untestable inside a `TreeItem` constructor that reaches into `extensionUri`, and it would drift again the next time a provider is added.

## Decision — Wibey ships a documented neutral fallback, not an invented mark

**Decision**: Both Wibey providers (`wibey`, `wibey-vscode`) resolve to `ThemeIcon('comment-discussion')`, recorded in the resolver's table as an explicit, intentional entry (not an accidental default) and documented in `docs/sidebar.md`.

**Rationale**: The repository ships no official Wibey mark and we must not draw one — an invented logo for a real company is worse than an honest neutral glyph. Making it an explicit table row (rather than the `default:` branch) is what turns "accidental fallback" into "documented fallback", and the resolver test asserts it by name so a future asset drop is a deliberate change.

**Alternatives considered**: Reusing the generic robot glyph the code falls back to today — indistinguishable from "unknown provider", which is exactly the ambiguity the plan asks us to remove. Rejected.

## Decision — Consolidate the Specs toolbar behind a QuickPick rather than a VS Code submenu

**Decision**: Add `speckit.specs.moreActions` (icon `$(ellipsis)`) as the third title action; its handler opens a `showQuickPick` with separator-delimited sections (View / Maintenance) whose entries are filtered by the same context probes the removed title contributions used (`speckit.companion.installed`, `speckit.detected || speckit.cliInstalled`, the collapse-all flag).

**Rationale**: `view/title` supports submenus, but a submenu's items are gated by `when` clauses evaluated against context keys the extension already sets — which would keep the gating declarative but leaves no place to show the *current* collapse state as a single toggle line, and gives no way to test composition. A QuickPick built by a pure `buildMoreActions(ctx)` function makes the composition unit-testable against every context combination, which is exactly what the design plan's test plan asks for.

**Alternatives considered**: A `view/title` submenu contribution. Rejected for the reason above; the commands all stay in the Command Palette either way.

## Decision — Filter clears on empty submission; the clear icon leaves the title bar

**Decision**: `speckit.specs.filter` keeps its prefill and now treats an empty submitted string as a clear (`filterState.setQuery('')` already normalizes to cleared). `speckit.specs.filter.clear` stays registered and stays in the Command Palette and in the no-match welcome view, but its `view/title` contribution is removed.

**Rationale**: This buys back one of the four title slots without removing a capability, and it is the behavior users expect from a filter box. Keeping the command registered preserves the welcome-view button and any user keybinding.

**Alternatives considered**: Keeping the clear icon and dropping Sort to a More Actions entry. Rejected — the design plan explicitly requires Sort to stay a direct title action.

## Decision — Spec rows collapse by default via the provider's `expandAllSpecs` flag flipping to `false`

**Decision**: `SpecExplorerProvider.expandAllSpecs` initializes to `false`. The existing id-encoding trick (`spec:<path>:e|c`) that makes VS Code honor a re-emitted `collapsibleState` is untouched, as is the toggle command and the `speckit.specs.allCollapsed` context key — the key's initial value is simply now `true`.

**Rationale**: This is a one-word change that satisfies the density requirement without touching the group defaults (Active stays `Expanded`, Completed/Archived stay `Collapsed`) or the toggle machinery. The context key must be seeded at activation so the More Actions entry reads "Expand All" on a fresh window.

**Alternatives considered**: Persisting the collapse state to workspace state. Rejected — out of scope, and the design plan explicitly says the toggle may remain session-only.

## Decision — Document status icons stop depending on the parent's lifecycle

**Decision**: The `spec-document` icon branch drops the `status !== COMPLETED && status !== ARCHIVED` guard. A step whose file exists and whose history says it completed renders the green pass icon whatever the parent's lifecycle is; the current step renders the blue filled circle; an existing but non-current, non-completed step renders a muted `circle-outline`; a missing file renders no icon and keeps its `not created` description.

**Rationale**: Today expanding a completed spec shows structurally identical rows with no icons at all, which reads as "nothing happened here". The parent's green beaker already carries the parent's state; the children should carry theirs.

**Alternatives considered**: Muting the children's icons under an archived parent. Rejected as unnecessary complexity — the plan permits the same icons at normal color.

## Decision — Steering root is built as an explicit ordered list

**Decision**: `getChildren(undefined)` builds the root by pushing sections in the target order — Companion, Provider, Steering Docs, SpecKit Project Files, References — and drops the `items.splice(Math.min(1, items.length), 0, companionNode)` hack. The two loose `Create Global Rule` / `Create Project Rule` rows move into `getProviderUserChildren()` / `getProviderProjectChildren()`, where they render only when the corresponding file is absent and their tooltip names the *configured provider's* filename (`providerPaths.steeringFile`), not a hard-coded `CLAUDE.md`.

**Rationale**: The `splice` is order-by-accident and breaks the moment a section above it disappears. Nesting the create actions puts them where their effect is, and fixes the "Click to create Global CLAUDE.md" tooltip that lies for every non-Claude provider.

**Alternatives considered**: Keeping the root rows and only fixing the tooltip. Rejected — #435 explicitly calls out the loose rows.

## Decision — Delete the two icon asset directories rather than leave them orphaned

**Decision**: Once no code path references `assets/icons/specs/*` or `assets/icons/steering/*`, delete both directories and update `NOTICE.md` to drop the Fluent Emoji attribution (the remaining custom art — `moss.svg`, `seedling.svg`, and the provider marks — keeps its own attribution).

**Rationale**: The design plan's non-goal list forbids *renaming* files, not removing dead assets, and shipping unreferenced SVGs in the `.vsix` is dead weight that invites a future re-introduction. `NOTICE.md` must stay truthful about what is distributed.

**Alternatives considered**: Leaving the files in place. Rejected — a future reader would reasonably assume they're live.
