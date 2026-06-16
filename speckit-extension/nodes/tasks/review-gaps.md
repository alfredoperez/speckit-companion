---
id: review-gaps
kind: author
command: tasks
writes: tasks.md
reads: [tasks-doc]
---
5. **Adversarial gap review — attack the artifacts before implementing them.** With `tasks.md` written, take one pass whose only job is to find the destructive, lifecycle, and edge-case interactions that lean specs under-specify and ship broken. This is not a rewrite and not a generator of busywork — it is a skeptic reading `spec.md`, `plan.md`, and `tasks.md` together and asking "what real failure is unspecified or untasked here?"
   - **If you can spawn subagents, run this as a small panel — distinct lenses, concurrently — not one generalist.** Issue the reviewers in a single message (the parallel investigation in plan banked the time for exactly this), each attacking a different failure family, then merge their findings on the main agent: dedup overlaps, and keep only gaps tied to a concrete failure. Diversity catches what one reader misses; the merge + the skeptic rule below keep it from flooding false positives. A good split of lenses:
     - **Destructive cascades** — when an entity is deleted/removed, what dangling references, orphaned data, or stale UI is left behind, in *every* direction (not just the obvious one)?
     - **Active-state vs. mutation** — if the user is filtering/selecting/viewing something and the thing it depends on is removed or changes, what happens?
     - **Persistence & boundary** — what survives a reload that shouldn't (or doesn't that should), and the empty / zero / duplicate / whitespace / max cases.
   - On a host without subagents, do the same sweep inline as one careful pass over the same lenses.
   - For each candidate, decide honestly whether it is already covered by a specific `FR-…` **and** a task. A behavior asserted in prose (an Overview or Assumptions sentence) but with no requirement and no task is still a gap. **Only surface a gap you can tie to a concrete failure; if the spec already covers it, say nothing.** A thorough spec produces zero findings — that is a valid, expected result, not a reason to invent issues.
   - For every genuinely-uncovered gap that would ship a user-visible bug, **close it in `tasks.md`**: add the missing task(s) — to the right wave, or a final remediation wave — in the same wave format, each naming the exact file and the requirement it satisfies. Different-file remediation tasks may share a wave; keep the same-file/dependency rules.
   - Report a one-line verdict: implementation-ready, or how many high-severity gaps you closed.

**Output**: `tasks.md`, with any high-severity coverage gaps the review found added as tasks.


