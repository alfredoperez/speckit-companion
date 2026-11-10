/** Entry point the renderer calls: research, data model, contracts and quickstart components. */

import { preprocessResearch } from './research';
import { preprocessDataModel } from './data';
import { preprocessContracts } from './dataContracts';
import { preprocessQuickstart } from './dataQuickstart';

export function preprocessLedgerArtifacts(markdown: string): string {
    return preprocessQuickstart(preprocessContracts(preprocessDataModel(preprocessResearch(markdown))));
}
