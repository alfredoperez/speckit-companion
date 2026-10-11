# Contract: the recording command line

A skill in another repository calls these commands from the root of this checkout. Nothing else here is an interface. The scripts live in `tooling/scripts/` and the npm scripts in the root `package.json`.

## Recording commands

| Command | Script it runs | Recordings it writes |
|---|---|---|
| `npm run record` | `desktop-check.mjs --record .record --only film-living-spec,film-tasks-ticking` | `living-spec-read`, `tasks-ticking` |
| `npm run record:terminal` | `terminal-check.mjs --record .record` | `mod-tick-task`, `mod-session-start` |
| `npm run record:board` | `board-shots.mjs --record .record` | `board-tasks-read`, `board-run-steps`, `board-spec-journey` |

`mod-session-start`, `board-run-steps` and `board-spec-journey` are new with this feature. The other four names do not change.

`npm run record` compiles the extension first. `npm run record:board` builds the canvas first.

## Still commands

| Command | What it does | Output |
|---|---|---|
| `npm run shots` | Compiles, then drives a real editor window and saves the named crops and one sheet | `.shots/` |
| `npm run shots:board` | Builds the canvas, then saves the board pictures from a headless browser | `.shots/` |
| `npm run check:terminal` | Drives the terminal mod and saves a picture per step | `.terminal-check/<recipe>-<mode>/` |
| `npm run shots:place` | Copies named pictures from `.shots/` to every place `tooling/scripts/shots.json` lists. Opens no window. | The paths in `shots.json` |

## Flags

- `--only <step,step>` limits a run to the named steps. Names are separated by commas with no spaces. `desktop-check.mjs` and `terminal-check.mjs` read it. `board-shots.mjs` does not.
- `--only` takes step names, not recording names. The recorded steps are `film-living-spec`, `film-tasks-ticking`, `film-tick-task` and `film-session-start`.
- Pass a flag through npm after two dashes: `npm run shots -- --only <step>` or `npm run record:terminal -- --only film-session-start`.
- `npm run record` already sets `--only`. A second `--only` after the two dashes is ignored, because the script reads the first one.
- `--record <dir>` turns the recording steps on and names the folder. The three record commands set it to `.record`.
- `--shots <dir>` on `desktop-check.mjs` and `terminal-check.mjs` saves the named crops into that folder.
- `--mode replay|run` and `--recipe claude-mod-stock|claude-mod` on `terminal-check.mjs` choose the folder name under `.terminal-check/`. The defaults give `.terminal-check/claude-mod-stock-replay/`.
- `--from <dir>`, `--check` and `--list` belong to `shots:place`.

## Output

Each recording lands in `.record/<name>/`. The folder holds numbered frames, `0001.png` upward, and one `recording.json`.

`recording.json` has seven fields: `name`, `surface`, `fps`, `width`, `height`, `frames` and `what`. `name` equals the folder name. `what` is prose about what is on screen.

A consumer plays the frames back at the `fps` the file states. It reads that value from the file and never assumes it.

Frame rate, scroll speed and hold lengths are set in `tooling/scripts/lib/recording.mjs` as `FPS`, `SCROLL_PX_PER_FRAME`, `HOLD_SECONDS` and `READ_SECONDS`. No step picks its own.

Stills in `.shots/` are PNG files named after the crop. A file whose name starts with `_` is a sheet, not a crop.

## Failure

- A command that fails exits with a code other than 0.
- A recording with no frames throws and writes no `recording.json`.
- A recorded task tick that does not find its task line throws. The step fails. It does not film an unchanged screen.
- `shots:place` exits with code 2 when the `.shots/` folder is missing.

## What the machine needs

`npm run record` and `npm run shots` need a real editor window. `npm run record:terminal` and `npm run check:terminal` need the terminal multiplexer and a logged-in assistant command line. `npm run record:board` and `npm run shots:board` need only the headless browser.
