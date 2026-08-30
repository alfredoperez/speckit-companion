# Visual Assets

How every documentation image and README GIF is produced, and when it must be regenerated. This is a rulebook: the files it points at carry the detail.

## Generated images are build artifacts

Everything under `docs/screenshots/generated/` is produced by `node scripts/capture-docs-images.mjs` from Storybook capture stories fed by the Teamboard fixtures (`webview/src/spec-viewer/__fixtures__/teamboard/`). Never hand-edit an output PNG or GIF: a touch-up is lost on the next run. Change the story, the fixture, or the script's `STORIES` list, then regenerate. Filenames are load-bearing (see the screenshot gotcha in `CLAUDE.md`): overwrite in place, never rename or delete.

## When to regenerate

Any change to webview UI, styling, design tokens, the capture stories, or the Teamboard fixtures makes the generated images and the GIFs stale. Before shipping docs on such a change: re-run `node scripts/capture-docs-images.mjs`, and re-render any affected `media/feature-clips/` composition.

What exists, so you know what a change can invalidate:

- **Story groups** (all under the `Video Capture` heading in Storybook):
  - `Video Capture/Episode 1 · Teamboard` (`VideoCapture.stories.tsx`): the viewer walked through the fixture's lifecycle, A1 through A7 (specified, plan running, planned, tasks, implementing, completed overview, completed spec).
  - `Video Capture/Specs Sidebar (Recreation)` (`SidebarCapture.stories.tsx`): the sidebar recreation, B1 through B5 (collapsed, expanded, Living Specs and Steering, full sidebar, README triptych).
  - `Video Capture/README Composites` (`ReadmeCapture.stories.tsx`): multi-panel README art, C1 through C6 (hero, pipeline stat strip, Living Specs pair, benefits strip, and the two cross-promo banners over the mascot art in speckit-extension/assets/).
- **Generated images**: the `STORIES` list in `scripts/capture-docs-images.mjs` is the authority for which story feeds which file. Currently: `spec-viewer.png` (A1b requirements), `inline-comments.png`, `overview.png` plus `overview-annotated.png` (A6 with a measured callout), `specs-sidebar.png` (B4), `sidebar-triptych.png` (B5), `hero.png` (C1), `pipeline-stats.png` (C2, numbers quoted from `docs/configuration.md`), `living-specs-pair.png` (C3), `benefits-strip.png` (C4), `banner-install-engine.png` (C5, root README) and `banner-install-vscode.png` (C6, extension README): the "Install the other half" cross-promo pair.
- **GIFs**: `overview.gif` renders from `media/feature-clips/overview-readme/` and `overview-engine.gif` from `media/feature-clips/overview-engine/`; `run-in-flight.gif`, `make-it-yours.gif`, `spec-viewer.gif`, `inline-comments.gif`, and `specs-sidebar.gif` render from the like-named compositions. Pipeline: hyperframes render to MP4 in `renders/`, then ffmpeg palettegen/paletteuse (dither=none, diff_mode=rectangle) plus `gifsicle -O3 --lossy=30`, 960 wide at 14 fps. Each composition's STORYBOARD records the exact encode and the loop verification — `run-in-flight` is the one deliberate exception, stepped down to 880 px / 12 fps at lossy 45 because at 36 s the standard settings overshoot the 4 MB target.

## Visual tests for the Pipeline Builder

`scripts/visual-builder.mjs` drives the panel in the same browser the capture script uses, across two widths (1600 and 380) and both themes — 332 renders from the 83 `Pipeline Builder/*` stories.

```bash
npm run test:visual        # layout + pixel baselines, compared locally
npm run test:visual:ci     # layout only — what CI runs
npm run test:visual -- --update   # re-bless the baselines after an intended change
```

Two things it checks, and the split matters. **Layout** is geometry a browser can answer and jsdom cannot: nothing overflows the panel shell, no control is drawn at zero size, nothing is clipped beyond reach, no console errors. That holds on any machine, so CI runs it on every push. **Pixels** are compared against baselines in `webview/src/pipeline-builder/__screenshots__/` (the situation stories, both widths, dark theme — 54 files). Those stay local: font rasterisation differs between macOS and a Linux runner, and a pixel gate in CI would fail on every push for reasons nobody could act on. A failing comparison writes the diff image next to the baselines under `diff/`.

Stories need no changes to take part. Determinism — no animation, no transition, no caret, no scrollbars — is injected by the runner rather than declared per story, and both themes are reached through Storybook's `globals` URL parameter. Adding a story to `Pipeline Builder/*` puts it under layout checks automatically.

The browser and Storybook plumbing is shared with the capture script: `scripts/lib/storybook-browser.mjs`. Change it and re-run **both**, because the determinism guarantee below is what proves the capture script still behaves.

## Social art is not packaged

`assets/social/carousel-copilot/` holds the Copilot-audience carousel: `deck.html` composes real captures from `docs/screenshots/generated/` and `node assets/social/carousel-copilot/render.mjs` writes the slide PNGs. It follows the same rules as everything else generated — never hand-edit a slide, change the deck and re-run — and `.vscodeignore` keeps it out of the `.vsix` alongside `assets/mascot/**`. Its `PROMPT.md` records the art direction it inherits from `speckit-extension/assets/HERO-PROMPT.md`.

## Fixtures are published copy

The Teamboard fixture prose (`webview/src/spec-viewer/__fixtures__/teamboard/`) appears verbatim in public images and videos. Keep it legible and deliberately dull; it must never be anyone's real spec. Preserve its engineered properties: FR-004 stays vacuous by design (it is the clarify-demo plant). No em dashes in fixture text or any on-screen copy. The product name in on-image copy is "Spec Kit Companion", two words.

## Determinism

Two runs of the capture script must produce byte-identical files; a pixel diff between runs is a bug, not noise.

- The `CaptureFrame` decorator (`webview/src/spec-viewer/__stories__/captureFrame.tsx`) freezes the clock at `CAPTURE_NOW_ISO` and kills animations, transitions, and scrollbars.
- Each capture story declares `parameters.capture = { width, height }`; the preview decorator (`.storybook/preview.tsx`) turns that into an exact-pixel box, and the script screenshots that box at device pixel ratio 2.
- `playwright-core` is a pinned exact devDependency in `package.json` (currently `1.62.1`) and drives the installed Google Chrome (`channel: 'chrome'`). Keep the pin exact; do not float it or swap in full `playwright`.
- Two runs of the capture script producing identical files is also what proves a change to `scripts/lib/storybook-browser.mjs` was harmless: refactor it, re-run the capture, and `git status` on `docs/screenshots/generated/` must come back empty.

## The sidebar is a recreation

The Specs view is a native VS Code TreeView, so it cannot be storybooked. `sidebarTree.tsx` draws a presentational recreation from fixture rows, measured off the DevTools snapshots in `docs/reference/sidebar-snapshots/`. It does not follow the real tree on its own: when the icon or state logic in `src/features/specs/specExplorerProvider.ts` changes, update the recreation by hand in the same change.

## Videos

`media/feature-clips/` holds the HyperFrames compositions: `overview-readme` and `overview-engine` (the two README GIF loops) plus the six feature clips (`coverage`, `inline-comments`, `overview`, `spec-viewer`, `specs-sidebar`, `step-rail`). The compositions are the source of truth; `renders/`, snapshots, and story captures are gitignored (`media/.gitignore`) and rebuilt from them. Keep frame zero representative (it is the resting pose a reader sees first) and keep loops seamless: the end of a loop holds identical to frame zero.
