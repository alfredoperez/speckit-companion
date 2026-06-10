# Lessons Learned — fed by `/fix-tickets`

Append-only, deduped lessons distilled from code-review + Copilot findings as the `/fix-tickets` loop runs.
**The fix and review subagents read this file before working**, so each ticket benefits from prior tickets' lessons — that's the compounding.

Rules for what goes here:
- Only **high-signal, reusable** lessons — a real bug class a reviewer caught, phrased as a do/don't. Not one-off style nits.
- Dedupe before appending. Tighten an existing line rather than adding a near-duplicate.
- Keep each lesson one or two lines, with the source ticket in parens.
- **Code conventions** guide the fix; **Loop operations** guide the skill; **Architecture / skill flags** are candidates to promote (to `CLAUDE.md`, an ADR, or a skill) — surfaced in the run report, not auto-applied.

---

## Code conventions (read before fixing)

- **Gate `/speckit.companion.*`-dependent UI on the extension dir** (`.specify/extensions/companion/`), not on preset presence — presets only swap the `speckit.*` command bodies and never register the namespaced command family. A preset-only project must read as "not installed." (#218)
- **Guard synthetic list entries against name collision.** When injecting a synthetic entry with a reserved name/value (workflow option, etc.), skip it and log a warning if a user-defined entry already uses that name — otherwise you get duplicate DOM `<option>`s and a last-write-wins `Map` clobber. (#218)
- **Persist only resolvable identifiers.** Don't write a synthetic UI-only name (e.g. `speckit-turbo`) into `.spec-context.json` where downstream code resolves it — persist the resolvable base (`speckit`) and carry the variant via a separate pin (`profile: turbo`). (#218)
- **Derive UI fields from the full discriminator, not field-presence.** When surfacing a value from an *optional* history/record field (e.g. an active task id on a spec row), gate it on the complete discriminator (step + finish/kind), not just `field != null` — an optional field may be written in other contexts and leak into the wrong rows. Keep a legacy `kind == null` fallback so older records still work. (#238)
- **Fast-path / simple-mode lands at `tasks` + `ready-to-implement`, NOT "at the implement step".** The fold sets `--step tasks --status ready-to-implement`; implement is the *next* user-triggered step. Keep docs/changelogs/command bodies worded to the fold — don't say a fast-tracked spec "lands at implement". (#237)
- **A follow-on manifest/map entry needs a distinct key.** Writing a second record keyed off the same id clobbers the first — on #208 a staged-images entry reused `tempFileSet.id` and overwrote the temp-set entry, nulling its path and leaking the original dir. Use a derived key (`<id>-staged-images`). Same family as the synthetic-name collision (#218). (#208)
- **Implement terminates at `implemented`, not `completed`.** `completed` is reserved for the user's final Mark-Completed action. When the pipeline finishes implement autonomously, the spec's terminal `status` is `implemented` (the `.spec-context.json` capture script intentionally refuses to write `completed` for exactly this reason). Don't force `completed`. (#208)

## Loop operations (guide `/fix-tickets` itself)

- **install-local is step 1 of every ticket** — install the previous ticket's merge before fixing, so each fix runs on the freshest build + turbo commands.
- **Restore `.specify/` along with `package.json`/`package-lock.json`** after install-local — `specify extension add` regenerates registry artifacts (`extensions.yml`, `.registry`, `feature.json`) that otherwise leave the tree dirty and trip the clean-tree guard.
- **Request Copilot via REST** `requested_reviewers` with login `copilot-pull-request-reviewer[bot]`. `gh pr edit --add-reviewer Copilot` fails ("Could not resolve user with login 'copilot'").
- **Copilot is fast** (~4–5 min) and earns its place — #218: caught two real correctness issues; #238: caught an optional-field leak; #237: caught doc wording the *local review itself had just written* ("lands at implement"). The review→Copilot two-layer pass keeps catching each other's misses — keep both. Poll at ~90s, not 30s (gentler, Copilot takes ~4 min anyway).
- **Dogfood `.spec-context.json` is a byproduct, not the feature.** A turbo-pipeline run records its own history into `specs/<NNN>/.spec-context.json`; it may carry backfilled/odd-ordered implement entries. Don't reorder it in-PR (that means fabricating timestamps/authorship) — the real implement-lifecycle ordering is tracked in #229/#244. But DO fix non-fabricated defects: a `[FEATURE NAME]` placeholder specName, or a wrong terminal `status` (see implement→`implemented` above), are corrections, not fabrication.
- **Wait ~5 min before the first Copilot poll.** Copilot reviews take ~4–5 min, so polling immediately just burns no-op checks. `sleep 300` first, then poll at 90s.
- **Fix subagents must not commit `.specify/` artifacts.** `git add -A` sweeps `.specify/feature.json` (the spec-session pointer regenerated by the pipeline, + registry files) into the feature commit. Commit only `src/`/`webview/`/`package.json` + the `specs/<NNN>/` folder; `git checkout origin/main -- .specify/<file>` for any `.specify/*` that shows modified. (#238)

## Architecture / skill flags (candidates to promote — not auto-applied)

- **turbo `specify` can leave the `[FEATURE NAME]` placeholder in `.spec-context.json` `specName`.** Seen on #208 — the seed metadata wasn't filled with the real spec name. Worth a fix in the specify command body / capture seed so the name is always populated. (#208)
- **Spec-editor webview paths lack unit coverage.** `getWorkflows()` reads live `vscode.workspace` config, so the collision/gating logic is review-only today. A vscode-config mock harness would let those branches get a regression guard. (#218)
