/**
 * What the panel may do on a project that is not a Companion one.
 *
 * Default-deny, and a short allowlist: every other message the board can send
 * writes `companion.yml`, a node under `.specify/companion/`, or runs a build
 * that assembles Companion's command files. None of those mean anything on a
 * stock project, and writing them there leaves a file the project has nothing
 * to run. A message type added later is refused until it is named here, which
 * is the point.
 */

import { BuilderToExtensionMessage } from '../../protocol/pipeline';
import { ProjectKind } from './projectKind';

type MessageType = BuilderToExtensionMessage['type'];

const ALLOWED_ON_STOCK: ReadonlySet<MessageType> = new Set<MessageType>([
    'ready', 'dismissFirstRun',
    // The registry switch, which is stock Spec Kit's own.
    'setStockHook',
    // Reads: opening a file the board drew, and drawing another workflow.
    'openStockFile', 'selectStockWorkflow',
    // Dispatches a stock command this project registers. Its payload is a
    // closed set, so it cannot become "run this line for me".
    'runStockCommand',
]);

/** Why this message was not carried out, or null when it may be. */
export function stockRefusal(kind: ProjectKind, type: MessageType): string | null {
    // A folder with no `.specify` at all is neither kind, and keeps the
    // behaviour it had: there is no stock workflow there to draw or protect.
    if (kind !== 'stock') { return null; }
    if (ALLOWED_ON_STOCK.has(type)) { return null; }
    if (type === 'build' || type === 'preview') {
        return 'This project runs stock Spec Kit, so there is nothing to build here.';
    }
    return 'This project runs stock Spec Kit. The board changes what Spec Kit itself '
        + 'owns — its hooks, its templates, its constitution — and nothing that '
        + 'belongs to the Companion Spec Kit extension.';
}
