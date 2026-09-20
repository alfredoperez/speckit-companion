# Getting Started

The full install story and the first-spec walkthrough live on the website: [Install](https://speckit-companion.dev/docs/install) covers both halves in order, and [Getting started](https://speckit-companion.dev/docs/start/getting-started) takes you from an empty folder to a readable run record. What follows here is specific to working in this repo, plus the reference for the extension's own in-editor walkthrough.

## The Get Started walkthrough

VS Code opens a **Get Started with SpecKit Companion** walkthrough on the welcome page right after install, and **Help → Get Started** reopens it whenever you want. Unlike the sidebar's empty states, it shows up even in a workspace that has no specs and no `.specify/` directory, which is exactly where a first install usually lands.

Six steps, each with its own button:

| Step | What it does | Shown when |
|------|--------------|------------|
| Open a project | `vscode.openFolder` | Only with no folder open |
| See what a spec looks like | Seeds and opens the bundled sample spec (`speckit.openSampleSpec`) | Always |
| Install the Spec Kit CLI | `speckit.installCli`; ticks itself off once `speckit.cliInstalled` is true | Always |
| Set up this project | `speckit.initWorkspace`; ticks itself off once `speckit.detected` is true | Always |
| Write your first spec | `speckit.create` | Always |
| Read the Overview it leaves behind | Links to the Overview reference | Always |

The order is deliberate: reading a real spec comes *before* installing anything, because the viewer needs no CLI. The two CLI steps are marked optional in their own copy — install is the required piece, the CLI only runs the phase commands it dispatches.

Full extension-side reference (both installs, the required-vs-optional pieces, dispatch styles): [the spec-kit extension README](../apps/speckit-extension/README.md) and its [install guide](../apps/speckit-extension/docs/install.md).

## Sample specs

Looking for "what does good look like?" The repo's own `specs/` directory is the answer. Every feature ships with the spec that drove it. A few worth opening:

- [`specs/008-spec-viewer-ux/`](../specs/008-spec-viewer-ux/): **full SpecKit flow**: spec, plan, research, data model, quickstart, tasks, plus checklists and contracts.
- [`specs/065-multi-select-specs/`](../specs/065-multi-select-specs/): **minimal SDD flow**: just `spec.md` + `plan.md` + `tasks.md` for a small UX change.
- [`specs/051-explorer-viewer-fixes/`](../specs/051-explorer-viewer-fixes/): **minimal SDD flow**: same minimal shape, applied to a focused bug-fix bundle.

Compare the file lists side by side to see the contrast between the full and minimal flows.

## Platform support

| Platform     | Support  | Notes                                                                       |
| ------------ | -------- | --------------------------------------------------------------------------- |
| macOS        | Yes      | Fully supported                                                             |
| Linux        | Yes      | Fully supported                                                             |
| Windows WSL  | Yes      | Supported                                                                   |
| Windows      | Yes      | All bash-only providers (Copilot, Claude, OpenCode, Qwen) auto-detect PowerShell and use the equivalent `Get-Content -Raw` substitution; cmd.exe is supported on a best-effort basis (long prompts may exceed cmd's 8191-char line limit; switch to PowerShell or Git Bash if you hit it). |

## Development

```bash
git clone https://github.com/alfredoperez/speckit-companion.git
cd speckit-companion
npm install
npm run compile
```

Open the project in VS Code and press `F5` to launch the Extension Development Host.

```bash
npm run package
# Output: speckit-companion-{version}.vsix
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full dev-loop, test conventions, and commit style.
