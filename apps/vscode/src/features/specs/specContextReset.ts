/**
 * Recovery for a malformed `.spec-context.json`: move the broken file aside to
 * a timestamped backup, then write a fresh minimal skeleton in its place.
 *
 * The move-aside is mandatory, not cosmetic: `writeSpecContext` refuses to
 * overwrite a present-but-unparseable file (the wipe guard), so the broken
 * bytes must leave the canonical path before the skeleton write — which also
 * preserves the original bytes for manual recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_CONTEXT_FILENAME } from './specContextReader';
import { backfillMinimalContext } from './specContextBackfill';
import { writeSpecContext } from './specContextWriter';

export interface ResetContextInput {
    workflow: string;
    specName: string;
    branch: string;
}

/**
 * Back up the broken `.spec-context.json` and write a fresh skeleton.
 * Returns the absolute path of the backup file.
 */
export async function resetMalformedContext(
    specDir: string,
    input: ResetContextInput,
    outputChannel?: { appendLine(value: string): void },
): Promise<string> {
    const target = path.join(specDir, SPEC_CONTEXT_FILENAME);
    const backupPath = pickBackupPath(specDir);

    await fs.promises.rename(target, backupPath);

    const skeleton = backfillMinimalContext({
        workflow: input.workflow,
        specName: input.specName,
        branch: input.branch,
    });
    await writeSpecContext(specDir, skeleton);

    outputChannel?.appendLine(
        `[SpecViewer] Reset malformed context — backed up to ${backupPath}`,
    );
    return backupPath;
}

/**
 * Choose a `.spec-context.json.bak-<timestamp>` name that does not collide with
 * an existing backup. Falls back to a numeric suffix when the timestamp clashes.
 */
function pickBackupPath(specDir: string): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(specDir, `${SPEC_CONTEXT_FILENAME}.bak-${stamp}`);
    if (!fs.existsSync(base)) return base;
    for (let i = 1; ; i++) {
        const candidate = `${base}-${i}`;
        if (!fs.existsSync(candidate)) return candidate;
    }
}
