---
id: classify-size
kind: control
command: specify
reads: [draft-spec]
---
5. **Classify the change — right-size the ceremony.** After the spec content is drafted, decide whether this change is small enough to fast-track straight to implement, or large enough to keep the full specify → plan → tasks → implement pipeline. Apply the shared size definition below — the same one the standalone size step uses, so the small/large bar is authored in exactly one place. This is a best-effort heuristic and **MUST err toward `normal`** on weak or conflicting signals — a change is never under-planned by accident.

<!-- speckit-companion:part sizing -->

<!-- /speckit-companion:part sizing -->

   Estimate `projectedFiles` and `projectedTasks` for the drafted requirements, and read a `scopeSignal` from the wording (`"larger"` for rewrite | overhaul | new system | migration | redesign | …; `"smaller"` for one-line | rename | typo | tweak | copy change | …; else `"none"`). Then map the size definition above to a verdict:

   ```
   crossedGuardrail = the change exceeds the **small** bar above (more files or tasks than it allows)

   verdict = "simple" if  the change is **small** by the definition above
                      and scopeSignal != "larger"
             else "normal"
   ```

   - **Guardrail warning.** When `crossedGuardrail == true` OR `scopeSignal == "larger"`, print this line verbatim, then run the **normal** branch (never a silent fast-track):

     ```
     [companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.
     ```

     Exactly-at-threshold (`projectedFiles == 5` / `projectedTasks == 10`) is the simple ceiling — it does **not** warn and stays eligible for `simple`.

