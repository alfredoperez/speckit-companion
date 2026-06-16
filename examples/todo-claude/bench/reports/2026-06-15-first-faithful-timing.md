# First Faithful Timing — Stock vs Companion

**2026-06-15 · medium + hard · 2-mode faithful bench**

This is the first run on the rebuilt **faithful** bench — two modes only (plain upstream spec-kit vs the single SpecKit Companion pipeline), each dispatched the same way the editor does, so a per-step delta is attributable to the workflow rather than harness drift. It's our first trustworthy timing of stock against companion.

## Read this first — what the numbers are (and aren't)

These are a **relative** comparison, not an absolute stopwatch. Agents build faster than a human clicking through the GUI, so the minutes here won't match "how long it feels in my editor." What you *can* trust is the gap between the two columns — they ran the identical feature, identical dispatch preamble, identical settle-wait — and the capture-fidelity column. Timing is "active span" from the lifecycle history (stock writes it via the dispatch preamble; companion via hooks too), not wall-clock.

Each cell is **n = 1** for now. Treat the headlines as signal, not yet as settled fact — see *Caveats*.

## The one-paragraph takeaway

On a **small** feature the Companion pipeline right-sized it and skipped the heavy planning — roughly **half the time, a fifth of the ceremony, same working result, and a higher quality score**. On a **large** feature both ran the full pipeline; Companion was still leaner and a bit faster, but its speed came with a cost: it shipped a real edge-case bug that the happy-path test couldn't see and that stock's heavier ceremony happened to avoid. Less ceremony buys speed and usually holds quality — but on a complex change it can drop an edge case.

---

## Medium — "Due dates" (a small change → Companion fast-pathed it)

Companion classified the change as small and abbreviated plan/tasks; stock ran the full pipeline.

| Metric | stock | companion |
|---|---|---|
| Active time | **17m 17s** | **9m 9s** |
| · specify / plan / tasks / implement | 1m37 / 4m6 / 2m13 / 7m43 | 2m41 / **0s** / **4s** / 6m24 |
| Build | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 |
| Regression | 23/23 | 12/12 |
| Quality (rubric) | 4.8 / 5 | **5.0 / 5** |
| Out-of-scope files | 1 | 0 |
| Task count | 19 | **7** |
| Artifact lines (spec+plan+tasks+side files) | 646 | **89** |
| Capture eval | n/a (blind) | **18 ✓ / 0 ✗** |
| **Overall health** | 74 | **100** (▲ +26) |

**Reviewer:** stock ranked #1 on pure craft (date logic factored into a tested `lib/dueDate.ts` with an injectable clock and an explicit stable sort); companion #2 (correct and complete, but inlined the comparator and leaned on engine sort-stability). Both avoided the UTC off-by-one trap. Net: companion delivered the same passing feature with a higher rubric score in ~half the time, while stock wrote the more rigorous code (and dinged its own scope with an out-of-scope `SortToggle.tsx`).

## Hard — "Tags" (a large change → both ran the full pipeline)

Tags clears the small bar, so Companion did **not** fast-path — it planned and tasked properly.

| Metric | stock | companion |
|---|---|---|
| Active time | 15m 24s | **12m 46s** |
| · specify / plan / tasks / implement | 1m41 / 3m49 / 1m54 / 5m23 | 1m48 / 1m28 / 1m11 / 6m6 |
| Build | ✓ | ✓ |
| Acceptance | 1/1 | 1/1 |
| Regression | 23/23 | 16/16 |
| Quality (rubric) | **5.0 / 5** | 4.7 / 5 |
| Out-of-scope files | 0 | 0 |
| Task count | 21 | 13 |
| Artifact lines | 624 | **184** |
| Capture eval | n/a (blind) | **15 ✓ / 0 ✗** |
| **Overall health** | 75 | **98** (▲ +23) |

**Reviewer:** stock ranked #1. Companion's model was cleaner (`{id, name}` tags, richer unit tests) but it carried a **real bug the deterministic harness can't catch**: removing the tag you're currently filtering by empties the list with no auto-revert to "All" — a dead filter with no visible recovery. Stock handled exactly that case (a `useEffect` that resets to "All" when the active tag disappears, plus a test for it). So Companion's 98 is a touch generous: there's a latent correctness gap the id-based acceptance oracle never exercised.

---

## Update — 2026-06-16: the Tags edge case reproduced (n = 2)

A second, independent build of Hard, this one agent-driven rather than hand-run in the GUI, hit the **same** stale-filter bug. Companion's `TodosPage` again never re-checks the active filter against the live tag list, so removing the filtered tag leaves a dead empty filter; stock's version self-heals again. Two for two. Two details worth keeping:

- **The happy-path oracle passed the buggy build 1/1 again** — it genuinely can't see this class of bug.
- **Both isolated rubric judges scored companion 5/5/5 and missed it** — only the adversarial *comparative* reviewer caught it, in both runs.

(Timing from the agent-driven run is not comparable to the GUI numbers above, so it isn't recorded here; only the reproduction conclusion is.) Two independent hits is enough to treat the gap as real and act on it.

## What this tells us

- **Fast-path-as-default earns its keep on small work** — the medium result is a clean win on every axis that matters to a user.
- **On large work the trade is real but narrow** — Companion stays faster and far leaner, but the ceremony it skips is sometimes the ceremony that catches a seam (teardown / removal / "what points at this when it's gone?"). The fix isn't more planning everywhere; it's a cheap, targeted backstop.
- **Lifecycle capture is solid** — 18 ✓ and 15 ✓ with zero misses across both runs.

## Caveats (don't over-read this yet)

1. **Small n.** Still only a couple of runs per cell, so the magnitudes (times, scores) aren't settled and need ~3 to 5 runs with variance reported. The Tags edge-case bug specifically has now reproduced across two independent runs (see the update above), so that gap reads as systematic rather than a fluke.
2. **The acceptance oracle is shallow.** It's id-based happy-path and **passed a buggy solution** — it never ran the remove-while-filtered sequence. The oracle needs teardown/edge sequences before it can fail a solution that drops them.
3. **Timing is active-span, not wall-clock**, and is a relative comparator only.

## Next

- Add a lightweight **`verify` step** to the Companion pipeline (an `after: implement` hook / recipe node, using the composable hooks shipped in #317) that re-reads the spec and checks each entity's removal/empty/teardown path — exactly the class of bug that slipped through here, without re-bloating the base pipeline.
- **Deepen the acceptance oracle** with edge sequences (remove-while-filtered, empty states) so the harness can prove the backstop works.
- Re-run **n ≥ 3** per cell and report variance.

*Data: `bench/REPORT.md` (latest), `bench/stats.jsonl` / `history.jsonl` (trend), `bench/reviews/medium.md` + `bench/reviews/hard.md` (comparative reviews).*
