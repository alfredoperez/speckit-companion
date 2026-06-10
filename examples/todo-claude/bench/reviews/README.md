# Comparative reviews

One file per size (`easy.md` / `medium.md` / `hard.md`), written by the **comparative reviewer** step of `/bench-capture`.

Unlike the per-folder rubric judges (which score each solution in isolation), the reviewer sees all five solutions at once and produces a cross-solution comparison: a ranking, head-to-head differences, and suspected bugs/risks the deterministic harness can't catch. This is the qualitative substitute for hand-written tests of the implementation.

Each capture **prepends** a dated `## <YYYY-MM-DD> — <size>` section (newest on top), so these files accumulate across runs and are committed history — diff them over time to see whether the solutions are getting better or worse.
