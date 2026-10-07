/**
 * @jest-environment jsdom
 */
import { Header } from '../Header';
import { LivingSpecsPanel } from '../LivingSpecsPanel';
import type { LivingSpecsLayout } from '../../../../src/protocol/pipeline';
import { graph, livingSpecs, mount } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const noop = () => undefined;
const HEADER_ACTIONS = {
    onBuild: noop, onPreview: noop, onOpenConfig: noop,
    onSelectWorkflow: noop, onNewWorkflow: noop,
};

describe('the header says whether living specs run', () => {
    function chip(over: Parameters<typeof livingSpecs>[0], carried = true) {
        const opened: number[] = [];
        const host = mount(
            <Header graph={graph(carried ? { livingSpecs: livingSpecs(over) } : {})}
                buildState="current" busy={false} {...HEADER_ACTIONS}
                onOpenLivingSpecs={() => opened.push(1)} />,
        );
        const found = Array.from(host.querySelectorAll<HTMLButtonElement>('.builder-chip'))
            .find(el => (el.textContent ?? '').includes('Living specs'));
        return { found, opened };
    }

    it('counts the capabilities when they run', () => {
        const { found } = chip({
            enabled: true, origin: 'registry', path: 'living-specs.yml',
            capabilities: [
                { name: 'auth', match: ['src/auth/**'], exclude: [], spec: 'a', retire: false },
                { name: 'billing', match: ['src/billing/**'], exclude: [], spec: 'b', retire: false },
            ],
        });
        expect(found?.textContent).toContain('2 capabilities');
    });

    it('says capability once when there is one of them', () => {
        const { found } = chip({
            enabled: true,
            capabilities: [
                { name: 'auth', match: [], exclude: [], spec: 'a', retire: false },
            ],
        });
        expect(found?.textContent).toContain('1 capability');
        expect(found?.textContent).not.toContain('capabilitys');
    });

    it('says so when they are off rather than drawing the same board either way', () => {
        const { found } = chip({ enabled: false });
        expect(found?.textContent).toContain('Living specs off');
    });

    it('opens the settings', () => {
        const { found, opened } = chip({ enabled: true });
        found?.click();
        expect(opened).toHaveLength(1);
    });

    // The emitter is the installed spec-kit extension, versioned separately:
    // an older install sends a graph with no living-specs block at all.
    it('says nothing when the graph carries no living specs', () => {
        const { found } = chip({}, false);
        expect(found).toBeUndefined();
    });
});

describe('the living-specs pane', () => {
    function open(over: Parameters<typeof livingSpecs>[0] = {}) {
        const set: Array<{ enabled?: boolean; layout?: LivingSpecsLayout }> = [];
        const host = mount(
            <LivingSpecsPanel living={livingSpecs(over)} onCancel={noop}
                onSet={change => set.push(change)} />,
        );
        return { host, set };
    }

    it('says which file the settings are read from', () => {
        const { host } = open({ origin: 'registry', path: 'living-specs.yml' });
        expect(host.querySelector('.pb-side-where')?.textContent)
            .toContain('living-specs.yml');
    });

    it('names the old block when that is what answered', () => {
        const { host } = open({ origin: 'legacy', path: '.specify/companion.yml' });
        const where = host.querySelector('.pb-side-where')?.textContent ?? '';
        expect(where).toContain('livingSpecs');
        expect(where).toContain('.specify/companion.yml');
    });

    it('says where turning it on would write when nothing is adopted', () => {
        const { host } = open({ origin: 'none' });
        expect(host.querySelector('.pb-side-where')?.textContent)
            .toContain('living-specs.yml');
    });

    it('turns them on', () => {
        const { host, set } = open({ enabled: false });
        host.querySelector<HTMLInputElement>('.pb-living-toggle input')?.click();
        expect(set).toEqual([{ enabled: true }]);
    });

    it('says that turning them off deletes nothing', () => {
        const { host } = open({ enabled: false });
        expect(host.textContent).toContain('nothing is deleted');
    });

    it('picks where the specs live', () => {
        const { host, set } = open({ layout: 'central' });
        const colocated = Array.from(
            host.querySelectorAll<HTMLInputElement>('input[name=living-layout]'))
            .find(el => el.value === 'colocated');
        colocated?.click();
        expect(set).toEqual([{ layout: 'colocated' }]);
    });

    it('shows which layout is in force', () => {
        const { host } = open({ layout: 'colocated' });
        const on = Array.from(
            host.querySelectorAll<HTMLInputElement>('input[name=living-layout]'))
            .filter(el => el.checked).map(el => el.value);
        expect(on).toEqual(['colocated']);
    });

    // Adoption and the capability commands own the registry. A second writer
    // for it is how two tools come to disagree about what a project adopted.
    it('lists the capabilities and offers no way to edit one', () => {
        const { host } = open({
            enabled: true, origin: 'registry', path: 'living-specs.yml',
            capabilities: [{
                name: 'auth', match: ['src/auth/**'], exclude: ['src/auth/legacy/**'],
                spec: 'capabilities/auth/auth.spec.md', retire: false,
            }],
        });
        const cap = host.querySelector('.pb-living-cap');
        expect(cap?.textContent).toContain('auth');
        expect(cap?.textContent).toContain('capabilities/auth/auth.spec.md');
        expect(cap?.textContent).toContain('src/auth/**');
        expect(cap?.textContent).toContain('not src/auth/legacy/**');
        expect(cap?.querySelector('input')).toBeNull();
        expect(host.textContent).toContain('not here');
    });

    it('points at adoption when there are none', () => {
        const { host } = open();
        expect(host.textContent).toContain('living-adopt');
    });

    it('marks a capability retired on purpose', () => {
        const { host } = open({
            capabilities: [{
                name: 'legacy-cart', match: [], exclude: [], spec: '', retire: true,
            }],
        });
        expect(host.querySelector('.pb-living-tag')?.textContent).toBe('retired');
    });

    it('shows the exempt globs and the authored rules without editing either', () => {
        const { host } = open({
            exempt: ['**/*.test.*'],
            rules: { spec: ['Say what the user sees.'], plan: [] },
        });
        expect(host.textContent).toContain('**/*.test.*');
        expect(host.textContent).toContain('Say what the user sees.');
        expect(host.textContent).toContain('Edit it in the file.');
    });

    it('carries a warning the resolver raised', () => {
        const { host } = open({
            warnings: ['.specify/companion.yml still has a livingSpecs block'],
        });
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('still has a livingSpecs block');
    });
});
