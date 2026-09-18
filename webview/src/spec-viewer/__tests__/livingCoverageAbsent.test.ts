/**
 * @jest-environment jsdom
 */
import { applyNavState, buildHandlers } from '../messageHandlers';
import { preprocessLivingRequirements, setLivingCoverage } from '../markdown';
import { navState } from '../signals';
import type { ExtensionToViewerMessage, LivingHeaderMeta, NavState } from '../types';

const meta = (specPath: string, extra: Partial<LivingHeaderMeta> = {}): LivingHeaderMeta =>
    ({ capabilityName: 'c', specPath, location: 'colocated', match: [], ...extra });

const nav = (specPath: string): NavState => ({
    coreDocs: [],
    relatedDocs: [],
    currentDoc: 'spec',
    workflowPhase: 'specify',
    taskCompletionPercent: 0,
    isViewingRelatedDoc: false,
    livingMode: true,
    livingMeta: meta(specPath),
}) as NavState;

const health = (specPath: string, extra: Partial<LivingHeaderMeta>) => ({
    type: 'livingHealthResolved',
    livingMeta: meta(specPath, extra),
}) as Extract<ExtensionToViewerMessage, { type: 'livingHealthResolved' }>;

const card = () => preprocessLivingRequirements('## Requirements\n\n### Adds a todo\n\nBody.');

describe('a capability without coverage shows no label', () => {
    const handlers = buildHandlers(() => undefined, () => undefined);

    beforeEach(() => {
        navState.value = null;
        setLivingCoverage(null);
        applyNavState(nav('a.spec.md'));
        handlers.livingHealthResolved(health('a.spec.md', { requirementCoverage: { 'Adds a todo': '2 tests' } }));
    });

    it('drops the labels when a later health message carries none', () => {
        handlers.livingHealthResolved(health('a.spec.md', { drifted: false }));
        expect(card()).not.toContain('living-req-coverage');
        expect(card()).not.toContain('data-req-coverage');
    });

    it('drops the labels when another capability opens and sends no health message', () => {
        applyNavState(nav('b.spec.md'));
        expect(card()).not.toContain('living-req-coverage');
    });

    it('keeps the labels when the same capability refreshes', () => {
        applyNavState(nav('a.spec.md'));
        expect(card()).toContain('2 tests');
    });
});
