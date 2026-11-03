# Contract: runtime event handlers

## extension.yml events

`apps/speckit-extension/extension.yml` declares two entries under `events:`, and lists both commands under `provides.commands`.

- `user_prompt_submit` runs the command `speckit.companion.on-prompt`, timeout 10.
- `stop` runs the command `speckit.companion.on-stop`, timeout 10.

An older spec-kit ignores the `events:` key, so the lifecycle hooks keep recording every boundary there.

## Command frontmatter

Each handler command carries a `scripts:` block whose `py:` line spec-kit runs directly, with no model involved.

- `commands/speckit.companion.on-prompt.md`: `py: scripts/write-context.py --event user_prompt_submit`
- `commands/speckit.companion.on-stop.md`: `py: scripts/write-context.py --event stop`

## CLI

`write-context.py --event user_prompt_submit|stop` reads the agent's JSON payload on stdin and turns it into the existing `--hook` rewrite. The active spec comes from `.specify/feature.json`, as the hooks resolve it, because the stop payload does not name the step. Records written this way carry `by: extension`.

## Prompts that count

On `user_prompt_submit`, a prompt counts when it starts, after any leading spaces, with `/speckit-<step>`, `/speckit.<step>` or `/speckit-companion-<step>`, where the step is specify, plan, tasks, implement or converge. Arguments after the command are allowed. A counting prompt becomes `--hook start` for that step. A specify start is saved until the new folder exists, the same way the before-specify hook saves it. Any other prompt writes nothing, including `/speckit-companion-auto` and helper commands such as `doctor`.

## Stop gate

On `stop`, the newest open step is closed with `--hook finish` only when all of these hold:

- The step is open and not already closed by its hook.
- Its document was modified after the step started: the spec file for specify, `plan.md` for plan, `tasks.md` for tasks and implement.
- For implement, every task is checked.

A specify start still waiting in the saved file is closed the same way once the spec file is newer than it. Otherwise the stop writes nothing. A boundary already recorded is never recorded again, and a completed spec is never written to.

## Output contract

In event mode `main()` sends stdout and stderr to a buffer that only feeds the run trace. The handler prints nothing on either stream and exits 0 on every path: malformed input, no active spec and crashes included.
