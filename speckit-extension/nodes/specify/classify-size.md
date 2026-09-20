---
id: classify-size
name: Classify the change size
kind: control
command: specify
reads: [draft-spec]
---
5. **Classify the change, to right-size the ceremony.** After the spec content is drafted, decide whether this change is small enough to fast-track straight to implement, or large enough to keep the full specify → plan → tasks → implement pipeline. Apply the shared size definition below. This is a best-effort heuristic and **MUST err toward `normal`** on weak or conflicting signals.

<!-- speckit-companion:part sizing -->

<!-- /speckit-companion:part sizing -->

   Estimate `filesToUnderstand` — how many files you would have to *read* to be confident about this change, not how many it will write — and read a `scopeSignal` from the wording (`"larger"` for rewrite | overhaul | new system | migration | redesign | …; `"smaller"` for one-line | rename | typo | tweak | copy change | …; else `"none"`). Then map the size definition above to a verdict:

   ```
   crossedGuardrail = filesToUnderstand > 3, or reading one file is what tells
                      you what to write in another

   verdict = "simple"    if  filesToUnderstand <= 3 or the change is one
                             mechanical edit you already understand,
                         and scopeSignal != "larger"
             "oversized" if  understanding spans several subsystems that do not
                             share a vocabulary, so no one reading settles it
             else "normal"
   ```

   - **Guardrail warning.** When `crossedGuardrail == true` OR `scopeSignal == "larger"`, print this line verbatim, then run the **normal** branch (never a silent fast-track):

     ```
     [companion] Understanding this change needs more than three files — running the full pipeline as <normal|oversized>.
     ```

     Exactly three files to understand is the simple ceiling: it does **not** warn and stays eligible for `simple`.
