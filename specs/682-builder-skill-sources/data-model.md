# Data model

## SkillChoice (new, `choices.skillCatalog[]`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | What a hook writes in `ref`: `house-check`, or `superpowers:brainstorming` for a plugin skill. |
| `name` | string | The skill's own name (the folder name). |
| `source` | `"project"` \| `"user"` \| `"plugin"` | Where it comes from. |
| `where` | string | The folder for `project` (`.claude/skills`, `.agents/skills`, `.specify/skills`), `~/.claude/skills` for `user`, the plugin name for `plugin`. |
| `description` | string | Its frontmatter `description`, one line, up to 200 characters; empty when it has none. |
| `callable` | boolean | False when the frontmatter sets `disable-model-invocation: true`. |
| `enabled` | boolean | False only for a plugin turned off in Claude Code settings. Always true otherwise. |

Sorted by source (project, user, plugin), then id. One entry per copy: the same name in two project folders appears twice with different `where`.

`choices.pluginsRead` (boolean, new): whether the plugin registry could be read. False means plugin skills are absent because they could not be checked, not because there are none.

## PipelineHook (existing) gains

| Field | Type | Meaning |
|---|---|---|
| `problem` | string | Empty when fine or when the hook is not a skill hook; otherwise the sentence below. |

## BuildReport (existing) gains

| Field | Type | Meaning |
|---|---|---|
| `warnings` | string[] | Every warning the build printed, without the `[build] ` prefix. |

## Problem sentences

| Case | `problem` |
|---|---|
| Not found | `No skill named "<ref>" in this project or an installed plugin, so this hook does nothing in a run. Install it or pick another skill.` |
| Plugin-style name, project skill of that name | `No installed plugin provides "<ref>". This project has a skill named "<skill>": name it without the "<plugin>:" prefix.` |
| Plugin-style name, registry unreadable | `"<ref>" could not be checked: Claude Code's plugin list could not be read.` |
| Plugin turned off | `"<ref>" comes from the plugin "<plugin>", which is turned off in Claude Code settings, so this hook does nothing in a run.` |
| disable-model-invocation | `"<ref>" is marked disable-model-invocation, so the assistant cannot call it from a hook. Only a person can run it, by typing /<ref>.` |

Build warning: `<command>: skill hook <when> <anchor>: <problem>`.
