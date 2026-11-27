# Research

**Decision**: Edit the registry as text, parsing it only to validate and to look up entries.
**Rationale**: The existing switch does the same, and a YAML round trip drops comments and reorders keys.
**Alternatives considered**: js-yaml load and dump (loses formatting); a YAML CST library (new dependency).

**Decision**: A hook is the user's own when its `extension` is not installed (not in `installed`, no folder under `.specify/extensions/`).
**Rationale**: Spec Kit's `register_hooks` and `unregister_hooks` only purge entries by extension id, so an entry naming no installed extension survives installs and removals and nothing else will rewrite it.
**Alternatives considered**: a marker comment or field (`source: user`) that Spec Kit would drop on its next save.

**Decision**: New entries are written as `extension: project`, `command`, `enabled: true`, `optional`, `prompt` when given, `description`.
**Rationale**: The trial's working entry has this shape; `priority` and `condition` default when absent.
**Alternatives considered**: copying the CLI's full shape with `priority: 10` and `condition: null`, noise for a hand-written entry.

**Decision**: Template layers follow `resolve_template_content` in Spec Kit's `common.py`: override, then enabled presets sorted by (priority, id) with a manifest strategy, stopping at the first `replace`; then extensions sorted the same way; then core.
**Rationale**: The board must say what a run will use, so it copies the CLI's order exactly.
**Alternatives considered**: shelling out to the CLI (slow, not always installed on the host path).
