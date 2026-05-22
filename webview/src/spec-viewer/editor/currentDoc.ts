import type { CoreDocumentType } from '../types';
import { navState } from '../signals';

/**
 * The core document currently being viewed, or null when viewing a related /
 * non-core doc (inline comments only apply to spec/plan/tasks).
 */
export function currentDoc(): CoreDocumentType | null {
    const d = navState.value?.currentDoc;
    return d === 'spec' || d === 'plan' || d === 'tasks' ? d : null;
}
