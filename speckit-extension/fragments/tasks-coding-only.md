---
name: Coding tasks only
section: Notes
for: tasks
summary: Rejects tasks an agent cannot do — no UAT, deploy, metrics, docs or comms lines padding the list.
---

**Every task must be one a coding agent can carry out in this repository.**

Do not write tasks for:

- user acceptance testing, or asking someone to try it
- deployment, release, or environment provisioning
- gathering metrics after the fact
- "run the app end to end and check it looks right"
- documentation or training that is not a file in this repo
- announcements, tickets, or telling somebody

Each of those is real work and none of it belongs here. A list padded with them
reads as thorough and then stalls the run at the first line nobody can execute.

Every task names the files or components it touches. A task that names no file
is a heading, not a task — either give it one or fold it into the task that has it.
