# Spec-shape fixtures

One example spec per case the shape check has to get right, plus `expected.json` naming the findings each must produce.

Both runtimes read this directory: `speckit-extension/tests/test_living_validate.py` and `src/features/specs/__tests__/specShapeCheck.test.ts`. Neither can call the other, so the fixtures are what stops them from drifting apart.

`expected.json` is a manifest, not a convenience. A guard asserts it names every `.md` file on disk, and each suite iterates the manifest rather than a hand-written list, so an example only one runtime reads fails the build.
