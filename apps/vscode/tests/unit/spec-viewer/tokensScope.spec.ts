import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';

const repo = path.join(__dirname, '..', '..', '..', '..', '..');
const stylesDir = path.join(repo, 'apps', 'vscode', 'webview', 'styles');
const viewerDir = path.join(repo, 'packages', 'viewer', 'styles');
const themesDir = path.join(viewerDir, 'themes');
const read = (file: string) => fs.readFileSync(file, 'utf8');
const sharedTokens = read(path.join(stylesDir, 'tokens.css'));
const partials = fs.readdirSync(viewerDir).filter((name) => name.endsWith('.css')).map((name) => path.join(viewerDir, name));
const theme = (name: string) => read(path.join(themesDir, name));

// The shared tokens still theme the spec editor and the workflow builder from the host.
describe('the shared webview tokens', () => {
    const viewerLiterals = ['#65e6bd', '#087d63', '#101416', '#f4f7f6'];

    it('stay host-derived and carry none of the viewer palette', () => {
        expect(sharedTokens).toMatch(/--bg-primary:\s*var\(--vscode-editor-background/);
        expect(sharedTokens).toMatch(/--accent:\s*var\(--vscode-focusBorder/);
        for (const literal of viewerLiterals) expect(sharedTokens).not.toContain(literal);
    });

    it('enforce the hidden attribute for every webview', () => {
        expect(sharedTokens).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
    });

    it('are not what the viewer reads', () => {
        expect(read(path.join(stylesDir, 'spec-viewer.css'))).not.toContain('tokens.css');
    });
});

describe('the viewer package stylesheet', () => {
    it('reads only --sk-* tokens, beside the variables a rule or the renderer sets for itself', () => {
        const all = partials.map(read).join('\n');
        const local = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
        // Set inline by the renderer and the step tab: a bar's width, a lane's depth, implement progress.
        for (const inline of ['--w', '--d', '--impl-progress']) local.add(inline);
        const stray = [...all.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]).filter((t) => !t.startsWith('--sk-') && !local.has(t));
        expect([...new Set(stray)]).toEqual([]);
    });

    it('names no VS Code variable outside the VS Code theme', () => {
        const files = [...partials, ...fs.readdirSync(themesDir).filter((n) => n !== 'vscode.css').map((n) => path.join(themesDir, n))];
        for (const file of files) expect({ file: path.basename(file), vscode: /--vscode-/.test(read(file)) }).toEqual({ file: path.basename(file), vscode: false });
    });

    it('keeps the hidden attribute and the light default in the package itself', () => {
        expect(read(path.join(viewerDir, '_tokens.css'))).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
        expect(read(path.join(viewerDir, 'viewer.css')).indexOf("@import 'themes/light.css';")).toBe(
            read(path.join(viewerDir, 'viewer.css')).indexOf('@import')
        );
    });
});

describe('the built stylesheet', () => {
    it('scopes every selector under .sk-viewer', () => {
        execFileSync('node', [path.join(repo, 'packages', 'viewer', 'scripts', 'build-css.mjs')]);
        const built = postcss.parse(read(path.join(repo, 'packages', 'viewer', 'dist', 'styles', 'viewer.css')));
        const unscoped: string[] = [];
        built.walkRules((rule) => {
            if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as postcss.AtRule).name)) return;
            for (const selector of rule.selectors) if (!selector.includes('.sk-viewer')) unscoped.push(selector);
        });
        expect(unscoped).toEqual([]);
    });
});

describe('the theme files', () => {
    const declared = (css: string) => new Set([...css.matchAll(/(--sk-[\w-]+)\s*:/g)].map((m) => m[1]));
    const readTokens = new Set(partials.flatMap((file) => [...read(file).matchAll(/var\(\s*(--sk-[\w-]+)/g)].map((m) => m[1])));
    const base = declared(read(path.join(viewerDir, '_tokens.css')));

    it.each([
        ['vscode.css', ['vscode.css', 'vscode-roles.css']],
        ['light.css', ['light.css', 'roles.css']],
        ['dark.css', ['dark.css', 'roles.css']],
        ['ap-ui.css', ['ap-ui.css', 'light.css', 'roles.css']],
    ])('%s sets every token the stylesheet reads', (_name, files) => {
        const set = new Set([...base, ...files.flatMap((f) => [...declared(theme(f))])]);
        expect([...readTokens].filter((token) => !set.has(token))).toEqual([]);
    });

    it('give info, priority and requirement ids their own roles', () => {
        const roles = ['--sk-info', '--sk-priority-high', '--sk-priority-medium', '--sk-priority-low', '--sk-id-fr', '--sk-id-sc'];
        for (const file of ['roles.css', 'vscode-roles.css']) for (const role of roles) expect(theme(file)).toContain(`${role}:`);
    });

    it('keep blue off info and red off high priority under the shared rules', () => {
        const roles = theme('roles.css');
        expect(roles).toMatch(/--sk-info:\s*var\(--sk-accent\)/);
        expect(roles).toMatch(/--sk-priority-high:\s*var\(--sk-warning\)/);
        expect(roles).not.toMatch(/--sk-(info|id-fr|id-sc|priority-high):\s*var\(--sk-(blue|error)\)/);
        for (const file of ['light.css', 'dark.css']) expect(theme(file)).toContain("@import 'roles.css';");
        expect(theme('ap-ui.css')).toContain("@import 'light.css';");
    });

    it('switch the extension to the shared rules with one import', () => {
        expect(theme('vscode.css')).toContain("@import 'vscode-roles.css';");
    });
});
