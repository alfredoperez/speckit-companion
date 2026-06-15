# Review checklist — scan every diff against this

The review subagent in `/ship-ticket` and `/fix-tickets` reads this **before** reviewing, and checks the diff against it. These are recurring bug classes earlier reviews caught — phrased as *scans*, not narrative. Keep it that way:

- A line earns its place only if it's **checkable** (a reviewer can verify it against a diff), **recurring or high-cost**, and **phrased as a check** ("flag X when Y"). Edit an existing line before adding a near-duplicate.
- Universal authoring rules live in **`CLAUDE.md`** (Webview & rendering invariants, Code Comments, Design tokens) — scan the diff against those too; they're not repeated here.
- One-off insights, style preferences, and loop mechanics do **not** belong here (loop mechanics live in the command files).

---

## First pass — always

- **CLAUDE.md conventions.** Scan for any violation of the *Webview & rendering invariants*, *Code Comments*, and *Design-token* rules in `CLAUDE.md`.
- **Comments.** Flag added comments that restate the code, narrate a fix's history, carry a spec/PR/finding id (`// per #182`), or run past one line. Default is no comment.
- **Diagnostic logs.** Flag `console.log`/bracket-tag debug lines left in; structural `logError`/catch-block logging stays.

## Capture / `.spec-context.json`

- **Terminal status is `implemented`, never `completed`.** `completed` is the user's Mark-Completed action only; the capture script refuses to write it. Flag any code/doc that forces `completed` on autonomous finish. (#208, #244)
- **Fast-path lands at `tasks` + `ready-to-implement`, not "at implement."** Flag docs/changelogs/command bodies that say a fast-tracked spec "lands at implement." (#237)
- **Upsert by MERGING onto the existing record, never rebuilding it.** A writer that does `record[id] = {…}` each call drops reader-supported fields (`concerns`) and erases prior `did`/`files` on a bare re-journal. Read existing → copy → set only new non-empty fields. (#256)
- **Derive UI fields from the FULL discriminator, not field-presence.** Gate a surfaced optional field (e.g. active task id on a row) on step + finish/kind, not just `field != null` — keep a legacy `kind == null` fallback. (#238)
- **Task completeness compares per-occurrence marker counts, never collapsed sets.** `set(all) <= set(done)` reads 100%-done when a duplicate id has one marker checked and one not; use `len(done) == len(all)` on the per-occurrence lists. A completion/step-close gate also needs BOTH signals — tasks.md at 100% AND every task journaled — not either alone, or a journaled-but-unchecked task closes the step while status stays `implementing`. (#317)

## Command-family & extension gating

- **Guard a command/namespace family by shared PREFIX, not an enumerated subset.** An enumerated map of the 4 pipeline commands let a 5th (`speckit.companion.mark-complete`) slip the guard. Key off the `speckit.companion.` prefix; suppress members with no stock twin rather than dispatching them. (#300)
- **Gate `/speckit.companion.*`-dependent UI on the extension dir** (`.specify/extensions/companion/`), not on preset presence — a preset-only project must read as "not installed." Check `isCompanionInstalled()` directly at *every* call-site a namespaced command could dispatch. (#218, #234)
- **Before making an activation-time step unconditional, confirm its inputs/paths always exist.** Removing a gate made a preset-add run on every activation in projects lacking the companion dir → failing command + error log each activation. Gate on the on-disk install signal and rerun from the existing file watcher. (#300)
- **Close the implement step from the always-on `tasks.md` watcher, not terminal/hook paths** — implement has no "next step," IDE-chat returns no terminal handle, stock mode has no hook. (#244)

## Keys, collisions & identifiers

- **A synthetic/follow-on map entry needs a DISTINCT key.** Reusing `tempFileSet.id` for a staged-images entry clobbered the temp-set entry and leaked its dir; use a derived key (`<id>-staged-images`). (#208)
- **Guard synthetic list entries against name collision.** Skip + warn when injecting a reserved-named entry (workflow option, etc.) if a user entry already uses that name — else duplicate DOM `<option>`s + last-write-wins `Map` clobber. (#218)
- **Persist only resolvable identifiers.** Don't write a UI-only synthetic name (`speckit-turbo`) into `.spec-context.json`; persist the resolvable base (`speckit`) + a separate pin (`profile: turbo`). (#218)

## Types & data boundaries

- **Enum-by-TYPE is not enum-by-DATA — coerce at the privacy/telemetry boundary.** A field typed `'a'|'b'` sourced from user-authored data (`settings.json`, `.spec-context.json`, custom-workflow step names) can carry arbitrary text. Allow-list at the emit boundary; don't trust the declared type. (#129)
- **When a runtime value becomes first-class, widen its TYPE — don't `as string` cast it.** Add the value to the canonical union so exhaustiveness checks stay live. (#257)
- **Type external API responses to the API's real schema** — mark genuinely-nullable fields `| null`, unconsumed/optional fields `?`; don't over-require `string`. (#274)
- **An inline config default MUST match the `package.json` manifest default.** A resolver fallback `['specs']` diverging from manifest `['specs', '.specify/specs']` reintroduces bugs on bare/early reads. Grep for the literal when you change a manifest default. (#277)
- **A settings migration rewrites ONLY known legacy values + coerces at read.** Migrate per-scope via `inspect()` + same-target `update()`; leave unknown strings for VS Code to flag; funnel every reader through one coercion helper (`Boolean("off") === true` is the trap). (#259)
- **When you RENAME a setting key, the readers must fall back to the legacy key — the migration alone is not enough.** The migration is best-effort (try/catch at activation); if it throws or hasn't run, the new key is unset (schema default) while the user's opt-in still lives on the old key, silently dropping it. Route every reader (incl. telemetry/snapshot reads) through one helper that prefers the new key when explicitly set, else coerces the legacy key(s). Grep the old key name — every live read must be the helper, not `config.get(newKey)`. (#307)

## Deleting / broadening a component

- **Deleting a component drops every capability it owned — confirm the replacement covers the SAME cases, not a subset.** Removing `GeneratingFooter` dropped manual "mark complete" for all steps, but the surviving backstop only covers implement. Enumerate what it did; verify each capability is re-homed. (#277)
- **Trace a deleted component's FULL message/handler/state chain.** Follow `postMessage` → handler → state fields → disk probes and remove/​re-home the whole chain, not just the `.tsx`. (#277)
- **A menu `when` that newly matches a contextValue needs a handler that ACTS on it.** Broadening a row's contextValue can surface a menu whose command no-ops → a dead, misleading click. Re-check every `view/item/context` `when` it now matches. (#257)
- **When you gate/change a UI list, gate EVERY assembler that feeds it — the source you edited may not be the one that renders.** The Create-Spec workflow picker is built independently in `workflowManager.getWorkflows()` AND `specEditorProvider.getWorkflows()`; gating only the former left the picker always showing Companion. Grep for the displayed entry/option across all builders; reuse one predicate (`isCompanionSelectable()`) rather than gating one copy. (#302)
- **Scrubbing a term project-wide must include the current spec's own generated artifacts.** `specs/<NNN>/spec.md` and `checklists/requirements.md` are copies of the command template made *before* you edited it, so a global rename leaves them stale — run the scrub grep over `specs/<current>/` too, not just `src/`/`speckit-extension/`/`docs/`. (#311)

## Shell & release scripts

- **Never interpolate a workspace path into a shell string** (`cd "${root}"`) — set the terminal's structured `cwd` via `createTerminal({ cwd })`. Use `echo`, not a `#` comment, for terminal hints (interactive zsh has `INTERACTIVE_COMMENTS` off). (#234)
- **`A && B || C` is NOT if-then-else** — C also runs when B fails. Use `if A; then B; else C; fi` for "do C only when probe A fails." (#273)
- **Single-quote shell strings containing backticks** (release notes/descriptions) — double quotes command-substitute them. (#273)
- **An invariant that must hold on every run needs idempotent re-assertion, not set-once-at-create** (e.g. `--prerelease` re-applied via `release edit` after an upsert). (#273)
- **Swapping a convenience endpoint for a list endpoint drops what it did for free** — `/releases/latest` → `/releases` loses draft/prerelease filtering, pagination, and incidental headers (`User-Agent`); re-add each. (#274)

## Tests & PR hygiene

- **Green a stale test by re-deriving the fixture from the current contract — never weaken it to pass.** It must still fail on a real regression (verify by simulating one); append-only tests assert prior entries are byte-for-byte unchanged. Gate the suite in CI (no `|| true`). (#263)
- **When you broaden a change's scope mid-PR, update the spec/PR-description constraint in the SAME commit** — a diff that contradicts its own stated constraint is flagged immediately. (#273)
- **README/marketing images must not invent UI that misrepresents a concept** (e.g. showing a template profile as a model dropdown choice). (#234)
- **Version literals scattered across release docs drift — one source + placeholders** (`matches extension.yml` / `X.Y.Z`); only the published artifact carries the literal. (#273)
