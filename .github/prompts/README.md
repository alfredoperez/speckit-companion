This directory contains prompt files for slash commands.

Naming convention:
- Use the filename (without extension) as the slash command, e.g. `specify.md` -> `/specify`.
- Supported extensions: .md, .txt, .yml, .yaml, .json

Usage:
- When the workflow is installed, commenting `/command` on issues or PRs will dispatch a workflow event containing the prompt contents.
- The workflow maps comment bodies that start with a slash command to the corresponding prompt file and triggers downstream actions.

Example files:
- specify.md
- tasks.md

Be careful: prompt files may contain sensitive data. Do NOT store secrets here.