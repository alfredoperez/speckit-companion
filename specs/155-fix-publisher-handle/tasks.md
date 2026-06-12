# Tasks

- [x] **T001** Derive current extension id from `context.extension.id` in `getCurrentVersion()` + src/speckit/updateChecker.ts
- [x] **T002** Replace `/releases/latest` with `/releases`, filter to `^v\d+\.\d+\.\d+$` tags (ignore `speckit-ext-v*`), pick newest + src/speckit/updateChecker.ts
- [x] **T003** [P] Replace `alfredo-dev` → `alfredoperez` in install/listing references + .github/workflows/release.yml
- [x] **T004** [P] Replace `alfredo-dev` → `alfredoperez` in proposed-api arg + .vscode/launch.json
- [x] **T005** [P] Replace `alfredo-dev` → `alfredoperez` in Marketplace links + install command + speckit-extension/README.md
- [x] **T006** Add user-facing changelog entry + CHANGELOG.md
- [x] **T007** Sweep repo for residual `alfredo-dev` (excluding dist/node_modules/.git); compile + test
