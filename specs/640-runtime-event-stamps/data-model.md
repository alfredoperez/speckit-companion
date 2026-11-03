# Data Model: Step boundaries from runtime events

No new stored entity. Every write goes into the existing `.spec-context.json` history through the `--hook` rewrite, marked `by: extension`. The entities below are the inputs and the decisions the event mode reads.

## Event payload

The JSON an agent sends on stdin, read once per run, with the event name coming from `--event` (`user_prompt_submit` or `stop`).

- **prompt** (string): the only field read, and only for `user_prompt_submit`. Everything else in the payload is ignored.
- Validation: a payload that is empty, not JSON, not an object, or has a non-string prompt means nothing is written. A stop payload carries nothing Companion needs, so it is not parsed beyond being readable.
- Rule: malformed input never raises; the run ends silently with exit 0.

## Step command match

Derived from the prompt, not stored. After trimming leading spaces, the prompt must start with `/speckit-<step>`, `/speckit.<step>` or `/speckit-companion-<step>`, where step is specify, plan, tasks, implement or converge. Arguments after the command are allowed. Anything else, including `/speckit-companion-auto` and helpers such as `doctor`, matches nothing. A match becomes `--hook start` for that step. For specify the start is saved until the feature folder exists, as the before-specify hook does.

## Open step

A step with a start in the history and no complete after it, read from `.spec-context.json` of the active spec. The active spec comes from `.specify/feature.json`. A stop looks at the newest open step only.

State transitions of one step as the event mode sees them:

- not started to open: a matching prompt arrives and no start is recorded yet.
- open to closed: a stop arrives and the step document test passes.
- open to open: a stop arrives and the test fails; nothing is written.
- closed or already started: any further event for the same boundary adds nothing, so the first writer (event or hook) stands.
- a completed spec never changes.

## Step document

One file per step, used as evidence of work:

- specify: the spec file.
- plan: `plan.md`.
- tasks and implement: `tasks.md`.

The document counts as done when its modified time is later than the step's recorded start. A specify start still waiting in the saved file is closed the same way once the spec file is newer than the saved start.

## Stop gate

A stop closes the open step, as `--hook finish`, only when all hold: a spec is active and not completed, a step is open, its document changed after the start, and for implement every task in `tasks.md` is checked. If any fails, the stop writes nothing. This keeps a clarifying-question stop on specify from ending the step.

## Run guarantees

In event mode both streams go to a buffer that only feeds the run trace, and the exit code is 0 on every path, including crashes. No active spec means no write.
