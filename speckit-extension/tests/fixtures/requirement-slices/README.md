# Requirement-slicing fixtures

One spec fragment per parsing case, read by **both** suites — `speckit-extension/tests/test_resolve_spec_paths.py` (Python) and `src/features/specs/__tests__/livingSpecsModel.test.ts` (TypeScript).

The two parsers exist in two runtimes because neither can call the other: the viewer has no Python, the command bodies have no TypeScript. That makes divergence the real risk, not duplication. A fixture added here and read by only one suite fails the drift guard, so this directory is the contract.

`expected.json` carries the slices each fragment must produce. Both suites read it.
