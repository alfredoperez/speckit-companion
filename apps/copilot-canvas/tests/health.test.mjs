import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { projectHealth, constitutionState, checkCli, recheckCli, resetCliCheck } from '../com.github.copilot/extensions/speckit-companion/health.mjs';

describe('project health', () => {
    let root;
    const write = (rel, text = 'x') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
    const byId = (items, id) => items.find(item => item.id === id);
    const CLI = { installed: true, version: '1.2.3' };

    beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'canvas-health-')); resetCliCheck(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('flags every check in an empty project, each with a fix', () => {
        const items = projectHealth(root, { installed: false, version: '' });
        assert.deepEqual(items.map(i => i.ok), [false, false, false, false]);
        assert.ok(items.every(i => i.fix));
    });

    it('is all ready in a set-up project', () => {
        write('.specify/extensions/companion/extension.yml');
        write('.specify/memory/constitution.md', '# Real\n');
        write('.specify/integration.json', JSON.stringify({ installed_integrations: ['claude'] }));
        const items = projectHealth(root, CLI);
        assert.ok(items.every(i => i.ok));
        assert.equal(byId(items, 'cli').detail, 'v1.2.3');
    });

    it('reads the constitution placeholders but not the report comment', () => {
        assert.equal(constitutionState(root), 'missing');
        write('.specify/memory/constitution.md', '# [PROJECT_NAME]\n');
        assert.equal(constitutionState(root), 'template');
        write('.specify/memory/constitution.md', '<!-- [PROJECT_NAME] replaced -->\n# Real\n');
        assert.equal(constitutionState(root), 'filled');
    });

    it('does not alarm while the CLI is still being asked', () => {
        const cli = byId(projectHealth(root, null), 'cli');
        assert.equal(cli.pending, true);
        assert.equal(cli.detail, 'Checking…');
    });

    it('needs a valid integration.json for the agent, never a bare folder', () => {
        write('.claude/skills/x/SKILL.md');
        assert.equal(byId(projectHealth(root, CLI), 'agent').ok, false);
        write('.specify/integration.json', JSON.stringify({ installed_integrations: ['Bad Key; rm'] }));
        assert.equal(byId(projectHealth(root, CLI), 'agent').ok, false);
        write('.specify/integration.json', JSON.stringify({ integration: 'claude' }));
        assert.equal(byId(projectHealth(root, CLI), 'agent').ok, true);
    });

    it('re-asks a failed CLI check at most once a minute', async () => {
        const fail = (cmd, args, opts, cb) => cb(new Error('ENOENT'));
        const failed = await checkCli(fail);
        assert.equal(recheckCli(failed, fail, Date.now() + 1000), null);
        const again = recheckCli(failed, (c, a, o, cb) => cb(null, '1.0.0'), Date.now() + 61_000);
        assert.deepEqual(await again, { installed: true, version: '1.0.0' });
        assert.equal(recheckCli({ installed: true, version: '1.0.0' }, fail, Date.now() + 120_000), null);
    });

    it('flags missing node_modules only for a project with a package.json', () => {
        assert.equal(byId(projectHealth(root, CLI), 'node-modules'), undefined);
        write('package.json', '{}');
        assert.equal(byId(projectHealth(root, CLI), 'node-modules').ok, false);
        mkdirSync(join(root, 'node_modules'));
        assert.equal(byId(projectHealth(root, CLI), 'node-modules').ok, true);
    });

    it('flags Companion command files that are symlinks', () => {
        write('elsewhere/speckit.companion.plan.md');
        mkdirSync(join(root, '.specify/extensions/companion/commands'), { recursive: true });
        symlinkSync(join(root, 'elsewhere/speckit.companion.plan.md'), join(root, '.specify/extensions/companion/commands/speckit.companion.plan.md'));
        const item = byId(projectHealth(root, CLI), 'companion-files');
        assert.equal(item.ok, false);
        assert.match(item.detail, /1 symlinked/);
        rmSync(join(root, '.specify/extensions/companion/commands/speckit.companion.plan.md'));
        write('.specify/extensions/companion/commands/speckit.companion.plan.md');
        assert.equal(byId(projectHealth(root, CLI), 'companion-files').ok, true);
    });

    it('asks the CLI once and treats a failure as not installed', async () => {
        let calls = 0;
        const fail = (cmd, args, opts, cb) => { calls++; cb(new Error('ENOENT')); };
        assert.deepEqual(await checkCli(fail), { installed: false, version: '' });
        await checkCli(fail);
        assert.equal(calls, 1);
        resetCliCheck();
        assert.deepEqual(await checkCli((c, a, o, cb) => cb(null, 'CLI Version 0.9.1\n')), { installed: true, version: '0.9.1' });
    });
});
