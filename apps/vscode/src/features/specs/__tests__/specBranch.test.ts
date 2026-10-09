import { resolveSpecBranch } from '../specBranch';

describe('the branch shown for a spec', () => {
    it('is the working branch when one is recorded', () => {
        expect(resolveSpecBranch({ workingBranch: 'feat/photos', branch: 'main' })).toBe('feat/photos');
    });

    it('falls back to the branch the spec was created on', () => {
        expect(resolveSpecBranch({ branch: 'main' })).toBe('main');
        expect(resolveSpecBranch({ workingBranch: null, branch: 'main' })).toBe('main');
    });

    it('skips a blank working branch and reads the next one', () => {
        expect(resolveSpecBranch({ workingBranch: '  ', branch: 'main' })).toBe('main');
        expect(resolveSpecBranch({ workingBranch: '', branch: ' main ' })).toBe('main');
    });

    it.each([undefined, null, {}, { branch: '' }, { branch: '   ' }, { branch: 42 }, { branch: ['main'] }, { workingBranch: {} }])(
        'is nothing for %p',
        ctx => {
            expect(resolveSpecBranch(ctx as never)).toBeUndefined();
        },
    );
});
