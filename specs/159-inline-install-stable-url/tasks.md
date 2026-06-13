# Tasks — Inline Install URL → stable rolling asset

- [x] **T001** Point `RELEASE_URL` at the stable `companion-latest/companion.zip` asset and rewrite its doc comment (drop the v0.3.0 framing) + `src/speckit/specKitExtensionInstall.ts`
- [x] **T002** Add a regression test asserting `RELEASE_URL` is the stable asset and carries no version string (`/speckit-ext-v\d/`, `/companion-\d/`) + `src/speckit/specKitExtensionInstall.test.ts`
- [x] **T003** [P] Add a pre-tag verification step that no version-pinned install download URL remains in shipped code/docs + `speckit-extension/docs/publishing.md`
- [x] **T004** [P] Add a root CHANGELOG entry: in-editor Install/Update now pulls the newest spec-kit extension instead of a pinned older version + `CHANGELOG.md`
