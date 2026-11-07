import type { ViewerCoverageRow } from './types';

export type CoverageState = 'missing' | 'tested' | 'assumed' | 'untraced';

/** Tests win over an assumption, and a named test that is not on disk stays missing. */
export function coverageState(row: ViewerCoverageRow): CoverageState {
    if (row.missingTests?.length) return 'missing';
    if (row.tests.length > 0) return 'tested';
    return row.assumes ? 'assumed' : 'untraced';
}

/** A requirement is accounted for when a test names it or it says what it relies on. */
export function isTraced(row: ViewerCoverageRow): boolean {
    return coverageState(row) !== 'untraced';
}
