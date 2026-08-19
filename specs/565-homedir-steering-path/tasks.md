# Tasks: Consistent home-directory resolution for global steering files

**Spec**: [spec.md](./spec.md) · **Approach**: [spec.md#approach](./spec.md#approach)

- [x] **T001** Import the Node operating-system module in the steering manager + src/features/steering/steeringManager.ts
- [x] **T002** Resolve the global steering directory from the operating system's home directory instead of the environment variable + src/features/steering/steeringManager.ts
- [x] **T003** [P] Add test coverage proving the created file path is rooted at the operating system's home directory when the environment variable is unset or empty + src/features/steering/__tests__/steeringManager.test.ts
- [x] **T004** [P] Add a changelog entry under Unreleased for the fix + CHANGELOG.md
- [x] **T005** Verify the full test suite and TypeScript compilation pass with no regressions + (verification)
