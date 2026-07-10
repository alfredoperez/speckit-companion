# gsd-superpowers sandbox

Tests **Eric Tech's mixed workflow** (GSD plans, Superpowers executes) running as a
custom workflow inside SpecKit Companion. Light version of the flow from his videos:
"GStack + GSD + Superpowers Workflow Is Insane!" (youtube.com/watch?v=BlTpG51x94w).

The app is speckit-companion's `todo-claude` example (React + vite + vitest),
so we only spend tokens on ONE small feature per phase, not a greenfield build.

## The flow (per phase)

1. `/gsd-discuss-phase` — clarify the phase
2. `/gsd-plan-phase` — GSD writes the phase plan into `.planning/`
3. Hand the plan to **Superpowers**: `writing-plans` → `subagent-driven-development`
   (TDD, fresh subagent per task). **Skip `/gsd-execute-phase` entirely** — Superpowers
   is the execution layer (per Eric's own guidance in the video comments).
4. `/gsd-verify-work` — GSD confirms the phase (and gaps) are actually closed.
   Gaps? `/gsd-plan-phase --gaps` → hand gap plans back to Superpowers → verify again.

What's deliberately left out of the light version: GStack persona voting and the
RalphLoop headless orchestrator (`claude -p` per pending phase). One phase,
end-to-end, in a live session — that's what we can test and record.

## Install (one-time, user-level — not vendored here)

- **GSD**: `npx @opengsd/gsd-core@latest` (successor of gsd-build/get-shit-done,
  which was archived June 2026)
- **Superpowers**: in Claude Code run `/plugin install superpowers@claude-plugins-official`

## Companion wiring

`.vscode/settings.json` registers the `gsd-superpowers` workflow:
Discuss → Plan Phase → Execute (Superpowers) → Verify, plus buttons for
`/gsd-new-project` (bootstrap) and `/gsd-plan-phase --gaps` (gap loop).
`speckit.specDirectories` points at `.planning` (and `.planning/phases/*`).

## Test drive

1. Install GSD + Superpowers (above), `npm install`, open this folder in VS Code.
2. Run `/gsd-map-codebase` once (brownfield), then **GSD New Project** with the
   feature prompt → `.planning/` appears.
3. Walk one phase: Discuss → Plan → Execute (Superpowers) → Verify.

## Things to verify on first run

- GSD writes flat per-phase files (`{phase}-PLAN.md` etc.) — check whether the
  sidebar picks them up as-is or whether `specDirectories` needs adjusting to
  however this GSD version lays out `.planning/`.
- Step completion is file-based; the actionOnly steps won't show file progress
  (expected). Tune `file:` fields after seeing real GSD output.
