import * as vscode from 'vscode';
import { detectHostIde, resolveProviderIconKey, HostIde, NEUTRAL_PROVIDER_ICON } from '../providerIcon';
import { getProviderDisplayName } from '../../../ai-providers/aiProvider';
import { AIProviders } from '../../../core/constants';

const HOSTS: Array<{ host: HostIde; uriScheme: string; appName: string }> = [
    { host: 'vscode', uriScheme: 'vscode', appName: 'Visual Studio Code' },
    { host: 'cursor', uriScheme: 'cursor', appName: 'Cursor' },
    { host: 'windsurf', uriScheme: 'windsurf', appName: 'Windsurf' },
    { host: 'unknown', uriScheme: 'antigravity', appName: 'Antigravity' },
];

describe('detectHostIde', () => {
    it.each(HOSTS)('resolves $appName to $host', ({ host, uriScheme, appName }) => {
        expect(detectHostIde(uriScheme, appName)).toBe(host);
    });

    it('falls back to unknown when the host reports nothing', () => {
        expect(detectHostIde(undefined, undefined)).toBe('unknown');
    });
});

describe('resolveProviderIconKey', () => {
    it.each([
        [AIProviders.CLAUDE, 'claude.svg'],
        [AIProviders.CLAUDE_VSCODE, 'claude.svg'],
        [AIProviders.GEMINI, 'gemini.svg'],
        [AIProviders.QWEN, 'qwen.svg'],
    ])('%s uses its colored brand asset', (id, file) => {
        expect(resolveProviderIconKey(id, 'vscode')).toEqual({ kind: 'asset', file });
    });

    it.each([AIProviders.COPILOT, AIProviders.CODEX, AIProviders.OPENCODE])(
        '%s uses a light/dark monochrome mark',
        id => {
            expect(resolveProviderIconKey(id, 'vscode')).toEqual({ kind: 'mono', name: id });
        }
    );

    it.each([
        ['vscode' as HostIde, { kind: 'mono', name: 'copilot' }],
        ['cursor' as HostIde, { kind: 'mono', name: 'cursor' }],
        ['windsurf' as HostIde, { kind: 'mono', name: 'windsurf' }],
    ])('ide-chat in %s shows that host\'s own mark', (host, expected) => {
        expect(resolveProviderIconKey(AIProviders.IDE_CHAT, host)).toEqual(expected);
    });

    it('never falls back to Copilot branding in an unknown host', () => {
        const key = resolveProviderIconKey(AIProviders.IDE_CHAT, 'unknown');
        expect(key).toEqual(NEUTRAL_PROVIDER_ICON);
        expect(JSON.stringify(key)).not.toContain('copilot');
    });

    it.each([AIProviders.WIBEY, AIProviders.WIBEY_VSCODE])(
        '%s resolves to the documented neutral chat icon',
        id => {
            expect(resolveProviderIconKey(id, 'vscode')).toEqual(NEUTRAL_PROVIDER_ICON);
        }
    );

    it('gives an unknown provider a neutral icon rather than another vendor mark', () => {
        expect(resolveProviderIconKey('something-new', 'vscode')).toEqual(NEUTRAL_PROVIDER_ICON);
    });
});

describe('label and icon agreement', () => {
    const originalScheme = vscode.env.uriScheme;
    const originalApp = vscode.env.appName;

    afterEach(() => {
        (vscode.env as any).uriScheme = originalScheme;
        (vscode.env as any).appName = originalApp;
    });

    const BRAND_WORDS: Record<string, string> = {
        copilot: 'copilot',
        cursor: 'cursor',
        windsurf: 'windsurf',
    };

    it.each(HOSTS)('ide-chat in $host names the same product in label and mark', ({ uriScheme, appName, host }) => {
        (vscode.env as any).uriScheme = uriScheme;
        (vscode.env as any).appName = appName;

        const label = getProviderDisplayName(AIProviders.IDE_CHAT).toLowerCase();
        const key = resolveProviderIconKey(AIProviders.IDE_CHAT, host);

        if (key.kind === 'mono') {
            // A branded mark must be named by the label too.
            expect(label).toContain(BRAND_WORDS[key.name] === 'copilot' ? 'copilot' : key.name);
        } else {
            // A neutral mark means the label must stay neutral as well.
            expect(label).toBe('ide chat');
            for (const brand of Object.values(BRAND_WORDS)) {
                expect(label).not.toContain(brand);
            }
        }
    });
});
