import * as fs from 'fs';
import * as path from 'path';
import { CACHE_ROOT, ensureCacheFolder } from '../../core/companionCache';

const ANSWERS_FOLDER = 'report-answers';

export interface ReportAnswer {
    kind: 'bug' | 'idea';
    slug: string;
    document: string;
    question: string;
    answer: string;
}

/** Append one answered question to the item's staged answers file. Returns its workspace-relative path. */
export function stageReportAnswer(root: string, { kind, slug, document, question, answer }: ReportAnswer): string {
    const fileName = `${kind}-${slug}-${document}.md`;
    const folder = ensureCacheFolder(root, ANSWERS_FOLDER);
    fs.appendFileSync(path.join(folder, fileName), `## Question\n${question}\n\n## Answer\n${answer}\n\n`, 'utf8');
    return `${CACHE_ROOT}/${ANSWERS_FOLDER}/${fileName}`;
}
