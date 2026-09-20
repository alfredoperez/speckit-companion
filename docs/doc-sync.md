# Doc Sync

**Docs are part of the change, not a follow-up.** Any time you touch behavior, configuration, commands, the pipeline, or architecture, update the matching doc in the *same* change — before the work counts as done. README.md is the single source of truth for configuration, workflows, and features. Before finishing, scan the maps below and the long-form references (`docs/*.md`, the two READMEs, the relevant CHANGELOG); a behavior change without its doc update is an incomplete change. When in doubt, look at how an existing feature is documented and follow the same pattern.

## Which doc for which area

Most of what used to be narrated here now lives in living specs — validated by `python3 apps/speckit-extension/scripts/living_validate.py` and drift-watched against the code, instead of a doc nothing checks. Update the covering spec(s) in the same change (`<!-- touches: -->` names the exact files), not a doc.

| Area you changed | Also update |
|---|---|
| Spec viewer statuses, badges, buttons, step tab behavior | The `viewer-ui-*` specs under `apps/vscode/webview/src/spec-viewer/` and the `spec-viewer-*` specs under `apps/vscode/src/features/spec-viewer/` |
| Companion pipeline shape — the workflow choice (stock `speckit` vs `companion`) on `speckit.defaultWorkflow`, the `companion-standard` preset, its command bodies, the shared timing partial, the classify/routing step, the preset reconciler | The `commands-*` specs under `capabilities/companion-commands/` and the `workflows-*` specs under `capabilities/workflows/`. Note: the former `templateProfile` / `turboWorkflowPicker` / `complexityFastPath` toggles and the `companion-turbo` preset are **retired** — don't reintroduce them; `speckit.companion.templateProfile` survives only in `apps/vscode/src/core/settingsMigration.ts` to migrate old persisted values. |
| Project structure, modules, architecture | `docs/architecture.md` |
| `.spec-context.json` capture — lifecycle hooks, `write-context.py`, the timing part (`apps/speckit-extension/presets/_parts/timing.md` / `promptBuilder.ts`), preset command overrides, `derive-from-files.py`, the eval (`check_capture.py`) | `apps/vscode/src/core/core-spec-context.spec.md` (the on-disk contract) and the `capture-runtime-*` specs under `apps/speckit-extension/scripts/` (capture model, install paths, what the eval asserts). Don't re-derive this flow from code — the specs are the map. |
| Sidebar (filter, sort, lifecycle buttons, badge tiers, tree icons, transition logging) | the site's [sidebar reference](https://speckit-companion.dev/docs/anatomy/the-sidebar/) |
| The Get Started walkthrough (`contributes.walkthroughs`, `assets/walkthrough/`) | `docs/getting-started.md` (the step table) + `capabilities/media-pipeline/asset-build.spec.md` (which panels are still placeholders and what the real screenshots must show). Keep the step copy consistent with `contributes.viewsWelcome`: the two surfaces cover the same ground and must not contradict each other. |
| The spec-kit workflow definition (`apps/speckit-extension/workflows/speckit-companion.workflow.yml`), its `classify`/`mark-complete` commands, or the routing step | The `workflows-*` specs (routing-step reference) + the `capture-runtime-*` specs (run/resume capture path) + `apps/speckit-extension/README.md` + an `[Unreleased]` entry in `apps/speckit-extension/CHANGELOG.md` — never the root README/CHANGELOG/`package.json`, never `extension.yml` `version`. Capture is unchanged on this path: the engine dispatches the same `speckit.companion.*` commands, so the same hooks/bodies write `.spec-context.json`. |
| Webview UI, styling, design tokens, capture stories, or the Teamboard fixtures | Regenerate `docs/screenshots/generated/` with `npm run clips:capture` and re-shoot + re-render any affected `content/media/feature-clips/` composition before shipping docs. A re-render doesn't stop at the MP4: follow the chain down through `clips:render`, `clips:stills`, `clips:gifs` and `clips:sync` or the README and the site keep showing the old frames. Rules in `capabilities/media-pipeline/asset-build.spec.md`; the command-by-command chain is the `feature-clip` skill. |
| The capture palette (`.storybook/capture-theme.ts`), the capture scripts, a `content/media/feature-clips/` composition, or a clip's `STORYBOARD.md` | `capabilities/media-pipeline/asset-build.spec.md` (how every image, GIF, web clip and mascot derivative is made and checked). Scaffold a new composition with `npm run clips:new`, which writes the `CLIP_CAPTURES` stub and the `content/media/manifest.json` entry that a hand copy would skip. Run `npm run clips:check` (storyboard drift plus the manifest) before finishing. |
| A feature's asset outputs, the paths a README or the site reads, or `content/media/manifest.json` itself | `capabilities/media-pipeline/asset-build.spec.md` (the bundle contract: which surface reads which output, alt text, published-filename rules) |
| Anything that regenerates `content/media/web/` — a retheme, a re-render, `clips:render`, `clips:stills`, `lightwell` | Commit the regenerated files. `content/media/web/` is **tracked**, deliberately: a deploy can't rebuild it, and while it was ignored the live site rendered every clip and screenshot as a broken image. `npm run clips:sync` copies them into the site, and the site's own build runs it too. |
| The marketing/docs site under `apps/website/` | `apps/website/README.md` and, if the structure moved, the website paragraph in `docs/architecture.md`. It belongs to neither product's feature list, so **not** the root README, **not** `apps/speckit-extension/README.md`, and **not** either CHANGELOG. |
| Webview component with a sibling `.stories.tsx` | Update the stories in the same change to cover the new state/variant. Storybook is the visual baseline — stale stories are worse than missing stories because they lie. If a non-trivial component changes materially and no `.stories.tsx` exists, add one in the same PR. |

## Feature → README section map

| Change you made | README section to update |
|-----------------|--------------------------|
| New AI provider | "Supported AI Providers" matrix (add column) + provider count anywhere it's stated (e.g. "Six providers ship today" in "Why it exists") + `package.json` `contributes.configuration["speckit.aiProvider"].enum` must match |
| New canonical workflow status | the website's [spec viewer anatomy](https://speckit-companion.dev/docs/anatomy/anatomy-of-the-spec-viewer) (header badge color tiers) + "Status vocabulary" under Spec Context in README |
| New configuration setting | "Configuration" section in README (add subsection with JSON example + value table) + the website's [Configuration reference](https://speckit-companion.dev/docs/reference/configuration) |
| New sidebar action / right-click menu item | the website's [sidebar reference](https://speckit-companion.dev/docs/anatomy/the-sidebar) (full reference) + the brief "Sidebar at a Glance" summary in README |
| New keyboard or visual safety affordance | "Safety Affordances for Destructive Actions" in README |
| New workflow phase or sub-document type | "Spec-Driven Phases" in README + Step Properties table under Custom Workflows |
| New custom command type | "Custom Commands" properties table in README |
| New platform support / shell support | "Platform Support" table in README |
| New webview UI element (header, badge, tab, etc.) | "Reading Specs" subsection in README + retake associated screenshot |
| Bug fix that changes documented behavior | The README section that documented the broken behavior |
| Change under `apps/speckit-extension/` (commands, scripts, hooks, manifest) | `apps/speckit-extension/README.md` + an `[Unreleased]` entry in `apps/speckit-extension/CHANGELOG.md` — **not** the root README/CHANGELOG/`package.json`, and **not** `extension.yml` `version` / the README version badge / `publishing.md` (`/publish-speckit-ext` owns the bump). A new command must be added to `extension.yml` `provides.commands` or the installer skips it. |

## Per-release checklist (run before tagging a version)

> This checklist is for the **VS Code extension** (`/publish`/`/ship`, `v*` tag). The **spec-kit extension** has its own flow — see `/publish-speckit-ext` and `apps/speckit-extension/docs/publishing.md` (prefixed `speckit-ext-v*` tag, `.zip` archive, catalog issue).

1. Run `git diff $(git describe --tags --abbrev=0)..HEAD -- README.md` to see what was already updated since the last tag.
2. Cross-check `CHANGELOG.md` entries since the last release against the map above.
3. For every CHANGELOG bullet under "New Features," confirm a README section was touched. If not, add one.
4. Update the "What's new" block at the top of README: the version in its lead sentence, and its three lines to the new release's own highlights.
5. Verify `package.json` `contributes.configuration["speckit.aiProvider"].enum` matches the README provider matrix (count + names).
6. Verify `package.json` `engines.vscode` matches the README "VS Code" badge.
7. Re-render any screenshot whose UI changed in this release and refresh its caption if the value prop shifted. **Keep screenshot filenames stable — overwrite in place, never rename or delete** (see the gotcha in `CLAUDE.md`).
8. Run `npm run clips:check`. Broken must be zero — a broken count is a 404 on the published Marketplace listing, not a to-do item.

## README conventions

The root README keeps relative image paths on purpose. It's rendered by GitHub and packaged by vsce for the Marketplace, and both resolve relative paths (vsce rewrites them to absolute raw URLs at package time). `apps/speckit-extension/README.md` uses absolute `raw.githubusercontent` URLs instead, because the Spec Kit community catalog renders it from `main` and can't resolve relative paths.

The root README's H1 has two alternates on file, either of which can swap in for the current headline if it needs a refresh: "SpecKit Companion: the whole spec lifecycle, visible and under your control" and "SpecKit Companion: know what your AI is doing before, during, and after it writes code".

## Doc size ceiling

A doc under `docs/` stays under 3,000 words. That's where the repo's healthy docs top out (`architecture.md`, `configuration.md`, `viewer.md`). Past the ceiling, split it: pull a self-contained topic into its own doc and link it from the original, or, if part of the doc describes behavior that's finished and superseded, archive that part the way `CHANGELOG.md` archives old releases into `apps/website/src/data/changelog-archive.md`. Check with `wc -w docs/*.md`.

**Split along what the reader came for, not by length.** A doc over the ceiling is almost always four docs stapled together: a lesson someone follows once, a recipe for a specific job, a reference to look things up in, and an explanation of why it works that way. Those four want different shapes and different readers, which is why the long ones read as heavy no matter how well each paragraph is written. Cut at those seams. Better still, when the doc is really restating enforceable behavior: fold it into a living spec instead, where a validator and drift check keep it honest — a doc under `docs/` has neither.

## Changelog voice

Changelog entries are **release notes for users**, not commit messages. Lead with the observable change — what a user can now do, or what stopped going wrong. Keep the things users actually touch: setting keys (`speckit.defaultWorkflow`), command names (`/speckit.companion.resume`), config files they edit, and the install commands they run. **Drop internal file and symbol names** — `promptBuilder.ts`, `sync_tasks()`, `write-context.py --task …`, on-disk field names like `history[]`/`transitions[]`. Those belong in the commit message or PR description. The test: would the entry make sense to someone who has never opened `apps/vscode/src/`? If it only lands for someone who has, it's too deep — move the mechanism out and keep the effect. Applies to both changelogs (root and `apps/speckit-extension/`).
