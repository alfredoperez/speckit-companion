# Doc Sync

**Docs are part of the change, not a follow-up.** Any time you touch behavior, configuration, commands, the pipeline, or architecture, update the matching doc in the *same* change — before the work counts as done. README.md is the single source of truth for configuration, workflows, and features. Before finishing, scan the maps below and the long-form references (`docs/*.md`, the two READMEs, the relevant CHANGELOG); a behavior change without its doc update is an incomplete change. When in doubt, look at how an existing feature is documented and follow the same pattern.

## Which doc for which area

| Area you changed | Also update |
|---|---|
| Spec viewer statuses, badges, buttons, step tab behavior | `docs/viewer-states.md` (full state machine: status lifecycle, footer button matrix, badge text logic, step tab visual states, data flow) |
| Companion pipeline shape — the workflow choice (stock `speckit` vs `companion`) on `speckit.defaultWorkflow`, the `companion-standard` preset, its command bodies, the shared timing partial, the classify/routing step, the preset reconciler | `docs/template-profiles.md`. Note: the former `templateProfile` / `turboWorkflowPicker` / `complexityFastPath` toggles and the `companion-turbo` preset are **retired** — don't reintroduce them; `speckit.companion.templateProfile` survives only in `src/core/settingsMigration.ts` to migrate old persisted values. |
| Project structure, modules, architecture | `docs/architecture.md` |
| `.spec-context.json` capture — lifecycle hooks, `write-context.py`, the timing part (`speckit-extension/presets/_parts/timing.md` / `promptBuilder.ts`), preset command overrides, `derive-from-files.py`, the eval (`check_capture.py`) | `docs/capture-and-timing.md` (capture model, reliability principle, install paths, known timing gaps, what the eval asserts). Don't re-derive this flow from code — this doc is the map. |
| Sidebar (filter, sort, lifecycle buttons, badge tiers, tree icons, transition logging) | `docs/sidebar.md` |
| The spec-kit workflow definition (`speckit-extension/workflows/speckit-companion.workflow.yml`), its `classify`/`mark-complete` commands, or the routing step | `docs/template-profiles.md` (routing-step reference) + `docs/capture-and-timing.md` (run/resume capture path) + `speckit-extension/README.md` + an `[Unreleased]` entry in `speckit-extension/CHANGELOG.md` — never the root README/CHANGELOG/`package.json`, never `extension.yml` `version`. Capture is unchanged on this path: the engine dispatches the same `speckit.companion.*` commands, so the same hooks/bodies write `.spec-context.json`. |
| Webview UI, styling, design tokens, capture stories, or the Teamboard fixtures | Regenerate `docs/screenshots/generated/` with `npm run clips:capture` and re-shoot + re-render any affected `media/feature-clips/` composition before shipping docs. A re-render doesn't stop at the MP4: follow the chain down through `clips:render`, `clips:stills`, `clips:gifs` and `clips:sync` or the README and the site keep showing the old frames. Rules in `docs/visual-assets.md`; the command-by-command chain is the `feature-clip` skill. |
| The capture palette (`.storybook/capture-theme.ts`), the capture scripts, a `media/feature-clips/` composition, or a clip's `STORYBOARD.md` | `docs/visual-assets.md` (how every image, GIF, web clip and mascot derivative is made, and what a retheme costs — the full ordered sequence lives there). Scaffold a new composition with `npm run clips:new`, which writes the `CLIP_CAPTURES` stub and the `media/manifest.json` entry that a hand copy would skip. Run `npm run clips:check` (storyboard drift plus the manifest) before finishing. |
| A feature's asset outputs, the paths a README or the site reads, or `media/manifest.json` itself | `docs/media-manifest.md` (the bundle contract: which surface reads which output, alt text, published-filename rules) |
| Anything that regenerates `media/web/` — a retheme, a re-render, `clips:render`, `clips:stills`, `lightwell` | Commit the regenerated files. `media/web/` is **tracked**, deliberately: a deploy can't rebuild it, and while it was ignored the live site rendered every clip and screenshot as a broken image. Reasoning in `docs/media-manifest.md`; `npm run clips:sync` copies them into the site, and the site's own build runs it too. |
| The marketing/docs site under `website/` | `website/README.md` and, if the structure moved, the website paragraph in `docs/architecture.md`. It belongs to neither product's feature list, so **not** the root README, **not** `speckit-extension/README.md`, and **not** either CHANGELOG. |
| Webview component with a sibling `.stories.tsx` | Update the stories in the same change to cover the new state/variant. Storybook is the visual baseline — stale stories are worse than missing stories because they lie. If a non-trivial component changes materially and no `.stories.tsx` exists, add one in the same PR. |

## Feature → README section map

| Change you made | README section to update |
|-----------------|--------------------------|
| New AI provider | "Supported AI Providers" matrix (add column) + provider count anywhere it's stated (e.g. "Six providers ship today" in "Why it exists") + `package.json` `contributes.configuration["speckit.aiProvider"].enum` must match |
| New canonical workflow status | "Header badge color tiers" in `docs/sidebar.md` + "Status vocabulary" under Spec Context in README |
| New configuration setting | "Configuration" section in README (add subsection with JSON example + value table) |
| New sidebar action / right-click menu item | `docs/sidebar.md` (full reference) + the brief "Sidebar at a Glance" summary in README |
| New keyboard or visual safety affordance | "Safety Affordances for Destructive Actions" in README |
| New workflow phase or sub-document type | "Spec-Driven Phases" in README + Step Properties table under Custom Workflows |
| New custom command type | "Custom Commands" properties table in README |
| New platform support / shell support | "Platform Support" table in README |
| New webview UI element (header, badge, tab, etc.) | "Reading Specs" subsection in README + retake associated screenshot |
| Bug fix that changes documented behavior | The README section that documented the broken behavior |
| Change under `speckit-extension/` (commands, scripts, hooks, manifest) | `speckit-extension/README.md` + an `[Unreleased]` entry in `speckit-extension/CHANGELOG.md` — **not** the root README/CHANGELOG/`package.json`, and **not** `extension.yml` `version` / the README version badge / `publishing.md` (`/publish-speckit-ext` owns the bump). A new command must be added to `extension.yml` `provides.commands` or the installer skips it. |

## Per-release checklist (run before tagging a version)

> This checklist is for the **VS Code extension** (`/publish`/`/ship`, `v*` tag). The **spec-kit extension** has its own flow — see `/publish-speckit-ext` and `speckit-extension/docs/publishing.md` (prefixed `speckit-ext-v*` tag, `.zip` archive, catalog issue).

1. Run `git diff $(git describe --tags --abbrev=0)..HEAD -- README.md` to see what was already updated since the last tag.
2. Cross-check `CHANGELOG.md` entries since the last release against the map above.
3. For every CHANGELOG bullet under "New Features," confirm a README section was touched. If not, add one.
4. Update the "Recently Shipped" block at the top of README with the current and previous two releases.
5. Verify `package.json` `contributes.configuration["speckit.aiProvider"].enum` matches the README provider matrix (count + names).
6. Verify `package.json` `engines.vscode` matches the README "VS Code" badge.
7. Re-render any screenshot whose UI changed in this release and refresh its caption if the value prop shifted. **Keep screenshot filenames stable — overwrite in place, never rename or delete** (see the gotcha in `CLAUDE.md`).
8. Run `npm run clips:check`. Broken must be zero — a broken count is a 404 on the published Marketplace listing, not a to-do item.

## Changelog voice

Changelog entries are **release notes for users**, not commit messages. Lead with the observable change — what a user can now do, or what stopped going wrong. Keep the things users actually touch: setting keys (`speckit.defaultWorkflow`), command names (`/speckit.companion.resume`), config files they edit, and the install commands they run. **Drop internal file and symbol names** — `promptBuilder.ts`, `sync_tasks()`, `write-context.py --task …`, on-disk field names like `history[]`/`transitions[]`. Those belong in the commit message or PR description. The test: would the entry make sense to someone who has never opened `src/`? If it only lands for someone who has, it's too deep — move the mechanism out and keep the effect. Applies to both changelogs (root and `speckit-extension/`).
