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
  - `Video Capture/README Composites` (`ReadmeCapture.stories.tsx`): multi-panel README art, C1 through C4 (hero, pipeline stat strip, Living Specs pair, benefits strip).
- **Generated images**: the `STORIES` list in `scripts/capture-docs-images.mjs` is the authority for which story feeds which file. Currently: `spec-viewer.png` (A1b requirements), `inline-comments.png`, `overview.png` plus `overview-annotated.png` (A6 with a measured callout), `specs-sidebar.png` (B4), `sidebar-triptych.png` (B5), `hero.png` (C1), `pipeline-stats.png` (C2, numbers quoted from `docs/configuration.md`), `living-specs-pair.png` (C3), `benefits-strip.png` (C4).
- **GIFs**: `overview.gif` renders from `media/feature-clips/overview-readme/` and `overview-engine.gif` from `media/feature-clips/overview-engine/`. Pipeline: hyperframes render to MP4 in `renders/`, then ffmpeg palettegen/paletteuse (dither=none, diff_mode=rectangle) plus `gifsicle -O3 --lossy=30`, 960 wide at 14 fps. Each composition's STORYBOARD records the exact encode and the loop verification.

## Fixtures are published copy

The Teamboard fixture prose (`webview/src/spec-viewer/__fixtures__/teamboard/`) appears verbatim in public images and videos. Keep it legible and deliberately dull; it must never be anyone's real spec. Preserve its engineered properties: FR-004 stays vacuous by design (it is the clarify-demo plant). No em dashes in fixture text or any on-screen copy. The product name in on-image copy is "Spec Kit Companion", two words.

## Determinism

Two runs of the capture script must produce byte-identical files; a pixel diff between runs is a bug, not noise.

- The `CaptureFrame` decorator (`webview/src/spec-viewer/__stories__/captureFrame.tsx`) freezes the clock at `CAPTURE_NOW_ISO` and kills animations, transitions, and scrollbars.
- Each capture story declares `parameters.capture = { width, height }`; the preview decorator (`.storybook/preview.tsx`) turns that into an exact-pixel box, and the script screenshots that box at device pixel ratio 2.
- `playwright-core` is a pinned exact devDependency in `package.json` (currently `1.62.1`) and drives the installed Google Chrome (`channel: 'chrome'`). Keep the pin exact; do not float it or swap in full `playwright`.

## The sidebar is a recreation

The Specs view is a native VS Code TreeView, so it cannot be storybooked. `sidebarTree.tsx` draws a presentational recreation from fixture rows, measured off the DevTools snapshots in `docs/reference/sidebar-snapshots/`. It does not follow the real tree on its own: when the icon or state logic in `src/features/specs/specExplorerProvider.ts` changes, update the recreation by hand in the same change.

## Videos

`media/feature-clips/` holds the HyperFrames compositions: `overview-readme` and `overview-engine` (the two README GIF loops) plus the six feature clips (`coverage`, `inline-comments`, `overview`, `spec-viewer`, `specs-sidebar`, `step-rail`). The compositions are the source of truth; `renders/`, snapshots, and story captures are gitignored (`media/.gitignore`) and rebuilt from them. Keep frame zero representative (it is the resting pose a reader sees first) and keep loops seamless: the end of a loop holds identical to frame zero.
