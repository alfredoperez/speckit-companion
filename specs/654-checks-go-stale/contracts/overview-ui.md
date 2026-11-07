# Contract: Verified rows

- A run check with `commit` shows `at <commit>`.
- With `changedSince > 0`: the row is marked `OUT OF DATE` and reads `at <commit>, <n> files changed since` (`1 file changed since` for one); the section tone is a warning.
- `changedSince` 0 or undefined: no mark.
- Reported checks and checks without `commit`: unchanged.
