# Research

## Plugin skills: where to read them

**Decision**: read `~/.claude/plugins/installed_plugins.json` only when its `version` is 2 and `plugins` is a map of lists. Keep an install whose `scope` is `user`, or whose `projectPath` is this project. Read skills from `<installPath>/skills/<name>/SKILL.md`, plus plain relative folders the plugin's `.claude-plugin/plugin.json` lists under `skills`. Name each `<plugin>:<skill>`, where `<plugin>` is the key before `@`.

**Rationale**: that file records every install with its path and scope, and it is what Claude Code itself reads. A version check means a future format is skipped, not misread.

**Alternatives considered**: walking `~/.claude/plugins/cache` (it keeps old versions and uninstalled plugins, so it would guess); asking the `claude` CLI (slow, and absent on many machines that run the build).

## Plugin turned off

**Decision**: merge `enabledPlugins` from `~/.claude/settings.json`, then `.claude/settings.json`, then `.claude/settings.local.json`; the last explicit value wins. Only an explicit `false` marks a plugin off.

**Rationale**: an install is enabled by default, and several installed plugins on a real machine appear in no settings file. Treating absence as off would flag working hooks.

**Alternatives considered**: require `true` (false alarms, see above).

## When the registry cannot be read

**Decision**: plugin skills are omitted, and a hook whose ref has a `:` gets "could not be checked" instead of "not found".

**Rationale**: the spec forbids guessing; a missing registry says nothing about whether the plugin is there.

## Developer's own skills

**Decision**: list `~/.claude/skills` as source `user` and never flag it.

**Rationale**: Claude Code loads it, so a hook naming one does run for this developer.

## Frontmatter

**Decision**: parse the frontmatter block with the existing stdlib reader `companion_config.load_yaml`, falling back to a `key: value` line scan when it raises. A description is collapsed to one line and capped at 200 characters.

**Rationale**: folded `>-` descriptions are common in skills; the existing reader handles them and adds no dependency.

## Build warnings in the report

**Decision**: `readBuildReport` collects every `[build] ` line printed before the `would build` / `built` line.

**Rationale**: the build already prints warnings there with that prefix; changing the prefix would break anything reading the log.
