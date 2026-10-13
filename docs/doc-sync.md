# Doc Sync

**Docs are part of the change, not a follow-up.** `CLAUDE.md` "One fact, one owner" says where each fact lives; a behaviour change updates that one place in the same change. The table below adds the areas with a non-obvious follow-on.

## Which doc for which area

Behaviour lives in the code and its tests, so a behaviour change updates its tests in the same change. The table names the docs that move with it.

| Area you changed | Also update |
|---|---|
| Spec viewer statuses, badges, buttons, step tab behavior | the site's [spec viewer anatomy](https://speckit-companion.dev/docs/navigate/inside-the-viewer) |
| Companion pipeline shape — the workflow choice (stock `speckit` vs `companion`) on `speckit.defaultWorkflow`, the Companion command bodies, the shared timing partial, the classify/routing step, the one-time removal of a leftover Companion preset | `apps/speckit-extension/docs/node-model.md` and the site's [Spec-driven development](https://speckit-companion.dev/docs/start/spec-driven-development/) page, which holds the two workflows. Note: the former `templateProfile` / `turboWorkflowPicker` / `complexityFastPath` toggles and the `companion-turbo` preset are **retired** — don't reintroduce them; `speckit.companion.templateProfile` survives only in `apps/vscode/src/core/settingsMigration.ts` to migrate old persisted values. |
| Project structure, modules, architecture | `docs/architecture.md` |
| `.spec-context.json` capture — lifecycle hooks, `write-context.py`, the timing part (`apps/speckit-extension/presets/_parts/timing.md` / `promptBuilder.ts`), `derive-from-files.py`, the eval (`check_capture.py`) | The writer rules under "Data flow" in `docs/architecture.md`. The contract itself is `apps/vscode/src/core/types/specContext.ts`, `spec-context.schema.json` and the capture scripts' tests; what the capture eval asserts is in `check_capture.py` itself. |
| Sidebar (filter, sort, lifecycle buttons, badge tiers, tree icons, transition logging) | the site's [sidebar reference](https://speckit-companion.dev/docs/navigate/the-sidebar/) |
| The Get Started walkthrough (`contributes.walkthroughs`, `assets/walkthrough/`) | `docs/getting-started.md` (the step table) + `docs/visual-assets.md` (how the walkthrough media is packaged). Keep the step copy consistent with `contributes.viewsWelcome`: the two surfaces cover the same ground and must not contradict each other. |
| The spec-kit workflow definition (`apps/speckit-extension/workflows/speckit-companion.workflow.yml`), its `classify`/`mark-complete` commands, or the routing step | `apps/speckit-extension/README.md` + an `[Unreleased]` entry in `apps/speckit-extension/CHANGELOG.md` — never the root README/CHANGELOG/`package.json`, never `extension.yml` `version`. Capture is unchanged on this path: the engine dispatches the same `speckit.companion.*` commands, so the same hooks/bodies write `.spec-context.json`. |
| Webview UI, styling, design tokens, capture stories, or the Teamboard fixtures | Regenerate `docs/screenshots/generated/` with `npm run clips:capture` and re-shoot + re-render any affected `content/media/feature-clips/` composition before shipping docs. A re-render doesn't stop at the MP4: follow the chain down through `clips:render`, `clips:stills`, `clips:gifs` and `clips:sync` or the README and the site keep showing the old frames. Rules in `docs/visual-assets.md`; the command-by-command chain is the `feature-clip` skill. |
| The capture palette (`.storybook/capture-theme.ts`), the capture scripts, a `content/media/feature-clips/` composition, or a clip's `STORYBOARD.md` | `docs/visual-assets.md` (how every image, GIF, web clip and mascot derivative is made and checked). Scaffold a new composition with `npm run clips:new`, which writes the `CLIP_CAPTURES` stub and the `content/media/manifest.json` entry that a hand copy would skip. Run `npm run clips:check` (storyboard drift plus the manifest) before finishing. |
| A feature's asset outputs, the paths a README or the site reads, or `content/media/manifest.json` itself | `docs/media-manifest.md` (the bundle contract: which surface reads which output, alt text, published-filename rules) |
| Anything that regenerates `content/media/web/` — a retheme, a re-render, `clips:render`, `clips:stills`, `lightwell` | Commit the regenerated files. `content/media/web/` is **tracked**, deliberately: a deploy can't rebuild it, and while it was ignored the live site rendered every clip and screenshot as a broken image. `npm run clips:sync` copies them into the site, and the site's own build runs it too. |
| The GitHub Copilot app canvas under `apps/copilot-canvas/` | `apps/copilot-canvas/README.md` and, if the structure moved, the canvas paragraph in `docs/architecture.md`. It ships in neither extension and takes no version bump, but a change to what a Copilot app user sees gets a line under `[Unreleased]` in the root `CHANGELOG.md`. Its tests run with `npm run test:canvas`. |
| The Claude Code mod under `apps/claude-mod/`, or `.claude-plugin/marketplace.json` | `apps/claude-mod/README.md` (including the Claude Code version it was tested on), the site's [In Claude Code pages](https://speckit-companion.dev/docs/claude-code/install/) (Install, What it shows, Switch specs with /spec), and, if the structure moved, the mod paragraph in `docs/architecture.md`. It ships in neither extension and takes no version bump on a branch, but a change a Claude Code user sees gets a line under `[Unreleased]` in the root `CHANGELOG.md`. A change to `apps/copilot-canvas/spec-rules.mjs` needs `npm run mod:build` and the regenerated bundle committed. Its tests run with `npm run test:mod`. |
| The marketing/docs site under `apps/website/` | `apps/website/README.md` and, if the structure moved, the website paragraph in `docs/architecture.md`. It belongs to neither product's feature list, so **not** the root README, **not** `apps/speckit-extension/README.md`, and **not** either CHANGELOG. |
| A new surface ships: an app, a panel, a provider, or a top-level feature path | Add its path glob and checks to `.claude/skills/release-qa/surface-map.yml`. `/release-qa` scopes each release from that map, lists any changed path it does not cover as "no QA mapping", and `/publish*` refuse to tag without its report. |
| Webview component with a sibling `.stories.tsx` | Update the stories in the same change to cover the new state/variant. Storybook is the visual baseline — stale stories are worse than missing stories because they lie. If a non-trivial component changes materially and no `.stories.tsx` exists, add one in the same PR. |

## Per-release checklist (run before tagging a version)

> This checklist is for the **VS Code extension** (`/publish`, `v*` tag), the last step of `/release-loop`. The **spec-kit extension** has its own flow — see `/publish-speckit-ext` and `apps/speckit-extension/docs/publishing.md` (prefixed `speckit-ext-v*` tag, `.zip` archive, catalog issue). The Claude Code mod and the Copilot canvas have theirs in `/publish-mod` and `/publish-canvas`, and `/publish-all` runs all four.

1. Run `git diff $(git describe --tags --abbrev=0)..HEAD -- README.md` to see what was already updated since the last tag.
2. Confirm the README install and first-run steps still match what ships.
4. Update the "What's new" block at the top of README: the version in its lead sentence, and its three lines to the new release's own highlights.
5. Verify `package.json` `contributes.configuration["speckit.aiProvider"].enum` matches the README provider matrix (count + names).
6. Verify `package.json` `engines.vscode` matches the README "VS Code" badge.
7. Re-render any screenshot whose UI changed in this release and refresh its caption if the value prop shifted. **Keep screenshot filenames stable — overwrite in place, never rename or delete** (see the gotcha in `CLAUDE.md`).
8. Give each highlight its screenshots on the site's changelog. Name them in the highlight's comment (`media: builder-move-hook, builder-side-panel`) and add one entry per shot under the release's `vscode@<version>` key in `content/media/changelog.json`: `file` (a generated still under `docs/screenshots/generated/`, or a real-app screenshot copied to `apps/website/public/changelog/`), `alt`, a one-line `caption`, and a `highlight` box `{x, y, w, h}` in the image's own pixels around the changed area when there is a clear one. Several shots make a carousel. Do the same under `speckit@<version>` for a spec-kit extension release that has something to show. The site build fails on a media id with no entry, a missing alt or file, a shot no highlight names, and a key that matches no release, so add it in the release commit, after the version heading exists, and run `cd apps/website && npm run build`.
9. Run `npm run clips:check`. Broken must be zero — a broken count is a 404 on the published Marketplace listing, not a to-do item.

## Changelog voice

An entry is a headline for someone skimming, not the story of the change. The detail lives in the docs page and the PR. The same voice holds in all three changelogs (root, `apps/speckit-extension/`, `apps/claude-mod/`).

- **A bullet** is a bold title of at most 8 words, then ONE sentence of at most 22 words. Nothing else.
- **A highlight** is a `####` title, at most two sentences of that length, and its pictures.
- **Start with what you do or see**, second person, present tense. Light and a little playful is welcome; never a pun that hides the fact.
- **At most one `==highlighted phrase==` per entry**, in the body: the two to four words a skimmer must not miss. The site draws it as a marker stroke.
- **Keep what you type or press** in code or bold: setting keys, command names, button names. No file or symbol names, no "now", no "previously", no history of the bug.

Before: "**A paragraph wrapped across several lines reads as one paragraph.** A spec file that breaks a paragraph over several source lines used to show every line as its own paragraph, each with its own comment button, so sentences broke in the middle. The viewer now joins them…" After: "**Wrapped paragraphs stay whole.** A paragraph split across lines in the file is ==one paragraph, one comment button==."

`/changelog-entry` writes an entry in this voice, and `npm test -- docs-consistency` holds every entry under `## [Unreleased]` to it; released versions are never checked. A release has this shape:

```markdown
## [0.35.0] - 2026-10-03

One plain sentence that says what the release is about.

### Highlights

#### Drag a hook to move it
Grab a hook in the Pipeline Builder and ==drop it where it runs==. The file keeps every other line as you wrote it.
<!-- area: pipeline-builder; pr: 818; media: move-hook -->

### Fixed
- **Move to phase… works in a narrow builder.** The menu opens ==inside the window== however narrow the Pipeline Builder gets. ([#805](https://github.com/alfredoperez/speckit-companion/pull/805)) <!-- area: pipeline-builder -->
```

- **Highlights are the big features**, each its own `####` block, and each gets a section on the site with its screenshots (per-release checklist step 8). The comment is for the site only: `area`, one or more `pr` numbers, and the `media` ids. A feature that is not worth a picture is not a highlight.
- **Everything else is one bullet** under Added, Fixed, Changed or Security: the bold title, the sentence, the full PR link, then `<!-- area: … -->`. Never a section of its own.
- **Every entry links its PR**, highlight or bullet. When a fix spans PRs, list each. The Claude Code mod's changelog is the exception: it writes neither PR links nor area tags, so leave `==` out there. The site's changelog page shows it under its own Claude Code mod filter, beside the Copilot app (`apps/copilot-canvas/CHANGELOG.md`).
- **Areas**: `spec-viewer`, `overview`, `sidebar`, `create-spec`, `pipeline-builder`, `pipeline` (the Companion pipeline's commands), `copilot-app`, `living-specs`, `run-record`, `assistants` (assistants and terminals), `install` (install and updates), `docs`. The list lives in `apps/website/src/components/changelog/changelogAreas.ts`; an entry without a tag is filed by a keyword map there, and the site build names it so it can be tagged.
