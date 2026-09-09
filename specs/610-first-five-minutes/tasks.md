# Tasks: Finish the first five minutes

- [x] **T001** Add a global-storage key for the published spec-kit extension version + src/core/constants.ts
- [x] **T002** Filter what the published-version setter accepts, and expose what it holds + src/speckit/companionVersionGap.ts
- [x] **T003** Persist the accepted version when a check learns one, and seed from storage at construction + src/speckit/updateChecker.ts
- [x] **T004** [P] Cover the setter's filtering and the bundled-versus-published comparison + src/speckit/companionVersionGap.test.ts
- [x] **T005** [P] Cover the storage round trip, the seed, and a stored value that is not a version + src/speckit/updateChecker.test.ts
- [x] **T006** Drop the leading slash from the nineteen prose command names + speckit-extension/nodes/, speckit-extension/presets/_parts/self-advance.md
- [x] **T007** Rebuild the commands and goldens and run the extension gates + speckit-extension/commands/, speckit-extension/tests/golden/commands/
- [x] **T008** Correct the docs claim that the check never needs the network, and write both changelogs + docs/getting-started.md, CHANGELOG.md, speckit-extension/CHANGELOG.md
