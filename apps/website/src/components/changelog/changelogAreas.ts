/**
 * The product areas the changelog groups entries by.
 *
 * A highlight names its area in its `<!-- area: …; pr: …; media: … -->` comment,
 * and a small entry can end with `<!-- area: … -->`. An entry with no area is
 * filed by the keyword map below and the build says so, so the map is a safety
 * net for older releases, not a substitute for tagging new ones.
 */

export interface Area {
  id: string;
  label: string;
}

export const AREAS: Area[] = [
  { id: 'spec-viewer', label: 'Spec viewer' },
  { id: 'overview', label: 'Overview' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'create-spec', label: 'Create spec' },
  { id: 'pipeline-builder', label: 'Pipeline Builder' },
  { id: 'pipeline', label: 'Companion pipeline' },
  { id: 'copilot-app', label: 'Copilot app' },
  { id: 'living-specs', label: 'Living specs' },
  { id: 'run-record', label: 'Run record' },
  { id: 'assistants', label: 'Assistants & terminals' },
  { id: 'install', label: 'Install & updates' },
  { id: 'docs', label: 'Docs' },
  { id: 'other', label: 'Other' },
];

const BY_ID = new Map(AREAS.map((area) => [area.id, area]));

export function isArea(id: string): boolean {
  return BY_ID.has(id);
}

export function areaLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

export function areaRank(id: string): number {
  return AREAS.findIndex((area) => area.id === id);
}

/** First match wins, so the narrow, unambiguous areas come first. */
const KEYWORDS: [string, RegExp][] = [
  ['copilot-app', /copilot (app|board|canvas)/],
  ['pipeline-builder', /pipeline builder|\bbuilder\b|\bnodes?\b|\bphases? (can|are)\b|\blanes?\b|\bthe board\b|companion\.yml|recipe|saved workflows/],
  ['living-specs', /living.spec|capabilit|requirement|adopt|\bdrift|fold(s|ed)? back|coverage/],
  ['overview', /\boverview\b|run log|dossier|what was checked|decisions/],
  ['create-spec', /create (new )?spec|new spec|workflow picker|create-spec/],
  ['sidebar', /sidebar|specs view|\btree\b|steering|right-click|context menu|toolbar/],
  ['run-record', /spec-context|run record|\btiming|captur|recorded|doctor|step time|phase time|elapsed/],
  ['install', /\binstall|upgrade|update check|new version|marketplace|activation|initiali[sz]e|package/],
  ['assistants', /terminal|shell|codex|claude|gemini|copilot|provider|assistant|wibey|cursor|windsurf|qwen|ide chat/],
  ['pipeline', /\bauto\b|implement|classif|preset|workflow|fast.path|specify|\bplan\b|\btasks\b|hook|command/],
  ['spec-viewer', /viewer|\btab\b|document|markdown|comment|refine|footer|badge|mermaid|diagram/],
  ['docs', /\bdocs?\b|readme|documentation|walkthrough/],
];

/** The area a keyword in the entry points at, or `other` when none does. */
export function areaFromKeywords(lead: string, body: string): string {
  for (const text of [lead.toLowerCase(), `${lead} ${body}`.toLowerCase()]) {
    for (const [id, pattern] of KEYWORDS) {
      if (pattern.test(text)) return id;
    }
  }
  return 'other';
}
