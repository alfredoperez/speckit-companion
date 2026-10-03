# Research: SpecKit Companion mod for Claude Code

## How the mod shares the board's rules

**Decision**: move the board's pure rules into `apps/copilot-canvas/spec-rules.mjs` and bundle it into the plugin with esbuild (`apps/claude-mod/build.mjs` → `hooks/vendor/board-rules.mjs`), checked for staleness in CI.

**Rationale**: a hooks module may import only files inside its own plugin directory, by relative path, and has no Node APIs, so it cannot import `specs-core.mjs` (which reads with `node:fs`) or anything outside `apps/claude-mod/`. Splitting the reader into pure rules and IO lets both surfaces run the same functions; the bundle already inlines the timing derivation from the VS Code source through the canvas's `vendor/step-history.mjs`.

**Alternatives considered**: importing across directories (refused by the loader); reimplementing the rules in the mod (the three surfaces would drift, which is the bug this issue exists to avoid); a symlink (not followed into an installed plugin copy).

## Where the mod reads files

**Decision**: `register.js` reads through `$.fs.list` and `$.fs.read` and passes plain text to the shared rules. A spec folder's last activity comes from its record's history, else the newest file time that `$.fs.list` reports, as the board does.

**Rationale**: static analysis requires every `$` call to sit in the hooks module itself; passing `$` into an imported helper fails validation.

## Keeping the band and pane live

**Decision**: re-read only the followed spec (its record and `tasks.md`) after each tool call finishes and every 3 seconds, redrawing only when the text changed. Rescan every folder at session start, on `/spec`, and after each turn while following automatically.

**Rationale**: capture writes come from the agent's tool calls (the writer script runs through Bash), so a post-tool refresh catches them at once; the timer catches writes from another terminal or VS Code. Rescanning hundreds of folders every few seconds would be wasteful, and the followed spec only changes when the user switches or a new run starts.

**Alternatives considered**: a file watcher (the mods API has none); only a timer (a visible lag after each task tick).

## Knowing whether anything draws

**Decision**: `/spec` draws (opens the pane) when `$.session.surfaces()` includes `terminal` or `desktop`, and otherwise replies with text.

**Rationale**: the types say `surfaces()` is empty in a plain `-p` run, and the VS Code chat panel draws no mod UI. Checking the surfaces list is the documented way to fall back.

## Remembering the hand-picked spec

**Decision**: store it in `$.store` under `follow:<project root>`; `/spec auto` deletes the key.

**Rationale**: the store survives reloads and restarts, and one key per project keeps sessions in different projects from overwriting each other.

## Testing a real record

**Decision**: `build.mjs` also writes `tests/fixtures/demo-specs.js`, the `specs/_0N_demo-*` files as a path → text map, and tests stub `fs.list` and `fs.read` from it.

**Rationale**: a plugin test can import only relative files and `claude-code`, so it cannot read the fixtures from disk. A generated copy, covered by the staleness check, keeps the test on the real fixtures.

## The band line

**Decision**: "<last done step> done · Tasks c/t · <step in flight> running", using "<next step> next" when nothing is in flight. When the task count is shown, the tasks step is not also named as done. A finished spec reads "<status label> · Tasks c/t · <total> active".

**Rationale**: it reproduces the issue's example, "Plan done · Tasks 7/12 · Implement running", where the count stands in for the finished tasks step.

## Opening the pane

**Decision**: open the pane at session start when a spec is followed and something draws, and on `/spec`.

**Rationale**: Claude Code places a pane the mod opens by itself only on a terminal at least 144 columns wide, which is exactly the beside-the-transcript case; on a narrow terminal it waits until the user runs `/spec`.
