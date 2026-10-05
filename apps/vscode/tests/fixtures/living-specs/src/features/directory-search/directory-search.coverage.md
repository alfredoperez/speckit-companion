# Directory Search coverage

| Requirement | Test |
| --- | --- |
| A search matches name, role and team | `src/features/directory-search/search.test.ts` |
| Matching ignores case and accents | `src/features/directory-search/search.test.ts` |
| Exact name matches rank first | `src/features/directory-search/ranking.test.ts` |
| Deactivated members are left out by default | `src/features/directory-search/filters.test.ts` |
| Results never cross workspaces | `src/features/directory-search/filters.test.ts` |
| An empty query returns the searcher's team | `src/features/directory-search/search.test.ts` |
