# Lessons Learned — retired, routed by shape

This file used to be a single append-only log of everything reviews caught. That made it a write-only graveyard: too long to scan, read only by `/fix-tickets` and `/ship-ticket`, so a rule that should fire during a normal `/code-review` or before any edit never did.

Lessons are now routed to where they actually fire:

- **Authoring conventions** (do/don't a writer should follow every turn) → **`CLAUDE.md`** — *Webview & rendering invariants*, *Code Comments*, *Design tokens*, *Release tag model*. Auto-loaded, so they're read before the bug is written.
- **Review checks** (codebase-specific recurring bug classes a reviewer scans for) → **`.claude/review-checklist.md`**. The review subagent reads it before every review.
- **Loop mechanics** (how `/fix-tickets` / `/ship-ticket` themselves should run) → baked into **`.claude/commands/fix-tickets.md`** and **`.claude/commands/ship-ticket.md`**.
- **Architecture / coverage gaps** → a tracked **GitHub issue**, or a `CLAUDE.md` / `docs/` section if it's a standing model.

The bar for adding anything new (in any of those homes): it must be **checkable**, **recurring or high-cost**, and **phrased as a rule/scan** — and you edit an existing line before adding a near-duplicate. If it can become a test or a hook, it should; prose rots, executable checks don't. One-off context goes nowhere.
