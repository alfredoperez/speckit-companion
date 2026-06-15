---
id: side-files
kind: author
command: plan
reads: [plan-doc]
---
4. **Side files — assess on demand.** Create each only when it genuinely helps a developer understand or build *this* change; when the information fits naturally in `plan.md`, keep it there instead of spawning a file. Judge per feature:
   - `research.md` — only for real unknowns or trade-offs worth recording on their own; otherwise fold a short "Decisions" note into `plan.md`.
   - `data-model.md` — only when the change introduces or reshapes entities a dev needs spelled out to implement it.
   - `contracts/` — only when it exposes an interface (API / CLI / schema / UI) a consumer codes against.
   - `quickstart.md` — only when there is a non-obvious setup or verification path a dev would otherwise miss.
   Default to folding into `plan.md`; create a side file only when its absence would slow understanding or implementation.

**Output**: `<feature_directory>/plan.md` (+ any side files that genuinely help: `research.md` / `data-model.md` / `contracts/` / `quickstart.md`).


