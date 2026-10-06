/**
 * What kind of project the Workflow Builder opened on.
 *
 * The board used to assume Companion: with the spec-kit extension missing it
 * fell back to the scripts and nodes bundled in the VSIX, drew the pipeline as
 * Companion ships it, and would have written `.specify/companion.yml` into a
 * project with nothing to read it. The kind is what the panel decides from.
 */

import * as fs from 'fs';
import * as path from 'path';

export type ProjectKind = 'companion' | 'stock' | 'none';

/** Where stock Spec Kit keeps everything, and the one directory Companion adds. */
const SPECIFY_REL = '.specify';
const COMPANION_REL = path.join('.specify', 'extensions', 'companion');

export function projectKind(workspaceRoot: string): ProjectKind {
    if (fs.existsSync(path.join(workspaceRoot, COMPANION_REL))) { return 'companion'; }
    if (fs.existsSync(path.join(workspaceRoot, SPECIFY_REL))) { return 'stock'; }
    return 'none';
}
