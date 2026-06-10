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

## Loop operations (guide `/fix-tickets` itself)

- **install-local is step 1 of every ticket** — install the previous ticket's merge before fixing, so each fix runs on the freshest build + turbo commands.
- **Restore `.specify/` along with `package.json`/`package-lock.json`** after install-local — `specify extension add` regenerates registry artifacts (`extensions.yml`, `.registry`, `feature.json`) that otherwise leave the tree dirty and trip the clean-tree guard.
- **Request Copilot via REST** `requested_reviewers` with login `copilot-pull-request-reviewer[bot]`. `gh pr edit --add-reviewer Copilot` fails ("Could not resolve user with login 'copilot'").
- **Copilot is fast** (~4–5 min) and earns its place — on #218 it caught two real correctness issues the local review had only flagged as "worth a glance."

## Architecture / skill flags (candidates to promote — not auto-applied)

- **Spec-editor webview paths lack unit coverage.** `getWorkflows()` reads live `vscode.workspace` config, so the collision/gating logic is review-only today. A vscode-config mock harness would let those branches get a regression guard. (#218)
