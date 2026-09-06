---
allowed-tools: Bash(node ../speckit-bench/sync-templates.mjs:*), Bash(node ../speckit-bench/run-all.mjs:*), Bash(specify:*), Bash(uv tool:*), Bash(npm run compile:*)
description: Install the latest spec-kit + Companion extension and bake the bench cells
---

## Your task

Bake the bench cells so a round measures **current** tooling. The harness lives in the sibling [`speckit-bench`](https://github.com/alfredoperez/speckit-bench) repo; the app it measures lives in [`conduit`](https://github.com/alfredoperez/conduit). Nothing it writes lands in this repo.

### 1. Compile the extension first

The driver dispatches the same per-step preamble the GUI does, imported from `dist/ai-providers/promptPreamble.js`. Build it:

```bash
npm run compile
```

### 2. Bake

```bash
node ../speckit-bench/sync-templates.mjs --sizes easy,medium,hard,oversized
```

Defaults are `--speckit latest --ext latest`, which is what a measured round wants:

- `--speckit latest` installs the spec-kit CLI from GitHub source (`uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force`) — the only build that carries `specify extension`. `--speckit keep` leaves whatever is installed.
- `--ext latest` installs the Companion spec-kit extension from the rolling `companion-latest` release asset. `--ext code` installs from this checkout's `speckit-extension/` with `--dev` (use it to measure unreleased work). `--ext <tag>` pins an archived release.

The bake reflinks the app clone per cell (instant, `node_modules` included — no dependency install), runs `specify init`, arms each cell for its arm, tags a git baseline, and **fails loudly if any cell file mentions the bench**. It records the spec-kit CLI version, the spec-kit extension version and the Companion version into `cells.json`, and every result row carries all three.

If the app clone is missing, the script prints the one-time clone command. Run it once per laptop.

### 3. Report

Print the three versions the bake recorded and confirm the cell count. Say which arm each letter carries only if the user asks — the letters are opaque on purpose, and `node ../speckit-bench/run-all.mjs --dry-run` prints the table when it is wanted.
