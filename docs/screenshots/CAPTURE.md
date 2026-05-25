# Screenshot capture guide

How to capture and standardize every screenshot in the README so the set stays
uniform and professional. The goal is **clean raw frames**: same theme, same
zoom, same widths, cropped tight, no decoration.

Follow this whenever a screenshot is retaken so the README never drifts into a
mismatched collage again.

## Environment (set once, identically for every shot)

| Setting | Value | Why |
|---------|-------|-----|
| Color theme | **Dark Modern** (VS Code default) | Matches the extension's tested CSS variables; familiar to most users |
| Display | Retina / HiDPI (`@2x`) | Crisp text when scaled down in the README |
| Editor zoom | `Cmd+=` **twice** from default (reset first with `Cmd+0`) | Legible UI text at README render width — keep it identical across shots |
| Minimap | Off (`editor.minimap.enabled: false`) | Removes clutter |
| Breadcrumbs | Off (`breadcrumbs.enabled: false`) | Removes clutter |
| Status bar | Off for panel-only crops (`workbench.statusBar.visible: false`) | Removes clutter |
| Open editor tabs | Close all but the one in shot | No stray tabs in frame |
| Activity bar | Keep visible only when it's part of the shot (sidebar overview) | Context where relevant |
| Primary sidebar width | Fixed — drag to a consistent width and don't change between shots | Uniform sidebar proportions |

Capture in the **Extension Development Host** (`F5`), not a packaged install, so
you're shooting the current working tree.

## Dimensions (display width)

Crop tight to the relevant panel — no desktop wallpaper, no empty editor gutter.

| Tier | Display width | Shots |
|------|---------------|-------|
| Full viewer | **~1600px** | `viewer`, `comments`, `activity` |
| Narrow | **~900px** | `create-spec` |
| Hero | **2000 × 989** | `hero.jpg` (AI-generated — see `hero/PROMPT.md`) |

Captured at `@2x` these are ~3200px / ~1800px source pixels; that's expected.

## Format & optimization

- **PNG** (lossless) for all UI shots; **JPG** only for `hero.jpg`.
- Optimize before committing so files stay small:
  ```bash
  oxipng -o max docs/screenshots/*.png      # or: pngquant --quality=80-95 ...
  ```
- Canonical filenames: `viewer.png`, `comments.png`, `activity.png`,
  `create-spec.png`, `hero.jpg`, `demo.gif` / `demo.mp4`. Delete the old set
  (`workflow-*`, `specify-*`, `sidebar-overview`, `inline-comment-*`,
  `other-views`, `specs-tree`) once the new files land.

## Content source (use the committed demo fixtures)

Drive every viewer shot from the pinned demo fixtures so the rendered content is
realistic and identical on every retake:

| Fixture | State | Use for |
|---------|-------|---------|
| `specs/_01_demo-planned` | `planned` (spec.md + plan.md) — branch `demo/planned` | `viewer` (Plan phase + children-rail chips + diagram), `comments` |
| `specs/_02_demo-tasked` | `ready-to-implement` (+ tasks.md) — branch `demo/tasked` | `activity` |

> **Do NOT `git add` changes to these three dirs.** Capturing mutates their
> `.spec-context.json` / files. After you're done, restore the baseline:
> ```bash
> git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked
> ```

## Per-shot recipe

Each must show the **current** UI (title-leading header, color badge, branch
chip, step tabs, children rail, TOC, footer state machine).

| File | Open | Frame must include |
|------|------|--------------------|
| `viewer.png` | `_01_demo-planned` viewer, Plan tab — **sidebar visible** | Specs sidebar + viewer together; title-leading header + `Planned` badge + `demo/planned` chip + date pill; Spec/Plan/Tasks tabs; children-rail chips (data-model / research / quickstart); the architecture/mermaid diagram; next-step **Tasks** footer |
| `comments.png` | `_01_demo-planned` viewer, hover a line, click `+` | GitHub-style comment card mid-use: context header, textarea with text, footer (secondary action left / Cancel + Add Comment right) |
| `activity.png` | `_02_demo-tasked`, toggle **Activity** | Phases timeline + Approach / Tasks / Review-comments cards |
| `create-spec.png` | `+` New Spec | Title, **Load Template**, **Workflow** picker, description + char counter, **Attach Image**, footer Cancel / **Auto Mode** / Submit |

These four also feed the AI assets: `viewer` + `comments` + `activity` are the
three hero inputs (`hero/PROMPT.md`), and the resulting `hero.jpg` seeds the demo
video (`VIDEO-PROMPT.md`).

## Hero & video

`hero.jpg` and `demo.gif`/`demo.mp4` are **AI-generated**, not captured. Build the
hero from the three shots above via `hero/PROMPT.md`, then seed the video from
`hero.jpg` via `VIDEO-PROMPT.md`.

## Checklist before committing

- [ ] All shots use Dark Modern at the same zoom.
- [ ] Widths match the tier table; cropped tight.
- [ ] Canonical filenames; old set deleted.
- [ ] PNGs optimized; hero shows no purple; video loops cleanly.
- [ ] `git status` shows **no** staged changes under the demo fixtures.
