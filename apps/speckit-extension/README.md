<!-- IMAGE PATHS: every image in THIS file uses an ABSOLUTE
     https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/... URL. The Spec
     Kit community catalog renders this file from main and cannot resolve relative paths. The
     root README keeps relative paths (GitHub and vsce both resolve those). -->

<p align="center">
  <img src="https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/apps/speckit-extension/assets/hero.png" alt="The SpecKit Companion sprout mascot tending rows of glowing seedlings in a forest clearing at dawn" width="100%">
</p>

<h1 align="center">SpecKit Companion: the Spec Kit extension</h1>

<p align="center">
  <!-- Both dynamic badges read apps/speckit-extension/extension.yml on main, so a release
       (or a floor bump) updates them without touching this file. -->
  <img src="https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2Falfredoperez%2Fspeckit-companion%2Fmain%2Fapps%2Fspeckit-extension%2Fextension.yml&query=%24.extension.version&label=version&color=0b6dd9" alt="extension version">
  <img src="https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2Falfredoperez%2Fspeckit-companion%2Fmain%2Fapps%2Fspeckit-extension%2Fextension.yml&query=%24.requires.speckit_version&label=spec-kit&color=008080" alt="required spec-kit version">
  <img src="https://img.shields.io/badge/license-MIT-gold" alt="license MIT">
</p>

This extension runs inside [Spec Kit](https://github.com/github/spec-kit) and records every step of a run in `.spec-context.json`, a plain file beside each spec. That record is what gives you live progress, a resume command and the Overview of a run, in your terminal and in every [SpecKit Companion](https://speckit-companion.dev) surface.

## Requirements

- A Spec Kit CLI installed from GitHub. The PyPI `specify-cli` has no `extension` command.
- `python3` is optional. Without it the recording is skipped and your Spec Kit command still runs.

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
```

## Install, update and verify

From your project root:

```bash
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
```

Run the same line again to update, because that URL always serves the newest build.

To verify, run `specify extension list` and look for `companion`. Then run `/speckit.specify` once and check that `specs/<NNN>/.spec-context.json` was written. More in [docs/install.md](./docs/install.md).

## First run

You don't have to change how you work. The extension hooks into the stock `/speckit.*` commands and records them as they run.

To use Companion's own pipeline, which writes shorter specs and sizes itself to the change, start a spec in your assistant:

```text
/speckit.companion.specify "let users upload a profile photo"
```

Then run plan, tasks and implement the same way, or all four at once with `/speckit.companion.auto`. At any point `/speckit.companion.status` prints where the spec stands and `/speckit.companion.resume` continues from there.

## Commands

| Command | What it does |
|---|---|
| `/speckit.companion.specify` | Write the spec and size the change |
| `/speckit.companion.plan` | Write `plan.md` |
| `/speckit.companion.tasks` | Write `tasks.md`, ordered by dependency |
| `/speckit.companion.implement` | Run the tasks, recording each one |
| `/speckit.companion.auto` | Run the whole pipeline without pausing |
| `/speckit.companion.status` | Print the current step, the decisions and the next action |
| `/speckit.companion.resume` | Continue from the recorded step |
| `/speckit.companion.doctor` | Report on a run's health. Read-only |
| `/speckit.companion.living-adopt` | Draft living specs for existing code |
| `/speckit.companion.living-sync` | Update living specs from your current changes |
| `/speckit.companion.living-drift` | List files changed since a living spec was committed |
| `/speckit.companion.living-coverage` | Show which requirements have a test |
| `/speckit.companion.living-show` | Print one slice of a living spec |
| `/speckit.companion.living-validate` | Check the shape of every living spec |
| `/speckit.companion.living-move` | Move a living spec between central and colocated storage |

The rest run by themselves, so don't type them: `speckit.companion.classify`, `speckit.companion.mark-complete`, and the hooks `speckit.companion.before-step`, `speckit.companion.after-specify`, `speckit.companion.after-plan`, `speckit.companion.after-tasks`, `speckit.companion.after-implement`, `speckit.companion.before-converge` and `speckit.companion.after-converge`.

Full reference: [docs/commands.md](./docs/commands.md). A build check requires every command to be named in this section.

## See it

The record is a file, and the VS Code extension turns it into a page. Install it with `code --install-extension alfredoperez.speckit-companion`.

![The record a run leaves behind: the whole Overview page, per-phase timing, verified checks with their commands, and requirement-to-test coverage](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/generated/overview-engine.gif)

<!-- other-products:start -->
## SpecKit Companion runs in four places

| Where | What it is | Start here |
|---|---|---|
| VS Code | The extension: a sidebar, a spec viewer and the Overview of every run. | [Install](https://speckit-companion.dev/docs/install) |
| Spec Kit | The engine half: records each step so every surface can show progress and resume. | [Install](https://speckit-companion.dev/docs/install) |
| GitHub Copilot app | A live spec board in the app's side panel. | [Copilot app](https://speckit-companion.dev/docs/copilot-app) |
| Claude Code | The followed spec's run above your prompt and in a pane. | [Claude Code](https://speckit-companion.dev/docs/claude-code) |
<!-- other-products:end -->

## Docs

The guides are at [speckit-companion.dev/docs](https://speckit-companion.dev/docs). The reference for this extension is in [docs/](./docs/), and releases are in the [changelog](./CHANGELOG.md).

## License

[MIT](./LICENSE) © alfredoperez. Independently maintained and not affiliated with the Spec Kit core team.
