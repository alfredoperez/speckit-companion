# SpecKit Companion spec board for the GitHub Copilot app

A [canvas extension](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) for the GitHub Copilot app. It opens a live board of every spec in your workspace, next to the chat.

![The spec board in dark mode](./assets/preview.png)

- **Board.** Every spec folder under `specs/` (or your `speckit.specDirectories`), most recently active first. Each row shows its status, a four-step rail (specify → plan → tasks → implement), and task progress. Filter by Active, Done or All, or search by name or number.
- **Spec detail.** The pipeline rail, the next step with a button that runs it, then the same tabs as the VS Code viewer: an Overview dossier (intent, timing per step, expectations, what was verified, decisions, coverage), and the spec, plan, tasks, research, data model and checklists rendered through the viewer's own markdown pipeline and stylesheet. An Activity tab lists the run history.
- **Live.** The board watches the spec folders. When the agent writes `plan.md` or ticks a task, the board updates without a refresh. It also watches for a spec folder that is not there yet, so the first spec of a project shows up as soon as the agent creates `specs/`.
- **Run from the board.** Buttons send the same line the VS Code sidebar dispatches, such as `/speckit.companion.plan specs/042-export-csv`, into the chat. When the Companion commands aren't installed, or the spec is recorded as the Spec Kit workflow, the board sends the stock `/speckit.*` commands instead. **New spec** asks which workflow to use, like the VS Code create-spec dialog: **Companion** (the default when installed) sends `/speckit.companion.specify`, **Spec Kit** sends `/speckit.specify`, and **Auto** sends `/speckit.companion.auto` and runs every step without pausing. Companion and Auto are disabled in a project where the companion extension is not installed. There, New spec and a spec's next-step card carry one line saying so, with **Install it**: it shows the install command with a Copy button, and **Ask Copilot to install it** sends the agent one line asking it to run that command and commit the skill files it generates. The line can be dismissed for the session.
- **The run records itself, and the chat stays short.** New spec and the plan, tasks and implement buttons come with the same lifecycle preamble VS Code sends (it is bundled from the extension's own source), so the run seeds `.spec-context.json` with the workflow and a specify start, and a stock Spec Kit run also closes specify itself. The board writes that preamble to a file in the project, `.speckit-companion/prompts/<step>-<spec folder>.md` (`specify-<timestamp>.md` for a new spec), and the chat message is the command line plus one sentence: "Before you start, read and follow the run instructions in `<that file>`." A Companion command's file is a few lines, because the command records its own steps; a stock Spec Kit command's file holds the full instructions, because nothing else records that run. The sent note's Show prompt and Copy give the short message and the file's path.
- **Agent actions.** The agent can drive the board too: `list_specs`, `get_spec`, `focus_spec`, `run_step`, `refresh`. Ask "what specs are still open?" or "show me the export spec" and the board follows.

The board never writes `.spec-context.json` or any spec file; the SpecKit commands it sends do that. The one thing it writes is its own run instructions under `.speckit-companion/prompts/`. It adds a `.speckit-companion/.gitignore` holding `*` when there is none, so they stay out of your commits, and leaves an existing one alone. It replaces a spec's older file for the same step, and refuses to write when `.speckit-companion` or `prompts` is a symlink that leads outside the project.

## Install

**In this repo** it already works. `.github/extensions/speckit-companion/extension.mjs` loads this folder, and the Copilot app picks up project extensions from `.github/extensions/`.

**In another project**, copy this folder to either place:

```bash
# for one project, shared with the team
cp -R apps/copilot-canvas <project>/.github/extensions/speckit-companion
# for every project on your machine
cp -R apps/copilot-canvas ~/.copilot/extensions/speckit-companion
```

The Copilot app runs each session in a fresh git worktree cut from your default branch. So a project copy only shows up once it's merged, and until then the canvas is missing from the session. While you're trying the board from a branch, install it for your user instead. A one-line loader keeps it pointed at your checkout:

```bash
mkdir -p ~/.copilot/extensions/speckit-companion
echo "import '$PWD/apps/copilot-canvas/extension.mjs';" > ~/.copilot/extensions/speckit-companion/extension.mjs
```

Then open the project in the Copilot app, start a session, and ask for the **SpecKit Companion** canvas. It also appears in the session's **+** menu under **Canvas**.

**A project copy has to be accepted first (Copilot app 1.1.26 and later).** The app treats `.github/extensions/` as code that can run on your machine and keeps it off until you accept it. Choose **Review repository content** on the notice the app shows, or in the project's settings under **Repository trust**, then **Accept for new sessions**. Only sessions started after that load the board; the one that was open when you accepted never does, and there the agent opens an empty `speckit-companion.md` in the editor instead. The app accepts the exact files, so after any change under `.github/extensions/` (an updated board included) the project shows **Update available** and new sessions lose the board until you accept again. An unaccepted project turns every extension off in its sessions, the user-folder copy included.

The run buttons need the Companion commands in the project (`specify extension add companion …`, see the [spec-kit extension README](../speckit-extension/README.md)). Without them the buttons send the stock `/speckit.plan`, `/speckit.tasks` and `/speckit.implement`, and the board offers the install command.

## Good to know

- **Opening the board starts nothing.** An agent that is only asked to open a canvas has been seen to go looking for work, so the canvas says "if you were only asked to open it, stop" in three places the agent reads: a rule appended to the session's system message, the canvas description, and the status of the open result. The rule leaves `/speckit` commands alone, so New spec still runs. If your agent still wanders, ask "Only open it, then wait for me."
- **Copilot worktrees have no `node_modules`.** Each session runs in a fresh worktree, so an implement step that runs tests installs the project's dependencies first. Expect that on every canvas run.
- **Companion's skills must be real, committed files.** The worktree is cut from committed `main`, so a `--dev` install, whose skills are symlinks into `.specify/extensions/companion/.specify-dev/`, leaves the agent without `/speckit.companion.*`. If the commands don't resolve in a session, check that `.github/skills/speckit-companion-*/SKILL.md` are real files in the commit. The e2e sandbox script checks this for you.

## Develop

```bash
npm run canvas:dev     # from the repo root: serves the board for this repo and prints its URL
npm run test:canvas    # node:test suites for parsing, rendering, the server, and the page in headless Chrome
npm run canvas:shots   # the page suite again, saving a screenshot of each state to .canvas-shots/
```

The page suite drives the board in the installed Google Chrome through `playwright-core` (already a dev dependency) and skips itself when there is no Chrome. It covers what the Copilot app would show: the list and filters, opening a spec on its Overview, the rendered tasks, a run button reaching the chat as a short message (and the prompt kept up to paste when there is no chat session), the install line in a project without Companion, a live update after a file change, the agent focusing a spec, the one-pane layout on a narrow panel, and light mode.

`canvas:dev` runs the same server the canvas uses, without the Copilot app. Run buttons print the short message and copy it to the clipboard instead of sending it, and still write its instruction file into the workspace. Add `&theme=light` or `&theme=dark` to the URL to force a theme.

Clicking through the demo specs (`specs/_0N_demo-*`) can change their `.spec-context.json`. Restore them with `git restore specs/_0*` before committing.

## How it's built

| File | Job |
|---|---|
| `extension.mjs` | Declares the canvas and its actions with `@github/copilot-sdk/extension`. Wiring only. |
| `server.mjs` | Loopback HTTP server per open canvas: the page, a token-guarded JSON API, and a server-sent event stream fed by a file watcher. The watcher follows each spec directory recursively and each folder above it, up to the project root, flat, so a spec directory that appears, or is deleted and created again, is picked up. |
| `specs-core.mjs` | Scans spec folders, reads `.spec-context.json`, and works out each step's state. It uses the same rules as the VS Code viewer. |
| `tasks.mjs` | Task checkbox parsing. It agrees with the VS Code extension through the shared `apps/vscode/tests/fixtures/task-grammar/` cases. |
| `overview.mjs` | The Overview dossier (intent, timing, expectations, verified, decisions, coverage), built from the run record with the viewer's own class names. |
| `vendor/` | Generated by `build.mjs`: the VS Code viewer's markdown renderer, stylesheet and step timing, bundled with esbuild so documents look exactly as they do in the extension. Rebuilt by `npm run canvas:build` (also on every `test:canvas`). Never edit by hand. |
| `prompts.mjs` | The chat lines the buttons send, and the instruction files they point at. |
| `public/` | The board page: plain HTML, CSS and JS, with no build step. The header's logo is the moss mascot, inlined from `assets/icons/moss.svg`. |

The folder has the same layout as an entry in [awesome-copilot's extensions](https://github.com/github/awesome-copilot/tree/main/extensions). `plugin.json` is the listing manifest, ready to copy to their `plugins/speckit-companion/plugin.json`. Its `logo` is the `assets/preview.png` screenshot, which is also the listing card image. The app lists the canvas by its `displayName` (SpecKit Companion) and `description` from `extension.mjs`. To submit it, follow their [contributing guide](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-canvas-extensions).
