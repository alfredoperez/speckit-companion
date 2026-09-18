import { readableName, stripSharedLeadingWords } from '../capabilityNames';

describe('readableName', () => {
    it('reads a dashed capability name as words', () => {
        expect(readableName('commands-living-load')).toBe('Commands Living Load');
        expect(readableName('companion_commands')).toBe('Companion Commands');
        expect(readableName('core')).toBe('Core');
    });
});

describe('stripSharedLeadingWords', () => {
    it('drops the words every sibling starts with', () => {
        const names = [
            'commands-assembly', 'commands-capture', 'commands-completion', 'commands-living',
            'commands-living-load', 'commands-living-markers', 'commands-nodes', 'commands-pipeline',
        ];
        expect(stripSharedLeadingWords(names.map(readableName))).toEqual([
            'Assembly', 'Capture', 'Completion', 'Living', 'Living Load', 'Living Markers', 'Nodes', 'Pipeline',
        ]);
    });

    it('leaves a single label alone', () => {
        expect(stripSharedLeadingWords(['Core'])).toEqual(['Core']);
    });

    it('never strips past the shortest label, so a prefix sibling stays readable', () => {
        expect(stripSharedLeadingWords(['Viewer State', 'Viewer State'])).toEqual(['State', 'State']);
        expect(stripSharedLeadingWords(['Viewer Ui', 'Viewer Ui Chrome'])).toEqual(['Ui', 'Ui Chrome']);
        expect(stripSharedLeadingWords(['Specs', 'Specs Living'])).toEqual(['Specs', 'Specs Living']);
    });

    it('leaves labels with nothing in common untouched', () => {
        expect(stripSharedLeadingWords(['Asset Discovery', 'Extension Settings'])).toEqual(['Asset Discovery', 'Extension Settings']);
    });
});
