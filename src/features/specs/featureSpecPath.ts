/**
 * Where a feature's spec lives. Companion writes `<short-name>.spec.md`
 * (`specs/001-offline-queue/offline-queue.spec.md`); stock spec-kit and older
 * projects wrote `spec.md`. Every reader resolves through here so both names work.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { WorkflowStepConfig } from '../workflows/types';

export const STOCK_SPEC_FILE = 'spec.md';
const NAMED_SPEC_SUFFIX = '.spec.md';

/** True for either spelling of the feature spec's file name. */
export function isFeatureSpecFile(fileName: string): boolean {
    return fileName === STOCK_SPEC_FILE || fileName.endsWith(NAMED_SPEC_SUFFIX);
}

/** The feature spec's file name in `specDir`: the first `*.spec.md`, else `spec.md` (present or not). */
export function featureSpecName(specDir: string): string {
    try {
        const named = fs.readdirSync(specDir).filter(n => n.endsWith(NAMED_SPEC_SUFFIX)).sort();
        if (named.length > 0) {
            // The folder's own name wins over whatever sorts first, so a second
            // spec file beside it cannot become the feature's spec.
            const own = path.basename(specDir).replace(/^\d+-/, '') + NAMED_SPEC_SUFFIX;
            return named.includes(own) ? own : named[0];
        }
    } catch { /* unreadable dir reads as stock */ }
    return STOCK_SPEC_FILE;
}

export function featureSpecPath(specDir: string): string {
    return path.join(specDir, featureSpecName(specDir));
}

/** A step's output file, with the stock `spec.md` slot resolved to whichever spec name is on disk. */
export function resolveStepFile(specDir: string, step: WorkflowStepConfig): string {
    const file = step.file ?? `${step.name}.md`;
    return file === STOCK_SPEC_FILE ? featureSpecName(specDir) : file;
}
