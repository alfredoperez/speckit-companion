# Data Model: Keep the recording tooling here, send the films elsewhere

This feature adds no stored application data. Its entities are the files a capture script writes for the video tool in the other repository, and the fixture states the board films move through.

## Recording

A folder `.record/<name>/` of numbered PNG frames plus one `recording.json`. Opened by `startRecording(dir, name, { surface, what, fps, grab, flush })` in `tooling/scripts/lib/recording.mjs`.

| Field in `recording.json` | Type | Meaning |
| --- | --- | --- |
| `name` | string | The recording's name, which is also its folder name |
| `surface` | string | Which product surface was filmed, and how |
| `fps` | number | Frame rate. Defaults to `FPS`, which is 12 |
| `width` | number | Frame width in pixels, read from the first PNG |
| `height` | number | Frame height in pixels, read from the first PNG |
| `frames` | number | How many frames the folder holds |
| `what` | string | One plain sentence about what is on screen and what to notice |

Frames are named `0001.png`, `0002.png` and so on, four digits, starting at 1.

Validation rules:

- A recording with no frames throws on `close()`. No `recording.json` is written for it.
- `what` is prose a person would say out loud. It is never a shot instruction.
- `recording.json` holds facts only. No timing curve, transition or zoom path belongs in it.
- Every recorded scroll moves `SCROLL_PX_PER_FRAME` pixels per frame. No step picks its own speed.
- A recorded step that finds nothing on screen must fail. A task tick goes through `tickTask(file, id)`, which throws when the task line is missing.
- Nothing under `.record/` is committed.

Shared constants live in the same file: `FPS`, `SCROLL_PX_PER_FRAME`, `HOLD_SECONDS` and `READ_SECONDS`.

Lifecycle: opened by `startRecording`, grows by `frame()` and `hold(seconds)`, then `close()` awaits `flush`, writes `recording.json` and returns the facts. A closed recording is not reopened.

Recordings this feature adds or reshapes: the run moving through its steps on the board (FR-001), `board-spec-journey` (FR-002), the session start filmed from launch (FR-003), and `mod-tick-task`, which moves onto `RUN_FOLDER` (FR-004).

## Journey marks

One extra file, `events.json`, written beside `recording.json` for `board-spec-journey` only. It is an array of marks in the order they happened, so the video tool can cut on a named moment without counting frames.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | The moment, for example `list`, `open`, `plan sent`, `planned`, `tasks tab`, `T001 done`, `completed` |
| `frame` | number | How many frames the recording held when the mark was made |
| `at` | number | The same point in seconds: `frame / FPS`, to three decimals |

Rules: `frame` never goes down from one mark to the next, and no mark's `frame` is larger than the recording's `frames`. A mark belongs to exactly one recording.

## Board run fixture

The run the board and the terminal mod both film. It lives in `tooling/scripts/lib/teamboard-run.mjs` and is copied from the fixture folder named by `RUN_FOLDER`, which is `041-profile-photo-upload`.

| Name | Value | Used by |
| --- | --- | --- |
| `RUN_STATES` | `specified`, `planned`, `tasked`, `implementing` | `writeTeamboardRun`, which writes the files and the run record |
| `RECORD_STATES` | `RUN_STATES` plus `completed` | `writeTeamboardRecord`, which writes the run record alone |

Validation rules:

- `writeTeamboardRun` throws on a state outside `RUN_STATES`.
- `writeTeamboardRecord` throws on a state outside `RECORD_STATES`.
- `completed` is a record-only state. No walkthrough picture is written for it.
- `writeTeamboardRun` with `record: false` leaves the run record out, as in a stock Spec Kit project.
- Every time in the record is moved so the last thing the run did was 90 seconds ago.

State transitions in `board-spec-journey`: `specified` → `planned` → `tasked` → `completed`. Each move copies the step's files into the folder first, then calls `writeTeamboardRecord` with the new state. Plan brings `plan.md`, `research.md` and `data-model.md`. Tasks brings `tasks.md`. Implement ticks `T001` to `T006` one at a time, then the record moves to `completed`. The journey never passes through `implementing`.

## Relationships

- A Recording has many frames and exactly one `recording.json`.
- A Recording has zero or one `events.json`. Today only `board-spec-journey` has one.
- The board films and the terminal task-ticking film read the same Board run fixture, so the two can be cut together.
