/**
 * @jest-environment jsdom
 *
 * The Spec Kit presets installed here. What is pinned: each preset reads with
 * what it replaces, a clash says Companion may be bypassed, and every button
 * posts the message its handler needs.
 */
import { PresetsPanel } from '../PresetsPanel';
import type { SpecPreset } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

function preset(over: Partial<SpecPreset> = {}): SpecPreset {
    return {
        id: 'acme-style', name: 'Acme Style', version: '1.2.0', description: 'House style',
        source: 'catalog', enabled: true, priority: 10, clashes: [],
        items: [{
            type: 'template', name: 'spec-template', replaces: 'spec-template',
            strategy: 'replace', file: 'templates/spec-template.md',
        }],
        ...over,
    };
}

function panel(presets: SpecPreset[]) {
    const calls: Array<[string, string]> = [];
    const host = mount(
        <PresetsPanel presets={presets}
            onSearch={q => calls.push(['search', q])}
            onAdd={id => calls.push(['add', id])}
            onUpdate={id => calls.push(['update', id])}
            onRemove={id => calls.push(['remove', id])} />);
    return { host, calls };
}

const button = (host: HTMLElement, label: string) =>
    Array.from(host.querySelectorAll('button')).find(b => b.textContent === label)!;

describe('the Spec Kit presets panel', () => {
    it('says when nothing is installed', () => {
        const { host } = panel([]);
        expect(host.textContent).toContain('No Spec Kit presets installed here.');
    });

    it('reads a preset with its version, source, state and priority', () => {
        const { host } = panel([preset()]);
        const text = host.querySelector('.pb-spec-preset')!.textContent!;
        expect(text).toContain('Acme Style');
        expect(text).toContain('1.2.0');
        expect(text).toContain('catalog');
        expect(text).toContain('on');
        expect(text).toContain('priority 10');
    });

    it('falls back to the id and says off when disabled', () => {
        const { host } = panel([preset({ name: '', enabled: false })]);
        const text = host.querySelector('.pb-spec-preset')!.textContent!;
        expect(text).toContain('acme-style');
        expect(text).toContain('off');
    });

    it('lists what each item replaces and how', () => {
        const { host } = panel([preset()]);
        expect(host.querySelector('.pb-spec-preset-item')!.textContent)
            .toBe('template spec-template → replaces spec-template (replace)');
    });

    it('shows a problem line only when there is one', () => {
        expect(panel([preset()]).host.querySelector('.pb-spec-preset-problem')).toBeNull();
        const { host } = panel([preset({ problem: 'manifest is unreadable' })]);
        expect(host.querySelector('.pb-spec-preset-problem')!.textContent)
            .toContain('manifest is unreadable');
    });

    it('warns that a clash may bypass the Companion', () => {
        const { host } = panel([preset({ clashes: ['speckit.specify', 'spec-template'] })]);
        const warn = host.querySelector('.pb-spec-preset-clash')!.textContent!;
        expect(warn).toContain('speckit.specify');
        expect(warn).toContain('spec-template');
        expect(warn).toContain('Companion');
        expect(warn).toContain('bypassed');
        expect(panel([preset()]).host.querySelector('.pb-spec-preset-clash')).toBeNull();
    });

    it('posts update and remove with the preset id', () => {
        const { host, calls } = panel([preset()]);
        button(host, 'Update').click();
        button(host, 'Remove').click();
        expect(calls).toEqual([['update', 'acme-style'], ['remove', 'acme-style']]);
    });

    it('posts a search and an add by id, trimmed', async () => {
        const { host, calls } = panel([]);
        const [search, add] = Array.from(host.querySelectorAll('input'));
        search.value = ' style ';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        add.value = ' acme-style ';
        add.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        button(host, 'Search').click();
        button(host, 'Add').click();
        expect(calls).toEqual([['search', 'style'], ['add', 'acme-style']]);
    });

    it('submits on Enter and disables buttons while the input is invalid', async () => {
        const { host, calls } = panel([]);
        const [search, add] = Array.from(host.querySelectorAll('input'));
        const forms = Array.from(host.querySelectorAll('form'));
        expect(button(host, 'Search').disabled).toBe(true);
        expect(button(host, 'Add').disabled).toBe(true);
        add.value = 'Bad Id!';
        add.dispatchEvent(new Event('input', { bubbles: true }));
        search.value = 'ok query';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        expect(button(host, 'Add').disabled).toBe(true);
        expect(button(host, 'Search').disabled).toBe(false);
        forms[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(calls).toEqual([['search', 'ok query']]);
    });
});
