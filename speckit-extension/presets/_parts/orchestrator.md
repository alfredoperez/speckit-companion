## Node hooks: run the project's `before`/`after` inserts

This command is assembled from ordered **nodes**. A project can attach its own work before or after any node by declaring it in `.specify/companion.yml`. You are the runtime: read that file if it is there and run those hooks at the right moments. Like the rest of the pipeline, this must **never fail the host command**. Degrade and continue.

**Find the hooks for this command.** An absent or empty `.specify/companion.yml` means no hooks: skip silently, and never warn. Look up `commands.<this-command>.hooks`. It has two anchors, `before` and `after`, each keyed by a node id from this command's order. Run a node's `before` hooks immediately before that node's work, and its `after` hooks immediately after. When several hooks sit at one anchor, run them **top to bottom, in declared order**.

**Hook types:**

- `{ type: command, run: "<shell>" }`: run the shell command with your terminal/Bash tool, then continue. *If you have no terminal tool* (some chat-only providers), don't pretend to: report the command you would have run and continue.
- `{ type: prompt, text: "<instruction>" }`: treat the text as an inline instruction and act on it before moving on.
- `{ type: node, ref: <id> }`: read `.specify/companion/nodes/<id>.md` and carry out its body as if it were part of this command.

**Background hooks.** Any hook may add `background: true`. Kick it off and continue immediately, without waiting for it to finish. Use it for slow, independent side-effects such as a test run, a build or a notification: for a `command`, launch it detached (e.g. append `&` or use `nohup … &`); for a `node`/`prompt`, do its work without blocking the next step. Report its result whenever it lands, but never block on it. **Do not** mark `background` on anything that writes `.spec-context.json`, meaning the timing and capture calls: those run a read-modify-write on a shared file, so two racing in the background can lose an update. Background is for side-effects, not bookkeeping.

**Failure handling (never abort the host command):**

- **No `.specify/companion.yml`** → there are no hooks; run the command exactly as written. Do not warn.
- **The file is malformed or unparseable** → ignore it, note one short warning, and run the shipped command unchanged.
- **A hook is anchored to a node that isn't in this run's order** (e.g. a recipe dropped it) → warn once and skip that anchor's hooks.
- **A `type: node` hook's `ref` file is missing** → a real misconfiguration: report it clearly and stop before doing damage, rather than silently skipping.

If a hook's own work fails (a `command` exits non-zero, a `node` can't complete), report it and continue the pipeline, unless the failure clearly makes the rest unsafe. A hook never blocks the host command's own output.
