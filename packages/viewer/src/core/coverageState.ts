import type { ViewerCoverageRow } from './types';

export type CoverageState = 'missing' | 'weak' | 'tested' | 'assumed' | 'untraced';

/** Missing beats weak, weak beats tested, and tests win over an assumption, and a named test that is not on disk stays missing. */
export function coverageState(row: ViewerCoverageRow): CoverageState {
    if (row.missingTests?.length) return 'missing';
    if (row.weak) return 'weak';
    if (row.tests.length > 0) return 'tested';
    return row.assumes ? 'assumed' : 'untraced';
}

/** A requirement is accounted for when a test names it or it says what it relies on. */
export function isTraced(row: ViewerCoverageRow): boolean {
    return coverageState(row) !== 'untraced';
}
