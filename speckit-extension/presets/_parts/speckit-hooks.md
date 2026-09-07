## Pre-Execution Checks — stock spec-kit extension hooks

Companion runs **on top of** stock spec-kit, so a project's installed spec-kit **extensions** (git, and any others registered in `.specify/extensions.yml`) must still fire on a Companion run exactly as they do on a stock `/speckit.*` run. That is separate from Companion's own node-hooks in `.specify/companion.yml`; both fire. Like the rest of the pipeline this must **never fail the host command** — anything missing or malformed is skipped silently.

Let `<step>` be this command's phase: `specify`, `plan`, `tasks`, or `implement`. Run the pass twice — `hooks.before_<step>` **now, before any of the work below**, and `hooks.after_<step>` once this command's work is fully reported, before handing off.

- **Read `.specify/extensions.yml`.** Absent, unparseable, or carrying no entries for that anchor: skip silently, there is nothing to run.
- **Skip a hook that is `enabled: false`** (no `enabled` field means enabled), **and any hook whose `extension` is `companion`** — those exist so a stock run records its lifecycle, and this command records its own in its own body, so dispatching them is a turn that rewrites what this step just wrote. Every other extension's hooks fire as normal.
- **Leave `condition` to the HookExecutor.** A hook with no condition, or a null or empty one, is executable; one with a non-empty condition is skipped here and never evaluated by you.
- **Emit one block per executable hook.** An optional hook (`optional: true`):

  ```
  ## Extension Hooks

  **Optional Pre-Hook**: {extension}
  Command: `/{command}`
  Description: {description}

  Prompt: {prompt}
  To execute: `/{command}`
  ```

  A mandatory hook (`optional: false`) instead:

  ```
  ## Extension Hooks

  **Automatic Pre-Hook**: {extension}
  Executing: `/{command}`
  EXECUTE_COMMAND: {command}

  Wait for the result of the hook command before proceeding to the Outline.
  ```

  Those are the **before** pass's labels. In the **after** pass drop `Pre-` from the label, and drop the closing wait line — there is nothing left to wait for.

For `specify`, branch creation is normally one of these `before_specify` hooks (the git extension); the spec directory and its files are always created by the command body itself.
