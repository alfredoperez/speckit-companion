import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveProviderIconKey, NEUTRAL_PROVIDER_ICON } from '../providerIcon';
import { detectHostIde, HostIde } from '../../../core/utils/hostIde';
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

    describe('exhaustiveness over the shipped provider list', () => {
        const manifest = JSON.parse(
            fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf-8')
        );
        const enumValues: string[] = manifest.contributes.configuration
            .flatMap((section: any) => Object.entries(section.properties ?? {}))
            .find(([key]: [string, unknown]) => key === 'speckit.aiProvider')[1].enum;

        // A provider added to the setting without a resolver case would silently
        // land on the neutral glyph; these are the only two allowed to.
        const NEUTRAL_BY_DESIGN: string[] = [AIProviders.WIBEY, AIProviders.WIBEY_VSCODE];

        it('covers every value the aiProvider setting accepts', () => {
            expect(enumValues.length).toBeGreaterThan(0);
            for (const id of enumValues) {
                const key = resolveProviderIconKey(id, 'vscode');
                if (NEUTRAL_BY_DESIGN.includes(id)) {
                    expect(key).toEqual(NEUTRAL_PROVIDER_ICON);
                } else {
                    expect(key).not.toEqual(NEUTRAL_PROVIDER_ICON);
                }
            }
        });

        it('resolves an ide-chat host to a mark the extension actually ships', () => {
            const assets = path.join(__dirname, '../../../../assets/icons/providers');
            for (const host of ['vscode', 'cursor', 'windsurf'] as HostIde[]) {
                const key = resolveProviderIconKey(AIProviders.IDE_CHAT, host);
                expect(key.kind).toBe('mono');
                if (key.kind === 'mono') {
                    expect(fs.existsSync(path.join(assets, `${key.name}-light.svg`))).toBe(true);
                    expect(fs.existsSync(path.join(assets, `${key.name}-dark.svg`))).toBe(true);
                }
            }
        });

        it('resolves every branded provider to a mark the extension actually ships', () => {
            const assets = path.join(__dirname, '../../../../assets/icons/providers');
            for (const id of enumValues) {
                const key = resolveProviderIconKey(id, 'vscode');
                if (key.kind === 'asset') {
                    expect(fs.existsSync(path.join(assets, key.file))).toBe(true);
                } else if (key.kind === 'mono') {
                    expect(fs.existsSync(path.join(assets, `${key.name}-light.svg`))).toBe(true);
                    expect(fs.existsSync(path.join(assets, `${key.name}-dark.svg`))).toBe(true);
                }
            }
        });
    });
});

describe('label and icon agreement', () => {
    const originalScheme = vscode.env.uriScheme;
    const originalApp = vscode.env.appName;

    afterEach(() => {
        (vscode.env as any).uriScheme = originalScheme;
        (vscode.env as any).appName = originalApp;
    });

    const BRANDS = ['copilot', 'cursor', 'windsurf'];

    it.each(HOSTS)('ide-chat in $host names the same product in label and mark', ({ uriScheme, appName, host }) => {
        (vscode.env as any).uriScheme = uriScheme;
        (vscode.env as any).appName = appName;

        const label = getProviderDisplayName(AIProviders.IDE_CHAT).toLowerCase();
        const key = resolveProviderIconKey(AIProviders.IDE_CHAT, host);

        if (key.kind === 'mono') {
            expect(label).toContain(key.name);
        } else {
            expect(label).toBe('ide chat');
            for (const brand of BRANDS) {
                expect(label).not.toContain(brand);
            }
        }
    });
});
