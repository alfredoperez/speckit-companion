import { buildModelEffortFlags } from '../claudeCodeProvider';

describe('buildModelEffortFlags — per-step Claude model/effort', () => {
    it('emits nothing when no options are given', () => {
        expect(buildModelEffortFlags()).toBe('');
        expect(buildModelEffortFlags({})).toBe('');
    });

    it('emits --model when a model is set', () => {
        expect(buildModelEffortFlags({ model: 'opus' })).toBe('--model opus ');
    });

    it('emits --effort when an effort is set', () => {
        expect(buildModelEffortFlags({ effort: 'high' })).toBe('--effort high ');
    });

    it('emits both, model first, with a single trailing space', () => {
        expect(buildModelEffortFlags({ model: 'sonnet', effort: 'low' })).toBe('--model sonnet --effort low ');
    });

    it('accepts full model ids with dots/dashes', () => {
        expect(buildModelEffortFlags({ model: 'claude-opus-4-8' })).toBe('--model claude-opus-4-8 ');
    });

    it('drops values that are not a single shell-safe token (injection guard)', () => {
        expect(buildModelEffortFlags({ model: 'opus; rm -rf /' })).toBe('');
        expect(buildModelEffortFlags({ model: '$(whoami)' })).toBe('');
        expect(buildModelEffortFlags({ effort: 'high && curl evil' })).toBe('');
    });

    it('keeps the valid flag when the other is unsafe', () => {
        expect(buildModelEffortFlags({ model: 'opus', effort: 'high; oops' })).toBe('--model opus ');
    });
});
