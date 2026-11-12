## Stock spec-kit extension hooks

Only if `.specify/extensions.yml` lists entries under `hooks.before_<step>` or `hooks.after_<step>`, where `<step>` is this command's phase, read `.specify/extensions/companion/commands/reference/speckit-hooks.md` and follow it: the `before_` pass now, before any work below, and the `after_` pass once this command's work is reported. Otherwise skip this.
