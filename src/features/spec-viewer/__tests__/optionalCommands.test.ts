import {
    OPTIONAL_SPECKIT_COMMANDS,
    optionalCommandButtonsForTab,
    isOptionalCommand,
} from '../optionalCommands';

describe('optionalCommands - optionalCommandButtonsForTab', () => {
    it('returns the Clarify button on the spec tab', () => {
        const buttons = optionalCommandButtonsForTab('spec', new Set());
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toMatchObject({ label: 'Clarify', command: 'speckit.clarify' });
        expect(buttons[0].tooltip).toBeTruthy();
    });

    it('returns the Checklist button on the plan tab', () => {
        const buttons = optionalCommandButtonsForTab('plan', new Set());
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toMatchObject({ label: 'Checklist', command: 'speckit.checklist' });
    });

    it('returns the Analyze button on the tasks tab', () => {
        const buttons = optionalCommandButtonsForTab('tasks', new Set());
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toMatchObject({ label: 'Analyze', command: 'speckit.analyze' });
    });

    it('returns no buttons on an unrelated tab', () => {
        expect(optionalCommandButtonsForTab('all', new Set())).toEqual([]);
    });

    it('skips a command already present in the seen set', () => {
        const seen = new Set<string>(['speckit.clarify']);
        expect(optionalCommandButtonsForTab('spec', seen)).toEqual([]);
    });

    it('adds emitted commands to the seen set', () => {
        const seen = new Set<string>();
        optionalCommandButtonsForTab('plan', seen);
        expect(seen.has('speckit.checklist')).toBe(true);
    });
});

describe('optionalCommands - isOptionalCommand', () => {
    it('is true for each registered optional command', () => {
        for (const cmd of OPTIONAL_SPECKIT_COMMANDS) {
            expect(isOptionalCommand(cmd.command)).toBe(true);
        }
    });

    it('is false for non-optional commands', () => {
        expect(isOptionalCommand('speckit.specify')).toBe(false);
        expect(isOptionalCommand('/speckit.implement')).toBe(false);
        expect(isOptionalCommand('')).toBe(false);
    });
});
