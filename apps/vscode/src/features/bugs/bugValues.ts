export const BUG_VERDICTS = ['valid', 'likely valid, needs reproduction', 'invalid'] as const;
export const BUG_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const BUG_FIX_STATUSES = ['applied', 'partial', 'not-applied'] as const;
export const BUG_TEST_RESULTS = ['verified', 'partial', 'failed'] as const;
export const BUG_CHECK_RESULTS = ['pass', 'fail', 'not-run'] as const;

export type BugVerdict = typeof BUG_VERDICTS[number];
export type BugSeverity = typeof BUG_SEVERITIES[number];
export type BugFixStatus = typeof BUG_FIX_STATUSES[number];
export type BugTestResult = typeof BUG_TEST_RESULTS[number];
export type BugCheckResult = typeof BUG_CHECK_RESULTS[number];
