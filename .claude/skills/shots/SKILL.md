---
name: shots
description: Take, place or re-shoot screenshots and frame recordings of the real SpecKit Companion product (the VS Code extension, the Claude Code mod in a terminal, the Copilot app board), and run the real-window, terminal and Workflow Builder visual checks. Use when asked to "take a screenshot", "re-shoot the docs images", "add a picture to the changelog", "record the board", "record the terminal", "check it in a real window", or to run `npm run shots`, `npm run check:desktop`, `npm run check:terminal`, `npm run record` or `npm run test:visual`.
compatibility: Requires VS Code, Google Chrome, tmux and a logged-in claude CLI, depending on the command
metadata:
  author: alfredo
  source: repo
---

# Shots

Pictures and footage of the real product, and the scripted checks that take them. Storybook captures, clips, GIFs and site stills are the `feature-clip` skill.

## Rules

- **Never take a screenshot by hand.** Every product picture comes from a script step, so it can be retaken. When no crop shows the surface, add a step.
- **Reuse first.** Look in `.shots/` and at `npm run shots:place -- --list` before opening a window, and open one once for everything missing.
- **Quiet Light is the theme** for docs, changelog and review pictures. It is the scripts' default; `--theme dark` gives Dark Modern.
- **A placed copy is a published filename.** READMEs and the Marketplace resolve images against current `main`, so add new files and never rename or delete one.
- **Look at every crop before using it.** Open `_sheet.png` first, and retake a crop that is clipped, blank, still loading or covered.
- **Concept pictures are diagrams**, an SVG with a 2x PNG beside it. Never a video still, never a caption burned into the picture.
- **Real windows are for release QA or an explicit ask**, not for every ticket: `npm run shots`, `npm run check:desktop` and `npm run record` open a visible VS Code window.
- **Nothing optimises a placed PNG.** For a large one, run `oxipng -o max <file>` before it is committed.

## Which command makes which picture

| Command | What it makes | Where it lands | What the machine needs |
| --- | --- | --- | --- |
| `npm run shots` | Every named crop of the extension (table below), plus `_sheet.png` | `.shots/` | VS Code (`VSCODE_BIN` overrides the path). Opens a real window, device scale factor 2. |
| `npm run shots:board` | The Copilot app board's pictures | `.shots/` | Google Chrome. Headless. |
| `npm run check:terminal` | The Claude Code mod's screen at every step, with a band crop and a pane crop | `.terminal-check/<recipe>-<mode>/` | `tmux`, the logged-in `claude` CLI, Google Chrome, and the `speckit-sandboxes` checkout `.claude/sandboxes-env.sh` locates |
| `npm run shots:place` | A copy of each crop at every path `tooling/scripts/shots.json` lists for it | The paths in that file | Nothing. Opens no window. |
| `npm run shots:sheet -- <dir>` | One contact sheet of any folder of pictures | `<dir>/_sheet.png` | Nothing |

`npm run shots:place -- --check` says which copies are out of date, and `-- --list` says where each crop goes. To reuse a picture somewhere new, add a `{ "to": "<path>" }` line under its crop name in `tooling/scripts/shots.json` and place again.

| Used on | Copy the crop to |
| --- | --- |
| A docs page or the landing page | `docs/screenshots/live-<what>.png`. The name must be unique across `docs/screenshots/generated/`, `content/media/web/` and `apps/website/public/canvas/`, because `DocFigure` finds a file by name across all four. Alt text goes on the `DocFigure`. |
| The changelog | `apps/website/public/changelog/<media id>.png`, with its alt text in `content/media/changelog.json` |
| An article | The post's image folder in the blog repo, numbered in reading order (`01.png`), 1400 to 1800px wide |

**One step at a time.** `npm run shots -- --only <step,step>` and `npm run check:terminal -- --only <step,step>` run only the named steps. `--only` takes step names (the first argument of a `step(...)` call), not crop names, so search the script for the crop's name to find its step. A name that matches no step runs nothing and says nothing, so check the picture was written. `npm run shots:board` ignores `--only`.

## Crops of the extension

| Crop | What it shows |
| --- | --- |
| `provider-picker` | The first-start Choose AI Provider picker, shot in a window of its own |
| `sidebar-panes` | Specs, Bugs and Ideas, each pane sized to its rows |
| `sidebar-and-story` | Whole window: the three panes beside a bug's Story |
| `bug-story-verified`, `bug-story-failed`, `bug-story-failed-checks` | A bug's Story verified, failed, and the failed story's table of checks |
| `report-header`, `answer-open-question` | An Assessment tab's line of facts, and an open question with the answer box open |
| `new-bug` | The New Bug screen with a symptom typed |
| `idea-decision`, `idea-scorecard`, `idea-assessing` | A go decision, its scorecard, and an idea still being assessed |
| `tasks-other-actions`, `other-actions-menu`, `create-issues-confirm` | Other actions on the Tasks tab, the menu alone, the confirmation dialog |
| `converge-footer`, `converge-sent`, `converge-terminal` | A finished spec's footer, the viewer beside the terminal after Converge, the terminal alone |
| `joined-paragraph` | A wrapped paragraph hovered, with its one comment button |
| `tab-overview`, `tab-specification`, `tab-plan`, `tab-tasks` | Each tab of the tasked demo spec |
| `living-specs-pane` | The Living Specs pane alone, with coverage counts, a drift flag and the update button |
| `living-spec`, `living-spec-requirement`, `living-spec-colocated` | A capability's page, one requirement with its scenario, and a colocated spec |
| `living-spec-drifted` | The requirement marked Drifted |
| `living-specs-window`, `living-drift-window` | Whole window: the tree beside a capability's requirements, and beside the drifted one |
| `overview-living-specs`, `overview-living-specs-window` | The Overview's living specs region, alone and in the whole window |
| `overview-intent`, `overview-timing`, `overview-expectations`, `overview-verified`, `overview-decisions`, `overview-coverage`, `overview-run-log` | Each other region of a finished run's Overview |
| `sidebar-hover`, `sidebar-more-actions` | A spec row hovered, and its More Actions menu open |

## Adding a step or a crop

A step in `tooling/scripts/desktop-check.mjs` is a name, one sentence saying what it proves, and a function that drives the window and throws when the claim does not hold. Options: `{ needs: 'fixtures' }` when it reads the throwaway project's own specs, bugs or ideas; `{ shots: true }` for a capture-only step, run under `--shots` alone; `{ record: true }` for a recording; `{ check: true }` for a release QA step, left out of `--shots` and `--record` runs.

A step saves a crop with `capture(name, { target, padding, ratio, anchor })`. `target` is `'window'`, `'editor'`, `'sidebar'`, `'panel'`, a locator, or a list of locators whose boxes are joined. `ratio` cuts the box to that shape from its top, or from its bottom with `anchor: 'bottom'`. Crop to what matters: a figure sits in a 16:9 frame about 650px wide, so a whole window is unreadable there (the `--shots` window is 1240 by 800 for that reason). Scroll a tall page to the feature with `scrollTo`; do not stitch.

## The real-window check

`npm run check:desktop` builds the extension, opens a real VS Code window on a throwaway project, clicks through the surfaces, and saves one screenshot per step under `.desktop-check/` (gitignored). It reads the terminal too, so a step can assert which command a button sent. The assistant is a stand-in script, so nothing real runs. The project has living specs on and is a git repository, because drift is read from git. `npm run shots` is the same script with `--shots .shots --sheet`.

| Flag | Effect |
| --- | --- |
| `--theme light\|dark` | Quiet Light (default) or Dark Modern. A run keeps one theme and writes `results.<theme>.json`, leaving the other theme's results and pictures beside it. |
| `--only <step,step>` | Run a subset |
| `--out <dir>` | Move the per-step screenshots |
| `--shots <dir>` | Also save the named crops and run the capture-only steps. Changes nothing the check asserts. |
| `--record <dir>` | Run the recording steps |
| `--extension <checkout>` | Test another checkout |
| `--sandbox <folder>` | Open an existing Spec Kit project in place of the throwaway one |

`--sandbox` runs only the steps that hold for any project and lists the rest as `skipped: needs the built-in project`. The assistant is still the stand-in, the profile is still a throwaway, and `specify` is kept off the window's `PATH` so opening the project cannot install presets into it.

It is also the scripted half of release QA: `.claude/skills/release-qa/surface-map.yml` names the steps behind each `scripted` check, so renaming a step means editing that map in the same change.

## The terminal check

`npm run check:terminal` (`tooling/scripts/terminal-check.mjs`) does the same for the Claude Code mod: it builds a throwaway project from a `speckit-sandboxes` recipe, starts the real `claude` CLI on it in a detached `tmux` session with `--plugin-dir apps/claude-mod`, sends keys, and reads the screen back. Each step saves `<step>.txt`, `<step>.png`, `<step>.band.png` (the band line alone) and `<step>.pane.png` (the pane alone), drawn from the terminal's own colour codes. `results.json` holds every step and every prompt the run met.

| Flag | Values |
| --- | --- |
| `--mode` | `replay` (default): no model run; checks the mod against copies of `specs/_02_demo-tasked` and `specs/_03_demo-living`. `run`: types the four Spec Kit commands into a fresh project and waits for each turn. **Run mode spends real usage, so never start it unless asked.** |
| `--recipe` | `claude-mod-stock` (default): stock Spec Kit, no run record, so replay strips each fixture's `.spec-context.json`. `claude-mod`: adds the Companion extension, keeps the record, and run mode types the `/speckit-companion-*` commands. |
| `--look` | `plain` (default). `site`: the site's colours, a rounded window and a soft shadow on a transparent margin, for the website and the docs. `claude`: a warm near-black terminal with a terracotta edge, for videos and pictures of Claude Code. |
| `--only`, `--out`, `--keep`, `--record` | A subset of steps, another output folder, keep the throwaway project, record |

A look changes only how pictures are drawn. It cannot hide a row: crop with `rowFrom`/`rowTo` where the picture is taken. On the 38-row video screen `rowFrom: 1, rowTo: 36` drops the blank first row and Claude Code's two status rows. The version banner shares its rows with the mod's pane, so let it scroll off as the transcript fills.

Add a step the same way as in the real-window check. `{ needs: 'record' }` or `{ needs: 'files' }` limits a step to the recipe that has, or lacks, a run record.

The session never uses `--dangerously-skip-permissions`: the script writes `acceptEdits` and an allow list (`settingsFor()`) into the throwaway project. A prompt that still appears is answered `Yes` once and listed at the end as a `needs an allow rule` finding. Complete the allow list from those; never make the script save a rule or switch the mode.

To watch a run read-only, paste the `tmux -L speckit-qa-<pid> attach ... -r` line the script prints at start into another terminal.

It finds the pane by its border column, the focused control by reverse video, and the end of a turn by the spinner line going away (written against Claude Code 2.1.289), so a release that redraws those needs a matching change in `tooling/scripts/lib/terminal/screen.mjs`.

`node tooling/video/terminal-player/capture-run.mjs` is the video variant: it walks one spec through every state of a run by writing its files, with no model turn, and saves each real screen to `.terminal-check/video-<fixture>/<state>.grid.json` for the player beside it to animate. It defaults to `--look claude`.

## Recordings for a video

```
npm run record            the extension in a real VS Code window
npm run record:terminal   the Claude Code mod in a real terminal
npm run record:board      the Copilot app board, headless
```

Each writes `.record/<name>/` (gitignored): a numbered sequence of PNG frames plus one `recording.json`. Each needs what its stills command needs.

**Frames are the whole output.** Timing, transitions and camera moves belong to the video tool that reads them (the films are cut in the `alfredo-perez.dev` repository under `apps/videos/`, with the look in `THEME.md`). `recording.json` is facts only: name, surface, frame rate, frame size, frame count, and one plain sentence saying what is on screen. No shot instructions.

| Recording | Script | What it films |
| --- | --- | --- |
| `living-spec-read` | `desktop-check.mjs` | A living spec scrolled from its counts past the requirement marked Drifted |
| `tasks-ticking` | `desktop-check.mjs` | The Tasks tab repainting as three tasks finish |
| `mod-tick-task` | `terminal-check.mjs` | The mod's pane and band counting tasks ticked from outside |
| `mod-session-start` | `terminal-check.mjs` | Claude Code starting in a project with specs: the pane opens by itself and three tasks tick |
| `board-tasks-read` | `board-shots.mjs` | A run's whole task list on the Copilot board, scrolled |
| `board-run-steps` | `board-shots.mjs` | Implement sent from the board's button, the rail turning to Running, tasks ticking, the rail reaching done |
| `board-spec-journey` | `board-shots.mjs` | One spec from the list through Specify, Plan, Tasks and Implement, each sent from the board's button |

`mod-tick-task` and the two board run films use the same spec (`tooling/scripts/lib/teamboard-run.mjs`), so terminal and board footage cut together. `board-spec-journey` also writes `events.json`, the frame number and second of each beat; a `done` mark sits a few frames ahead of the tick on screen.

**One recording at a time.**

- Terminal: `npm run record:terminal -- --only film-session-start`, or `-- --only start,film-tick-task` (`film-tick-task` types into the session, so it needs `start`).
- Extension: `npm run record` already passes `--only`, and a second one is ignored. Call the script: `npm run compile && npm run compile-web && node tooling/scripts/desktop-check.mjs --record .record --only film-living-spec` (or `film-tasks-ticking`).
- Board: `npm run record:board` always records all three.

**Record only what moves on its own**: a long document going past, or a run advancing. A dialog opening is one state arriving, and a still says it better. A recording is tens of megabytes, so nothing under `.record/` is committed.

**Scroll speed lives in one place.** `tooling/scripts/lib/recording.mjs` holds `SCROLL_PX_PER_FRAME` (16), `FPS` (12), `HOLD_SECONDS` (the still each recording opens and closes on) and `READ_SECONDS` (the longer beat for a state with words in it). No step picks its own.

**A run advancing is staged through the board's own server, never drawn.** The board films press the real button, and everything after is the fixture's files changing under `createSpecServer` (`tickTask`, then `writeTeamboardRecord`). Nothing in a recording may write to the page. Nothing checks every tick on screen, so look at a film before using it.

**Adding one** is a step with `{ record: true }` that calls `film(name, what, body)`. The helper holds, runs the body, holds again and writes the JSON. In the body: `recording.frame()` takes a frame, `recording.hold(seconds)` holds, `recordScroll(recording, locator)` scrolls a page to its end at the shared speed.

## Media no script here regenerates

- `board-story` (`docs/screenshots/board-story.gif`, `content/media/web/board-story.*`) has no composition on `main`; its source is on the `spike/video-workflow` branch. Every caption says it is a recreation of a run, sped up.
- The hero loops (`content/media/web/hero-*.webm`, `.mp4`, `-poster.png`) come from the `media/hero-loops-and-reply` branch. A new one is those three files plus a manifest entry whose id matches its `loop` on the landing page's hero entry.

## Fixtures are published copy

The Teamboard fixture prose (`apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/`) appears verbatim in public images and videos. Keep it legible and dull, and never anyone's real spec. FR-004 stays vacuous on purpose: it is the clarify-demo plant. No em dashes in fixture text or on-screen copy. The product name in on-image copy is "Spec Kit Companion", two words.

## What ships in the extension

- **Walkthrough media is packaged.** `assets/walkthrough/` is whitelisted in `.vscodeignore`, so any file dropped there ships. Its `spec-viewer.png` and `overview.png` are copies from `docs/screenshots/generated/`, because `docs/**` never ships: copy both again whenever `npm run clips:capture` regenerates them.
- **Social art is not packaged.** `assets/social/carousel-copilot/deck.html` composes real captures, and `node assets/social/carousel-copilot/render.mjs` writes the slide PNGs. Change the deck and re-run; never hand-edit a slide.

## Visual tests for the Workflow Builder

```bash
npm run test:visual               # layout + pixel baselines, compared locally
npm run test:visual:ci            # layout only, what CI runs
npm run test:visual -- --update   # re-bless the baselines after an intended change
```

`tooling/scripts/visual-builder.mjs` renders every `VS Code Extension/Pipeline Builder/*` story at two widths (1600 and 380) in both themes. A new story under that title is checked automatically; the runner injects the determinism.

- **Layout**: nothing overflows the panel shell, no control is drawn at zero size, nothing is clipped beyond reach, no console errors. CI runs it in the `visual-gate` job when the builder's files change (the `BUILDER` list in `.github/workflows/ci.yml`); `npm run clips:check` runs in the same job on the wider `VISUAL` list.
- **Pixels** are compared against the baselines in `apps/vscode/webview/src/pipeline-builder/__screenshots__/` and stay local, because font rasterisation differs between macOS and a Linux runner. A failing comparison writes the diff image under `diff/` beside the baselines.

After changing the shared `tooling/scripts/lib/storybook-browser.mjs`, re-run this and `npm run clips:capture`, and expect no diff under `docs/screenshots/generated/`.
