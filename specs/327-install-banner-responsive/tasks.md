# Tasks

- [x] **T001** Make `.install-banner` a query container (`container-type: inline-size`) and add `flex-wrap: wrap` + `webview/styles/spec-viewer/_install-banner.css`
- [x] **T002** Add a `@container (max-width: 420px)` rule giving `.install-banner__actions` a full-width basis so it stacks below the text, keeping the side-by-side default above the threshold + `webview/styles/spec-viewer/_install-banner.css`
- [x] **T003** Apply the ellipsis trio (`white-space: nowrap` + `overflow: hidden` + `min-width: 0`) to `.install-banner__text strong`; leave the body span wrapping + `webview/styles/spec-viewer/_install-banner.css`
- [x] **T004** Add a `title` attribute carrying the full heading text to the banner `<strong>` for the truncation tooltip + `src/features/spec-editor/installBanner.ts`
- [x] **T005** Verify the banner at narrow, medium, and wide widths in both the Create-Spec and Activity panels + manual check
