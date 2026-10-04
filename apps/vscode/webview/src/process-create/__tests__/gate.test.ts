import { canSend, hasTypedText, slugCaret, slugProblem, typingSlug, type CreateForm } from '../gate';
import { PROCESS_TEXT_LIMIT } from '../../../../src/protocol/processCreate';

const form = (over: Partial<CreateForm> = {}): CreateForm => ({
    kind: 'bug',
    text: 'Save does nothing',
    extra: '',
    slug: 'save-does-nothing',
    existingSlugs: [],
    ...over,
});

describe('the create screen send gate', () => {
    it('allows a filled form with a free slug', () => {
        expect(canSend(form(), false)).toBe(true);
    });

    it.each([
        ['the main field is empty', form({ text: '  \n' })],
        ['the slug is empty', form({ slug: '' })],
        ['the slug is taken', form({ existingSlugs: ['save-does-nothing'] })],
        ['the text is over the limit', form({ text: 'a'.repeat(PROCESS_TEXT_LIMIT + 1) })],
        ['the second field is over the limit', form({ extra: 'a'.repeat(PROCESS_TEXT_LIMIT + 1) })],
    ])('blocks sending when %s', (_name, blocked) => {
        expect(canSend(blocked, false)).toBe(false);
    });

    it('blocks sending while a send is in flight', () => {
        expect(canSend(form(), true)).toBe(false);
    });
});

describe('the slug message', () => {
    it('names the kind of item that already has the slug', () => {
        expect(slugProblem('bug', 'login-loop', ['login-loop'])).toBe('A bug named login-loop already exists.');
        expect(slugProblem('idea', 'login-loop', ['login-loop'])).toBe('An idea named login-loop already exists.');
    });

    it('says nothing for a free slug', () => {
        expect(slugProblem('bug', 'login-loop', ['other'])).toBeUndefined();
    });
});

describe('leaving the create screen', () => {
    it('has nothing to lose when both fields are blank', () => {
        expect(hasTypedText({ text: '  \n', extra: '' })).toBe(false);
    });

    it('has text to lose when either field holds some', () => {
        expect(hasTypedText({ text: 'Save does nothing', extra: '' })).toBe(true);
        expect(hasTypedText({ text: '', extra: 'a stack trace' })).toBe(true);
    });
});

describe('typing a slug', () => {
    it('keeps a trailing dash so the next word can follow', () => {
        expect(typingSlug('Login ')).toBe('login-');
        expect(typingSlug('login')).toBe('login');
        expect(typingSlug('  ')).toBe('');
    });

    it('keeps the caret where it was when the text before it does not change length', () => {
        expect(slugCaret('loGin-loop', 3)).toBe(3);
    });

    it('moves the caret back by the characters removed before it', () => {
        expect(slugCaret('login  !loop', 8)).toBe(6);
        expect(slugCaret('--login', 2)).toBe(0);
    });

    it('never puts the caret past the end of the slug', () => {
        const typed = 'a'.repeat(60);
        expect(slugCaret(typed, 60)).toBe(typingSlug(typed).length);
    });
});
