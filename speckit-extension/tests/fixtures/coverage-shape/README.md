# Coverage-shape fixtures

The coverage block is written in Python (`upsert_coverage` in `speckit-extension/scripts/capture.py`) and read in TypeScript (`pickCoverage` in `src/features/spec-viewer/stateDerivation.ts`). Neither can call the other, so the two agreed on a list while the batch capture wrote a comma-separated line, and every requirement recorded that way rendered as "No test linked" with its names sitting in the file.

`written.json` is the block as it appears on disk: two requirements the writer produced, and one legacy entry carrying the line shape that specs written before the fix still hold. `expected-rows.json` is what the viewer must derive from it. Both suites read this pair — `speckit-extension/tests/test_capture_fields.py` and `src/features/spec-viewer/__tests__/stateDerivation.test.ts`.
