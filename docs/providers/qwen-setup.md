# Qwen Code CLI — Setup Guide

This guide explains how to install and configure **Qwen Code CLI** (`qwen`) for use with
SpecKit Companion.

---

## Prerequisites

- Node.js 18+ (for npm installation)
- A Qwen / Alibaba Cloud account for authentication

---

## Installation

### npm (recommended)

```bash
npm install -g @qwen-code/qwen-code@latest
```

Verify the installation:

```bash
qwen --version
```

---

## Authentication

Qwen Code supports two authentication methods:

### Option 1 — OAuth (browser-based)

Run the interactive CLI once to trigger the OAuth flow:

```bash
qwen
```

Follow the prompts to log in with your Alibaba Cloud / Qwen account.

### Option 2 — API Key

Set the `QWEN_API_KEY` environment variable (or `DASHSCOPE_API_KEY` for DashScope):

```bash
export QWEN_API_KEY="your-api-key-here"
```

Add this to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) to persist it across sessions.

---

## Configuring SpecKit Companion

### 1. Select Qwen Code as the AI provider

Open VS Code Settings (`Cmd/Ctrl + ,`) and search for **SpecKit AI Provider**, then choose
`qwen`. Alternatively, set it directly in `settings.json`:

```json
"speckit.aiProvider": "qwen"
```

### 2. Available settings

| Setting | Default | Description |
|---|---|---|
| `speckit.qwenPath` | `"qwen"` | Path to the Qwen Code CLI executable. Change this if `qwen` is not on your `PATH`. |
| `speckit.qwenYoloMode` | `false` | Enable `--yolo` mode to auto-approve all Qwen actions without prompts. |

Example `settings.json`:

```json
{
  "speckit.aiProvider": "qwen",
  "speckit.qwenPath": "qwen",
  "speckit.qwenYoloMode": false
}
```

---

## Verifying it works

1. Open a workspace that contains a `.claude/specs/` directory (or run **SpecKit: Create Spec**).
2. Open the Command Palette (`Cmd/Ctrl + Shift + P`) and run **SpecKit: Specify**.
3. A split-view terminal should open and run:
   ```
   qwen -p "$(cat /path/to/prompt.md)"
   ```
4. If `qwen` is not installed, SpecKit will show an error with a **Copy Install Command** button.

---

## Steering files

Qwen Code uses `QWEN.md` as its steering file, similar to how Claude uses `CLAUDE.md`.

| File | Purpose |
|---|---|
| `~/.qwen/QWEN.md` | Global user-level instructions |
| `QWEN.md` (project root) | Project-level instructions |
| `.qwen/steering/*.md` | Additional steering documents |

The **Steering** panel in SpecKit will show the global and project `QWEN.md` files.

---

## Troubleshooting

### `qwen: command not found`

- Make sure the npm global bin directory is on your `PATH`.
- Run `npm bin -g` to find the directory and add it to your shell profile.
- Or set `speckit.qwenPath` to the absolute path of the `qwen` binary.

### Authentication errors

- Re-run `qwen` interactively to refresh your OAuth token.
- Check that `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`) is set correctly.

### Prompt never executes

- Increase `speckit.terminalDelay` if the terminal needs more time to initialise.
- Ensure your shell has the `qwen` binary available in non-interactive sessions (check `PATH` in
  `.zshenv` or `.bashrc`, not just `.zshrc`).
