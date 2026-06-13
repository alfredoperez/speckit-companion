# Tasks

- [x] **T001** Wire the `companion-latest` stable-asset step into the release flow (force-update a prerelease `companion-latest` with `companion.zip`) + `.claude/commands/publish-speckit-ext.md`
- [x] **T002** [P] Document the stable-asset step in the publishing process + `speckit-extension/docs/publishing.md`
- [x] **T003** [P] Replace the two version-pinned install commands with the stable URL + add a `--force` update line + bump the version badge + `speckit-extension/README.md`
- [x] **T004** [P] Add the stable install/update command + `--force` update line to the install doc + `speckit-extension/docs/install.md`
- [x] **T005** [P] Bump `extension.version` 0.3.0 → 0.4.0 + `speckit-extension/extension.yml`
- [x] **T006** [P] Add a user-facing `0.4.0` CHANGELOG entry for the stable install/update URL + `speckit-extension/CHANGELOG.md`
- [x] **T007** Verify: `npm run compile && npm test` green + `python3 speckit-extension/scripts/check-shape-parity.py` passes + `bash -n` the publish-command shell snippets
