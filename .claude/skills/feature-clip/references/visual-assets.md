# Visual assets

How every generated documentation image, README GIF, web clip, site still and mascot derivative is produced, and what a change makes stale. The clip chain and its traps are in `../SKILL.md`. Which surface reads which file is in `media-manifest.md`. Pictures of the real product are the `shots` skill.

## Generated images are build artifacts

Everything under `docs/screenshots/generated/` is generated. PNGs come from `npm run clips:capture` (`tooling/scripts/capture-docs-images.mjs`), shot from Storybook capture stories fed by the Teamboard fixtures (`apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/`). GIFs come from `npm run clips:gifs` (`tooling/scripts/build-clip-gifs.mjs`), encoded from the clip renders.

- Never hand-edit an output: the next run overwrites it. Change the story, the fixture, the composition or the script's list, then regenerate.
- Filenames are published. Overwrite in place, never rename or delete.

## When to regenerate

A change to webview UI, styling, design tokens, the capture palette, a capture story or the Teamboard fixtures makes the images and the clips stale. Before shipping docs on such a change, run both capture modes, re-render every affected composition, and continue down the chain in `../SKILL.md`: stopping at the MP4 leaves the README GIF and the site on the old picture.

What a change can invalidate:

| Story file | Storybook title | What it feeds |
| --- | --- | --- |
| `spec-viewer/__stories__/VideoCapture.stories.tsx` | `Scenes/Teamboard Run` | The viewer walked through the fixture's lifecycle, specified to completed |
| `spec-viewer/__stories__/SidebarCapture.stories.tsx` | `VS Code Extension/Sidebar` | The sidebar recreation and the README triptych |
| `spec-viewer/__stories__/ReadmeCapture.stories.tsx` | `Scenes/README Composites` | Multi-panel README art, the two cross-promo banners, the `og:image` social card |
| `spec-viewer/__stories__/ClipCapture.stories.tsx` | `Scenes/Clip States` | The state pairs the clips film |
| `spec-viewer/__stories__/FigureCapture.stories.tsx` | `Content/Article Figures` | Article figures (below) |
| `pipeline-builder/__stories__/Guide.stories.tsx` | `VS Code Extension/Pipeline Builder/Guide` | Every image in the site's Workflow Builder guide, one story per gesture |

All paths are under `apps/vscode/webview/src/`.

- **The `STORIES` list in `capture-docs-images.mjs` is the authority** for which story writes which file. Two mappings are not guessable from the names: `pipeline-stats.png` quotes its numbers from the site's configuration reference, and `banner-install-engine.png` / `banner-install-vscode.png` are the cross-promo pair, the first for the root README and the second for the extension README.
- **The builder guide set** re-shoots alone with `node tooling/scripts/capture-docs-images.mjs --only builder-`. A story's `out` filename never changes when the story is renamed. Each capture box is sized to its content, so a component that grows needs its `parameters.capture.height` raised or the shot clips.
- **The `GIFS` array in `build-clip-gifs.mjs` is the authority** for which compositions publish a GIF and at what settings. `overview` and `run-in-flight` use lighter settings because nearly every frame is a camera move and the standard ones overshoot the 4 MB target. `overview.gif` renders from the `overview` composition, not `overview-readme`.

## Two capture modes, one script

```
npm run clips:capture                            documentation images (STORIES)
npm run clips:capture -- --clips                 every clip state (CLIP_CAPTURES)
npm run clips:capture -- --clips living-specs    one composition's states
node tooling/scripts/capture-docs-images.mjs --only <prefix>   documentation images whose filename starts with the prefix
```

- Pass the composition name when re-shooting one clip. Without it every composition's captures are rewritten.
- The default mode writes into `docs/screenshots/generated/`. `--clips` writes into `content/media/feature-clips/<clip>/assets/captures/`, which is gitignored, so nothing published points at a clip capture.
- **`CLIP_CAPTURES` names every PNG any composition reads**, which is what makes a clip rebuildable on another machine. Add a composition's captures in the same change (`npm run clips:new` writes the stub). The only compositions absent from it are the drawn ones with no screenshot under them: `make-it-yours`, `living-specs-explained` and `write-only-specs`.
- **A clip capture's pixel size is a contract.** Every story feeding one composition declares the same `parameters.capture` size, and changing it means re-measuring that composition's rects, because a different size aims every camera move at the wrong element with nothing to fail on.

## Article figures

An article figure is one product surface inside a fixed frame (title chip, wordmark, capture, caption). One story per figure in `FigureCapture.stories.tsx`; `node tooling/scripts/capture-docs-images.mjs --only figure-` writes `docs/screenshots/generated/figure-*.png`. Each entry carries `theme: 'violet'`, passed to the preview as the Storybook theme global, so figures are always violet and the active capture palette is untouched. Articles copy a figure into the vault under an `IMG-` name.

## The capture palette

`.storybook/capture-theme.ts` decides every story's colours. A palette is a short set of named roles (grounds, hairlines, a text ramp, accent, primary action, hover wash, and four semantics). `deriveVscodeVars` computes the `--vscode-*` variables from them. A colour that answers to no role stays in that palette's `overrides` map with a line saying why.

Four palettes ship: `constellationLight` (**active**: the brand on a light ground, which separates a capture from the site's near-black page), `constellationViolet` (its dark cut, anchored to `apps/website/src/styles/tokens.css`), `beardedMonokaiBlack` and `beardedVividLight`. To retheme: copy one, change its roles, point `activeCapturePalette` at it.

**Chrome follows the site, semantics keep their meaning.** Pass stays green, warn yellow, error red, running cyan, each re-picked for contrast on the new ground, because a reader must tell a passing check from a failing one without reading the label.

**What the palette reaches.** It themes the capture shell, the sidebar recreation and anything reading `--vscode-*`. It does not theme the spec viewer's body, which owns a tested palette in `apps/vscode/webview/styles/spec-viewer/_tokens-viewer.css` and follows the host only in high contrast. Editing that file changes what ships to users. It does not reach a drawn composition either (see Retheming in `../SKILL.md`), and new composite chrome must read the derived variables instead of hardcoding neutrals.

**A retheme makes everything stale at once.** The full sequence, in order:

```
npm run clips:capture              re-shoot the documentation images
npm run clips:capture -- --clips   re-shoot every clip capture
npm run render                     in each content/media/feature-clips/<id>/ directory
npm run clips:render               web trio plus the 16:9 card, into content/media/web
npm run clips:stills               hero and accordion crops, into content/media/web
npm run clips:gifs                 the published README GIFs
npm run clips:sync                 copy the web outputs into apps/website/public/media
npm run clips:check                storyboard drift plus the manifest
```

`npm run media:all` runs every stage except `npm run render`, in that order. Render each changed composition by hand first.

| Skipped stage | What it leaves |
| --- | --- |
| Clip re-renders | The README shows two palettes at once |
| `clips:gifs` | README GIFs on the old palette while the site is on the new one |
| `clips:stills` | The landing page's hero and accordion figures behind, because they are cut from the captures and renders |

`npm run lightwell` and `npm run favicons` are not on this chain. Their colours come from the site's brand, so re-run them when the site's tokens or the mascot mark change.

## Web renders

`npm run clips:render` (`tooling/scripts/render-web-clips.mjs`) reads the MP4 each composition rendered into `renders/` and writes, per composition, into `content/media/web/`: a VP9 WebM, an H.264 MP4 for Safari, a poster PNG and the 16:9 social card (`<id>-x16x9.png`). Filenames follow `conventions.webNaming` in the manifest. Settings and their reasoning are in `content/media/WEB-RENDERS.md`.

```
npm run clips:render                    every composition
npm run clips:render -- overview        one composition
npm run clips:render -- --list          which source MP4 each id resolves to
npm run clips:render -- --verify-only   re-check existing outputs, encode nothing
```

- The script never reads, writes or deletes a `.gif`, and never writes into `renders/`.
- The card is a centred vertical crop: the frame is 1.577:1, so a 16:9 cut loses height and never width.
- Two clips can share a byte-identical poster: `step-rail` and `run-in-flight` open on the same shot.
- **`content/media/web/` is tracked in git on purpose.** A deploy has neither the captures nor the renders to rebuild it, so ignoring it breaks every image on the site. If history growth bites, use Git LFS.

`npm run clips:sync` (`apps/website/scripts/sync-media.mjs`) copies the web outputs the manifest names into `apps/website/public/media/`; `--check` reports without writing. The site's `build` script runs it before `astro build`, so a deploy always syncs. Run it by hand to see a fresh render in a local dev server.

## Stills, lightwell, favicons

- `npm run clips:stills` (`tooling/scripts/build-stills.mjs`) cuts the landing page's `hero-*` and `panel-*` PNGs from the clip captures and renders, so they cannot drift from what the clips show and are stale the moment the palette changes. **Crop to the content, never a whole IDE window**: a full window in a 600px column is unreadable. The hero plays loops; for a hero entry with no loop, a `fromFile` or `parts` entry cuts a `heroStill` from real-window shots. `--only <ids>` recuts a subset.
- `npm run lightwell` (`tooling/scripts/build-lightwell.mjs`) paints the focal light a product frame sits in front of, into `content/media/web/lightwell-*.webp`. It is an image because the same gradient in CSS bands into visible rings.
- `npm run favicons` (`tooling/scripts/build-favicons.mjs`) builds `favicon.svg`, `favicon-32.png` and `favicon-180.png` in `apps/website/public/` from `assets/icons/moss-16.svg` and `assets/icons/moss.svg`. Edit the sources and re-run; never edit the outputs.

## Mascot assets

`node tooling/scripts/build-mascot-assets.mjs` derives the poses the site serves into `apps/website/public/mascot/`. The source of truth is `assets/mascot/poses/`: sixteen 2048x2048 PNGs with real alpha.

- For each pose it writes a WebP and a PNG at 512, 256 and 128px on the long edge, cropped to the character's alpha bounding box.
- Poses keep their aspect ratio. A `manifest.json` beside the derivatives records each one's width and height, and the site reads it to set `width` and `height` on the `<img>`.
- Adding a pose: drop `mascot-<pose>-<timestamp>.png` into `assets/mascot/poses/` and re-run. `<pose>` must be one lowercase word, because it is the key the script parses and the name the site addresses.

Nothing here passes through `content/media/manifest.json`. The manifest's `mascot-hero` entry is that illustrated `hero.png`, which the Spec Kit extension README embeds.

## Determinism

Two runs of the capture script must produce byte-identical files. A pixel diff between runs is a bug.

- The `CaptureFrame` decorator (`apps/vscode/webview/src/spec-viewer/__stories__/captureFrame.tsx`) freezes the clock at `CAPTURE_NOW_ISO` and kills animations, transitions and scrollbars.
- Each capture story declares `parameters.capture = { width, height }`. The preview decorator (`.storybook/preview.tsx`) turns that into an exact-pixel box, and the script screenshots it at device pixel ratio 2.
- Nothing in `capture-theme.ts` may read the clock, the environment or the DOM.
- `playwright-core` is pinned to an exact version in `package.json` and drives the installed Google Chrome (`channel: 'chrome'`). Keep the pin exact, and do not swap in full `playwright`.
- To prove a change to `tooling/scripts/lib/storybook-browser.mjs` was harmless, re-run the capture and expect no diff under `docs/screenshots/generated/`. Re-run `npm run test:visual` too, which shares that file.

## The sidebar is a recreation

The Specs view is a native VS Code TreeView and cannot be storybooked. `apps/vscode/webview/src/spec-viewer/__stories__/sidebarTree.tsx` draws a recreation from fixture rows, measured off the DevTools snapshots in `docs/reference/sidebar-snapshots/`. It does not follow the real tree: when the icon or state logic in `apps/vscode/src/features/specs/specExplorerProvider.ts` changes, update the recreation by hand in the same change. Native chrome has no DOM to capture, so read a composition's `STORYBOARD.md` for what it really films before wiring its output into a page.

## Storyboards

`content/media/feature-clips/` is the roster: every subdirectory not starting with `_` is one composition, and its `STORYBOARD.md` opens with what it films. `renders/`, snapshots and captures are gitignored and rebuilt from the compositions.

- A storyboard records what the clip is for, its captures and their states, a Beats table of `t` / region / label, the cut notes and the render recipe. Every composition has one.
- Re-word a label in the Beats table, then `node tooling/scripts/clip-storyboard.mjs --apply <id>` and re-render. Timings and rects are code-owned.
- `--apply` refuses to add or remove a label. Which beat carries a label decides which `.lbl` element it drives, so that is a code change.
- Keep frame zero representative, since it is the poster. A loop's end holds identical to frame zero.
