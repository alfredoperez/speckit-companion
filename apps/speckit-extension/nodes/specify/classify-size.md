---
id: classify-size
name: Classify the change size
kind: control
command: specify
reads: [resolve-dir]
---
**Classify the change before drafting, to right-size the ceremony.** Decide now, from the request and **one bounded look at the code** (at most three reads or searches, enough to know what and where to change), whether this change can go straight to implement or needs the full specify → plan → tasks → implement pipeline. Deciding first means a small change never pays for documents it does not need. This is a best-effort heuristic and **MUST err toward `normal`** only where it matters: when a high-risk item might apply, or the outcome or where to change it is still unclear after the bounded look. Being cautious about an understood, contained change is not a reason to call it normal.

<!-- speckit-companion:part sizing -->

<!-- /speckit-companion:part sizing -->

   Record your estimates as you go: `projectedFiles` and `projectedTasks`, and a `scopeSignal` from the wording (`"larger"` for rewrite | overhaul | new system | migration | redesign | …; `"smaller"` for one-line | rename | typo | tweak | copy change | …; else `"none"`). They are context for a later reader, not the rule. Then:

   ```
   verdict = "simple"    if  the change is **small** by all three tests above
                         and scopeSignal != "larger"
             "oversized" if  the oversized bar above holds
             else "normal"
   ```

   When the verdict is not `simple` because a high-risk item applies, print this line verbatim, naming the item, then run the branch the verdict names:

   ```
   [companion] Change touches <the high-risk item> — running the full pipeline as <normal|oversized>.
   ```
