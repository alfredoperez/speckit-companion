# Research: Step boundaries from runtime events

## Reuse the writer, no new script

- **Decision**: the handlers run `scripts/write-context.py --event <name>`.
- **Rationale**: the `--hook` rewrite already owns every boundary, including the saved specify start. A new script would also need two packing-list entries.
- **Alternatives considered**: a dedicated `on-event.py`. Rejected: a second entry point to the same writes.

## Silence both streams and always exit 0

- **Decision**: in event mode `main()` sends stdout and stderr to a buffer that only feeds the run trace, and returns 0 on every path, including crashes.
- **Rationale**: the dispatcher feeds a prompt handler's stdout into the model's context, and an exit of 2 erases the prompt or forces the agent to keep going.
- **Alternatives considered**: removing prints one by one. Rejected: about thirty print sites and a crash path would still leak.

## Close at a stop only on evidence

- **Decision**: a stop closes the newest open step only when its document (spec file, `plan.md`, `tasks.md`) was modified after its start, and for implement every task is checked. A specify start still waiting in the saved file is closed the same way once the spec file is newer than it.
- **Rationale**: Stop fires at every turn end, including a clarifying question. The document changing is the cheapest proof that the step did its work.
- **Alternatives considered**: closing on any stop. Rejected: it ends specify on the first question.

## Which prompts count

- **Decision**: a prompt starting with `/speckit-<step>`, `/speckit.<step>` or `/speckit-companion-<step>` for specify, plan, tasks, implement or converge. Anything else, including `/speckit-companion-auto`, writes nothing.
- **Rationale**: those are the steps a hook would stamp; auto stamps its own steps.
- **Alternatives considered**: matching any registered command. Rejected: helpers like `doctor` are not steps.
