# Visual Assets

How every documentation image, README GIF, web clip and mascot derivative is produced, and when it must be regenerated. This is a rulebook: the files it points at carry the detail.

`docs/media-manifest.md` is the companion document. This one owns how an asset gets *made*; that one owns what a finished feature *owes* and which surface reads which file.

**For feature clips specifically, use the `feature-clip` skill.** It owns the whole chain — capture, compose, storyboard, render, encode, sync, check — the commands for each stage, and the traps that have already cost a debugging session apiece. Start a new clip with `npm run clips:new`, never by copying a neighbouring composition: the template in `media/feature-clips/_template/` is where the current caption, scrim and pacing rules live, and a hand copy silently inherits whichever clip happened to be nearest.

## Generated images are build artifacts

Everything under `docs/screenshots/generated/` is produced by `node scripts/capture-docs-images.mjs` from Storybook capture stories fed by the Teamboard fixtures (`webview/src/spec-viewer/__fixtures__/teamboard/`). Never hand-edit an output PNG or GIF: a touch-up is lost on the next run. Change the story, the fixture, or the script's `STORIES` list, then regenerate. Filenames are load-bearing (see the screenshot gotcha in `CLAUDE.md`): overwrite in place, never rename or delete.

## When to regenerate

Any change to webview UI, styling, design tokens, the capture palette, the capture stories, or the Teamboard fixtures makes the generated images and the clips stale. Before shipping docs on such a change: re-run `node scripts/capture-docs-images.mjs`, re-run `node scripts/capture-docs-images.mjs --clips`, and re-render any affected `media/feature-clips/` composition.

What exists, so you know what a change can invalidate:

- **Story groups** (all under the `Video Capture` heading in Storybook):
  - `Video Capture/Episode 1 · Teamboard` (`VideoCapture.stories.tsx`): the viewer walked through the fixture's lifecycle, A1 through A7 (specified, plan running, planned, tasks, implementing, completed overview, completed spec).
  - `Video Capture/Specs Sidebar (Recreation)` (`SidebarCapture.stories.tsx`): the sidebar recreation, B1 through B5 (collapsed, expanded, Living Specs and Steering, full sidebar, README triptych).
  - `Video Capture/README Composites` (`ReadmeCapture.stories.tsx`): multi-panel README art, C1 through C6 (hero, pipeline stat strip, Living Specs pair, benefits strip, and the two cross-promo banners over the mascot art in speckit-extension/assets/).
  - `Video Capture/Clip States` (`ClipCapture.stories.tsx`): the state pairs the newer clips film, D through H (the review loop and the side bar it closes on, the Living Specs work tree and the capability it opens onto, the phase-document switch, the workflow choice, and the two inline-comment states).
- **Generated images**: the `STORIES` list in `scripts/capture-docs-images.mjs` is the authority for which story feeds which file. Currently twelve: `spec-viewer.png` (A1b requirements), `inline-comments.png`, `overview.png` plus `overview-annotated.png` (A6 with a measured callout), `specs-sidebar.png` (B4), `sidebar-triptych.png` (B5), `hero.png` (C1), `pipeline-stats.png` (C2, numbers quoted from `docs/configuration.md`), `living-specs-pair.png` (C3), `benefits-strip.png` (C4), `banner-install-engine.png` (C5, root README) and `banner-install-vscode.png` (C6, extension README): the "Install the other half" cross-promo pair.
- **GIFs**: `overview.gif` renders from `media/feature-clips/overview/` and `overview-engine.gif` from `media/feature-clips/overview-engine/`; `run-in-flight.gif`, `make-it-yours.gif`, `spec-viewer.gif`, `inline-comments.gif`, and `specs-sidebar.gif` render from the like-named compositions. Pipeline: hyperframes render to MP4 in `renders/`, then ffmpeg palettegen/paletteuse (dither=none, diff_mode=rectangle) plus `gifsicle -O3 --lossy=30`, 960 wide at 14 fps. Each composition's STORYBOARD records the exact encode and the loop verification. `run-in-flight` and `overview` are the two deliberate exceptions, stepped down to 880 px / 12 fps at lossy 45: at 36 s and 23.5 s of near-continuous camera travel the standard settings overshoot the 4 MB target.

## Two capture modes, one script

`scripts/capture-docs-images.mjs` runs the `STORIES` list by default and the `CLIP_CAPTURES` list under `--clips`.

```
node scripts/capture-docs-images.mjs                        documentation images
node scripts/capture-docs-images.mjs --clips                every clip state
node scripts/capture-docs-images.mjs --clips living-specs   one composition's states
```

The bare composition name after `--clips` is a filter. Re-shooting one clip is the common case, and without it every other composition's captures get rewritten too: byte-identical if nothing changed, but a wide blast radius for a narrow edit.

The default mode writes into `docs/screenshots/generated/`, whose filenames are published. `--clips` writes into the composition that reads each PNG (`media/feature-clips/<clip>/assets/captures/`), which `media/.gitignore` excludes. Nothing published points at a clip capture.

**`CLIP_CAPTURES` is now complete, and that is the point of it.** Thirty-one entries cover thirteen of the fourteen compositions; `make-it-yours` is the exception because it is typographic and reads no capture at all. Every PNG any composition reads is named there, so a clip can be rebuilt from a named story instead of from whatever happened to be on someone's disk. Before this list was filled in, the ten original compositions read ad hoc captures nothing in the repo could reproduce, while the script's own header claimed otherwise. Adding a composition means adding its captures here in the same change, or the composition is unbuildable on any other machine.

A clip capture's pixel size is a contract. Every rect in a composition's `BEATS` array is a real element box measured in that capture's own CSS pixels, so a capture that comes back a different size silently aims every camera move at the wrong element with nothing to fail on. Every story feeding one composition declares the same `parameters.capture` size, and changing it means re-measuring that composition's rects.

## The capture palette is a variable

Every story renders in the palette `.storybook/capture-theme.ts` marks active, so that file is where a screenshot's colours are decided. It used to be a hand-maintained wall of `--vscode-*` literals inside `.storybook/preview.tsx`, one hex per key with nothing tying any of them together; it is now its own module written in named roles, and `preview.tsx` only reads from it.

A palette is a short set of named roles: the grounds (editor, side bar, raised, control, input), the hairlines, a four step text ramp, the accent and the primary action, the hover wash, and the four semantics (pass, warn, error, running). `deriveVscodeVars` computes the fifty odd `--vscode-*` variables from those roles, so a retheme is a handful of role edits instead of fifty coordinated hex edits. A colour that answers to no role, like the stock current-line wash or the class-symbol hue, stays in that palette's `overrides` map with a line saying why.

Three palettes ship. `constellationViolet` is the active one, anchored to the marketing site's tokens in `website/src/styles/tokens.css`. `beardedMonokaiBlack` is the palette every capture used before it, extracted from the locally installed Bearded Theme and preserved byte for byte. `beardedVividLight` is the light option in the Storybook toolbar.

**The rule the violet palette follows: chrome follows the site, semantics keep their meaning.** The grounds, hairlines, text ramp and accent are pulled onto the site's ramp so a capture placed on a site page separates from it instead of clashing. The four semantics are retuned for a violet ground, not rebranded: pass stays green, warn stays yellow, error stays red, running stays cyan. A reader has to be able to tell a passing check from a failing one without reading the label, and that survives a retheme or the retheme was wrong.

To retheme: copy a palette, change its roles, and point `activeCapturePalette` at it. That one line is the switch, and the Storybook toolbar's "Capture palette" entry always shows whichever palette it names.

**A retheme is not free, and the cost is worth stating before you start.** Changing the active palette makes every file under `docs/screenshots/generated/`, every clip capture, and therefore every GIF, every web render and every poster stale at the same moment. The full sequence is: `node scripts/capture-docs-images.mjs`, then `node scripts/capture-docs-images.mjs --clips`, then re-render every composition under `media/feature-clips/`, then `node scripts/render-web-clips.mjs`, then `node website/scripts/sync-media.mjs`. Repainting the PNGs without re-rendering the clips leaves the README showing two palettes at once, and re-rendering the clips without re-running the web branch leaves the site playing the old ones.

Know what the palette reaches before you reach for it. The VS Code variables theme the capture shell, the Specs sidebar recreation, and anything that reads `--vscode-*`. They do not theme the spec viewer's body: the viewer owns a tested palette in `webview/styles/spec-viewer/_tokens-viewer.css` and follows the host only in high-contrast mode, which is deliberate (see `docs/DESIGN.md`). Recolouring the viewer means editing that owned palette, and that changes what ships to users, not just what the screenshots look like.

## Web renders

`node scripts/render-web-clips.mjs` is the web branch of the clip pipeline. It reads the MP4 each composition already rendered into `media/feature-clips/<id>/renders/` and writes, per composition, a VP9 WebM, an H.264 MP4 fallback for Safari, and a poster PNG lifted from frame zero. Output lands in `media/web/`, which `media/.gitignore` excludes because it is regenerable.

```
node scripts/render-web-clips.mjs                 every composition
node scripts/render-web-clips.mjs overview        one composition
node scripts/render-web-clips.mjs --list          which source MP4 each id resolves to
node scripts/render-web-clips.mjs --verify-only   re-check existing outputs, encode nothing
```

The GIF path is untouched by it: the script never reads, writes or deletes a `.gif`, and never writes into `renders/`. Filenames follow `media/manifest.json` under `conventions.webNaming`. Encode settings and the reasoning behind them live in `media/WEB-RENDERS.md`.

The poster matters as much as the video. It is the frame a reader sees before anything plays, so it has to match frame zero or the clip flashes when it starts; the script lifts it from the encoded WebM rather than from the source for exactly that reason.

`node website/scripts/sync-media.mjs` copies the web outputs the manifest names into `website/public/media/`. It discovers nothing by globbing: it reads the manifest, takes the surfaces whose id starts with `site-`, and copies only the output keys those surfaces declare.

## Mascot assets

`node scripts/build-mascot-assets.mjs` derives the web-ready mascot poses the site serves. The source of truth is `assets/mascot/poses/`, eight 2048x2048 PNGs with real alpha; the script reads them and refuses to run if its output directory resolves anywhere inside `assets/`.

For each pose it writes a WebP and a PNG fallback at 512, 256 and 128 px on the long edge, cropped first to the character's own alpha bounding box so no dead transparent margin is paid for at every size. The crop threshold is what drops the faint firefly specks scattered across the source canvas; at alpha 0 the box is the whole 2048 square on five of the eight poses, which is the bug the threshold exists to avoid.

Poses keep their aspect ratio, so their pixel dimensions differ. The script writes a `manifest.json` beside the derivatives recording the exact width and height of each one, and the site reads it to set `width` and `height` on the `<img>` and reserve the layout box before the bytes land.

It is idempotent: the encoders are deterministic and a file is written only when its bytes actually change, so a second run touches nothing.

`tending` is the main mascot and the pose the landing-page hero serves: the moss creature holding the glowing seedling it is growing. It was added after the original seven and it was generated, not cropped out of `speckit-extension/assets/hero.png`. That plate is a photoreal night render at a different scale and in a different medium, so a knockout of its creature would have sat beside the painted poses as an obviously different drawing. Instead the three closest poses were passed to `gpt-image-1` as reference images through the `create-image` skill, with a transparent background, and the 1024 px result was resampled to the 2048 square the other sources use. Nothing on the site is served above 512 px on the long edge, so the resample costs no visible detail; a future repaint of this pose should still be rendered at full size rather than upscaled again.

Adding a pose means dropping a `mascot-<pose>-<timestamp>.png` into `assets/mascot/poses/` and re-running the script. The pose segment has to be one lowercase word, because that is the key the script parses out of the filename and the name the site addresses the file by.

## The manifest indexes the outputs

`media/manifest.json` records, per feature, every output that feature owes: the canonical MP4, the web trio, the 16:9 crop, the published still, the README GIF, alt text, and which README references which path. `node scripts/check-media-manifest.mjs` validates it against the filesystem and against both READMEs, and separates real breakage from work that has not been produced yet.

The contract, the field meanings, and which surface reads which key are in `docs/media-manifest.md`. Read that before adding a composition.

## Social art is not packaged

`assets/social/carousel-copilot/` holds the Copilot-audience carousel: `deck.html` composes real captures from `docs/screenshots/generated/` and `node assets/social/carousel-copilot/render.mjs` writes the slide PNGs. It follows the same rules as everything else generated: never hand-edit a slide, change the deck and re-run. `.vscodeignore` keeps it out of the `.vsix` alongside `assets/mascot/**` and `website/**`. Its `PROMPT.md` records the art direction it inherits from `speckit-extension/assets/HERO-PROMPT.md`.

## Fixtures are published copy

The Teamboard fixture prose (`webview/src/spec-viewer/__fixtures__/teamboard/`) appears verbatim in public images and videos. Keep it legible and deliberately dull; it must never be anyone's real spec. Preserve its engineered properties: FR-004 stays vacuous by design (it is the clarify-demo plant). No em dashes in fixture text or any on-screen copy. The product name in on-image copy is "Spec Kit Companion", two words.

## Determinism

Two runs of the capture script must produce byte-identical files; a pixel diff between runs is a bug, not noise.

- The `CaptureFrame` decorator (`webview/src/spec-viewer/__stories__/captureFrame.tsx`) freezes the clock at `CAPTURE_NOW_ISO` and kills animations, transitions, and scrollbars.
- Each capture story declares `parameters.capture = { width, height }`; the preview decorator (`.storybook/preview.tsx`) turns that into an exact-pixel box, and the script screenshots that box at device pixel ratio 2.
- A palette in `.storybook/capture-theme.ts` is a plain object built at module load. Nothing there reads the clock, the environment, or the DOM, so two capture runs see identical values.
- `playwright-core` is a pinned exact devDependency in `package.json` (currently `1.62.1`) and drives the installed Google Chrome (`channel: 'chrome'`). Keep the pin exact; do not float it or swap in full `playwright`.

## The sidebar is a recreation

The Specs view is a native VS Code TreeView, so it cannot be storybooked. `sidebarTree.tsx` draws a presentational recreation from fixture rows, measured off the DevTools snapshots in `docs/reference/sidebar-snapshots/`. It does not follow the real tree on its own: when the icon or state logic in `src/features/specs/specExplorerProvider.ts` changes, update the recreation by hand in the same change.

The same limit is why one composition films something other than what it was commissioned for. `workflow-documents` was meant to show where a custom command surfaces, but the quick pick is native VS Code chrome with no DOM and the footer menu was outside the capture box, so the clip films the phase-document switch instead. Its STORYBOARD says so at the top. Read a composition's storyboard before wiring its output into a page.

## Videos

`media/feature-clips/` holds fourteen HyperFrames compositions: `overview-readme` and `overview-engine` (the two README GIF loops), the six original feature clips (`coverage`, `inline-comments`, `overview`, `spec-viewer`, `specs-sidebar`, `step-rail`), `make-it-yours` and `run-in-flight`, and four newer ones. The newer four are `review` (the review loop on one document, closing on the side bar), `living-specs` (a work tree of capability specs, central and colocated, and the one a click opens), `own-workflow` (a workflow you defined in `speckit.customWorkflows` showing up in Create New Spec and building the step rail), and `workflow-documents` (the viewer switching between phase documents).

The compositions are the source of truth; `renders/`, snapshots, and story captures are gitignored (`media/.gitignore`) and rebuilt from them. Keep frame zero representative (it is the resting pose a reader sees first, and the poster the site serves) and keep loops seamless: the end of a loop holds identical to frame zero.

### Every composition carries a storyboard

Every directory under `media/feature-clips/` has a `STORYBOARD.md`: what the clip is for, which captures it uses and what state each one shows, a Beats table of `t` / region / label, the cut and dissolve notes, and the render recipe. Write one whenever you add a composition.

The storyboard is the editing surface for beat labels. Re-word a label in the Beats table, not in the JavaScript. Timings and rects stay code-owned and are never written back from the document, because the rects are element boxes measured off the captured DOM and hand-editing them in prose would break the camera.

`node scripts/clip-storyboard.mjs --check` is what keeps the two from drifting. It parses the `BEATS` and `CUTS` arrays out of each `index.html` and the Beats table out of each `STORYBOARD.md`, then reports a missing storyboard, a beat count mismatch, a `t` that differs, or a label that differs, and exits non-zero if anything does. It also checks each `BEATS` label against the `.lbl` element it drives, since that element is what actually renders on screen. Three compositions (`make-it-yours`, `overview-engine`, `overview-readme`) write their timelines out as explicit calls at literal times instead of a `BEATS` array; the check reports them as skipped and their storyboards are read by people rather than by the script.

`node scripts/clip-storyboard.mjs --apply <composition>` writes the storyboard's labels back into `index.html`, touching the `BEATS` label field and its matching `.lbl` element and nothing else. Re-render afterwards to get the new text on screen. Adding or removing a beat's label is a code change and `--apply` refuses it, because which beat carries a label decides which `.lbl` element each beat drives.

## The website is not packaged

The marketing and documentation site lives at `website/`, an Astro project with the Starlight docs integration and static output, deployed by Vercel from its own `package.json` and lockfile. It is not part of either extension: `.vscodeignore` excludes `website/**` from the `.vsix`, and `.gitignore` excludes its build artifacts while keeping the lockfile tracked so Vercel can `npm ci`.

Two things connect it to this pipeline. The active capture palette is anchored to `website/src/styles/tokens.css`, so a token change on the site is what makes a retheme the right call rather than a whim. And `website/public/media/` and `website/public/mascot/` are outputs, written by `sync-media.mjs` and `build-mascot-assets.mjs` respectively; never hand-place a file in either.
