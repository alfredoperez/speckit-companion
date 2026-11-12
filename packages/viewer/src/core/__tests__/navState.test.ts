import { buildNavState } from '../navState';
import type { SpecDocument } from '../../contract/viewer';
import type { SpecContext } from '../../contract/specContext';

const core = (type: string): SpecDocument => ({ type, label: type, fileName: `${type}.md`, filePath: `/s/${type}.md`, exists: true, isCore: true, category: 'core' });
const documents: SpecDocument[] = [
    core('spec'), core('plan'), core('tasks'),
    { type: 'implement', label: 'Implement', fileName: '', filePath: '', exists: false, isCore: false, category: 'action' },
    { type: 'research', label: 'Research', fileName: 'research.md', filePath: '/s/research.md', exists: true, isCore: false, category: 'related', parentStep: 'plan' },
];
const record = {
    workflow: 'companion', specName: '001-star', branch: 'b', currentStep: 'implement', status: 'implementing',
    history: [
        { step: 'specify', kind: 'start', by: 'extension', at: '2026-11-01T10:00:00Z' },
        { step: 'specify', kind: 'complete', by: 'extension', at: '2026-11-01T10:05:00Z' },
        { step: 'implement', kind: 'start', by: 'extension', at: '2026-11-01T11:00:00Z' },
    ],
} as unknown as SpecContext;

describe('buildNavState', () => {
    it('puts action steps on the rail and hangs related documents apart', () => {
        const nav = buildNavState({ record, documents, currentDoc: 'spec' });
        expect(nav.coreDocs.map(d => d.type)).toEqual(['spec', 'plan', 'tasks', 'implement']);
        expect(nav.relatedDocs.map(d => d.type)).toEqual(['research']);
        expect(nav.isViewingRelatedDoc).toBe(false);
    });

    it('shows a running implement on the Tasks tab', () => {
        const nav = buildNavState({ record, documents, currentDoc: 'spec', live: true });
        expect(nav.activeStep).toBe('tasks');
        expect(nav.stepHistory?.spec?.completedAt).toBe('2026-11-01T10:05:00Z');
        expect(nav.live).toBe(true);
    });

    it('falls back to the first core document for an unknown currentDoc', () => {
        expect(buildNavState({ record, documents, currentDoc: 'nope' }).currentDoc).toBe('spec');
    });

    it('works without a record', () => {
        const nav = buildNavState({ record: null, documents, currentDoc: 'plan', specTitle: 'Star' });
        expect(nav.badgeText).toBeNull();
        expect(nav.specTitle).toBe('Star');
        expect(nav.currentDoc).toBe('plan');
    });
});
