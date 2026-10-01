# Tasks: A diagram of the specs workflow, for the site

- [x] **T001** Build the diagram component: living-spec loop, five steps, implement fan-out, optional converge, active-time note, stacked under 640px + apps/website/src/components/docs/WorkflowDiagram.astro
- [x] **T002** Embed the diagram on the Introduction under a "One run, start to finish" section + apps/website/src/content/docs/docs/index.mdx
- [x] **T003** Embed the diagram on Living specs above "How a run folds back" + apps/website/src/content/docs/docs/discussions/living-specs.mdx
- [x] **T004** [P] Link the diagram from "The two that ship" + apps/website/src/content/docs/docs/discussions/pick-a-pipeline.mdx
- [x] **T005** Build the site and screenshot the Introduction at 1280px and 390px; confirm no horizontal overflow + apps/website
- [x] **T006** Check every diagram label against the named living specs, then run clips:check and living_validate + apps/website/src/components/docs/WorkflowDiagram.astro
