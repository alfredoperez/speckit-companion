import { resolveSpecKitAgent, PROVIDER_TO_AGENT } from './specKitAgent';
import { HostIde } from '../ai-providers/ideChatProvider';

const ANY_HOST: HostIde = 'vscode';
const ALL_HOSTS: HostIde[] = ['vscode', 'cursor', 'windsurf', 'antigravity', 'unknown'];

describe('resolveSpecKitAgent', () => {
    describe('direct non-Claude providers (US1)', () => {
        it('maps gemini → gemini', () => {
            expect(resolveSpecKitAgent('gemini', ANY_HOST)).toBe('gemini');
        });
        it('maps copilot → copilot', () => {
            expect(resolveSpecKitAgent('copilot', ANY_HOST)).toBe('copilot');
        });
        it('maps codex → codex', () => {
            expect(resolveSpecKitAgent('codex', ANY_HOST)).toBe('codex');
        });
        it('maps qwen → qwen', () => {
            expect(resolveSpecKitAgent('qwen', ANY_HOST)).toBe('qwen');
        });
        it('maps opencode → opencode', () => {
            expect(resolveSpecKitAgent('opencode', ANY_HOST)).toBe('opencode');
        });
        it('maps antigravity → agy', () => {
            expect(resolveSpecKitAgent('antigravity', ANY_HOST)).toBe('agy');
        });
    });

    describe('Claude providers (US2)', () => {
        it('maps claude → claude', () => {
            expect(resolveSpecKitAgent('claude', ANY_HOST)).toBe('claude');
        });
        it('maps claude-vscode → claude (US3)', () => {
            expect(resolveSpecKitAgent('claude-vscode', ANY_HOST)).toBe('claude');
        });
    });

    describe('ide-chat resolves by host (US3)', () => {
        it('vscode host → copilot', () => {
            expect(resolveSpecKitAgent('ide-chat', 'vscode')).toBe('copilot');
        });
        it('cursor host → cursor-agent', () => {
            expect(resolveSpecKitAgent('ide-chat', 'cursor')).toBe('cursor-agent');
        });
        it('windsurf host → windsurf', () => {
            expect(resolveSpecKitAgent('ide-chat', 'windsurf')).toBe('windsurf');
        });
        it('antigravity host → agy', () => {
            expect(resolveSpecKitAgent('ide-chat', 'antigravity')).toBe('agy');
        });
        it('unknown host → copilot', () => {
            expect(resolveSpecKitAgent('ide-chat', 'unknown')).toBe('copilot');
        });
    });

    describe('fallback for unrecognized / missing provider (US3)', () => {
        it('undefined → claude', () => {
            expect(resolveSpecKitAgent(undefined, ANY_HOST)).toBe('claude');
        });
        it('empty string → claude', () => {
            expect(resolveSpecKitAgent('', ANY_HOST)).toBe('claude');
        });
        it('unrecognized value → claude', () => {
            expect(resolveSpecKitAgent('totally-made-up-provider', ANY_HOST)).toBe('claude');
        });
        it('stale claude-code value → claude', () => {
            expect(resolveSpecKitAgent('claude-code', ANY_HOST)).toBe('claude');
        });
    });

    describe('never emits claude-code (US2 guard)', () => {
        const PROVIDERS: (string | undefined)[] = [
            ...Object.keys(PROVIDER_TO_AGENT),
            'ide-chat',
            '',
            'claude-code',
            'unrecognized',
            undefined,
        ];

        it('no provider/host combination in the contract table yields claude-code', () => {
            for (const provider of PROVIDERS) {
                for (const host of ALL_HOSTS) {
                    expect(resolveSpecKitAgent(provider, host)).not.toBe('claude-code');
                }
            }
        });
    });
});
