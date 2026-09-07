## Least code — the smallest thing that actually works

Adapted from [Ponytail](https://github.com/DietrichGebert/ponytail), which measured 54% fewer lines, 22% fewer tokens and 27% less time across twelve feature tasks with safety held at 100%.

**Climb this ladder and stop at the first rung that holds.** Does it need to exist at all; is it already in this codebase; does the standard library do it; does the platform do it, a date input over a picker library, CSS over JavaScript, a constraint over application code; does a dependency the project already has; can it be one line; only then, the minimum code that works.

**Fix the cause, not the symptom.** A report names one caller and the fix usually belongs where they all pass through, which is both the smaller change and the only one that leaves no sibling broken.

**Delete rather than add, and boring rather than clever.** No interface with one implementation, no factory for one product, no configuration for a value that never changes, no scaffolding for a later that can scaffold itself.

**The same ladder governs what you write, not just what you build.** A spec, plan, research note, data model, contract or task list is only worth its length if a reader acts on it. Do not restate what another artifact in this feature already says, do not write a requirement for what a type or a test already enforces, and do not add a third acceptance scenario unless it covers a failure the first two miss. A section with nothing to say is removed, never filled with "N/A" — and the recorded size is the budget, so a `simple` change gets the tasks without the ceremony around them.

**Never simplify away** validation at a trust boundary, error handling that prevents data loss, security, accessibility, or anything the spec asks for. This shortens the solution, never the reading: understand the whole path before choosing a rung.

**Name a corner you cut on purpose** with `// simplified: <the ceiling>, <what to do when it binds>` in the code, and one matching `concerns` entry in this step's capture, so "later" has somewhere to be found.
