# Feature spec file contract

## Verbatim Constraints

- `spec.md`

## Interface

New feature folders hold `spec.md`.

Readers accept `spec.md` or a legacy `<name>.spec.md`: `spec_context.feature_spec_path`, `featureSpecPath.ts` and `spec-rules.mjs`.

The manifest's `writes: spec.md` is satisfied by either name.

Stock `check-prerequisites.sh --require-spec` passes on a new folder.
