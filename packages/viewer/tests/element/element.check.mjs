// Loads the built element alone in headless Chrome and checks what a host sees.
// Usage: npm run build -w speckit-viewer && node packages/viewer/tests/element/element.check.mjs [screenshot.png]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const record = {
    workflow: 'companion', specName: '001-starred-todos', branch: '001-starred-todos', currentStep: 'implement', status: 'implementing',
    request: 'Add a star to todos and a Starred filter.',
    history: [
        { step: 'specify', kind: 'start', by: 'extension', at: '2026-11-01T10:00:00Z' },
        { step: 'specify', kind: 'complete', by: 'extension', at: '2026-11-01T10:04:00Z' },
        { step: 'plan', kind: 'start', by: 'extension', at: '2026-11-01T10:04:00Z' },
        { step: 'plan', kind: 'complete', by: 'ai', at: '2026-11-01T10:09:00Z' },
        { step: 'implement', kind: 'start', by: 'extension', at: '2026-11-01T10:12:00Z' },
    ],
};
const doc = (type, label, file, extra = {}) => ({ type, label, fileName: file, filePath: `/specs/001/${file}`, exists: true, isCore: true, category: 'core', ...extra });
const documents = [doc('spec', 'Specification', 'spec.md'), doc('plan', 'Plan', 'plan.md'), doc('tasks', 'Tasks', 'tasks.md')];
const texts = {
    spec: '# Feature Specification: Starred todos\n\n## User Scenarios\n\nA person stars a todo.\n\n```ts\nconst starred: boolean = true;\n```\n',
    plan: '# Implementation Plan: Starred todos\n\n## Summary\n\nAdd a field.\n',
    tasks: '# Tasks\n\n- [x] **T001** Add the field\n',
};

const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/highlight/github-dark.css">
<link rel="stylesheet" href="/styles/viewer.css">
<link rel="stylesheet" href="/styles/themes/light.css">
</head><body style="margin:0;height:100vh">
<speckit-viewer id="v" style="height:100vh"><div slot="actions" id="host-actions"><button>Run next step</button></div></speckit-viewer>
<script type="module">
import '/element/index.js';
const v = document.getElementById('v');
const texts = ${JSON.stringify(texts)};
window.events = [];
v.addEventListener('speckit-action', (e) => { window.events.push(e.detail); if (e.detail.type === 'stepperClick') v.content = texts[e.detail.phase] ?? null; });
v.record = ${JSON.stringify(record)};
v.documents = ${JSON.stringify(documents)};
v.landing = 'document';
v.currentDoc = 'spec';
v.content = texts.spec;
v.live = true;
</script></body></html>`;

const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/') { res.setHeader('content-type', 'text/html'); return res.end(page); }
    const path = url.startsWith('/styles/') || url.startsWith('/highlight/') ? join(dist, 'styles', url.replace(/^\/styles\//, '')) : join(dist, normalize(url));
    try { res.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream'); res.end(readFileSync(path)); } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const tab = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const external = [];
tab.on('request', (r) => { if (!r.url().startsWith(origin)) external.push(r.url()); });
const errors = [];
tab.on('pageerror', (e) => errors.push(e.message));
await tab.goto(origin);
await tab.waitForSelector('speckit-viewer .step-tab');
await tab.waitForSelector('#markdown-content .hljs-keyword');

const first = await tab.evaluate(() => ({
    slotFirst: document.getElementById('host-actions').getBoundingClientRect().bottom <= document.querySelector('speckit-viewer .shell-grid').getBoundingClientRect().top + 1,
    slotUnstyled: !document.getElementById('host-actions').closest('.sk-viewer'),
    tabs: [...document.querySelectorAll('.step-tab')].map((t) => t.dataset.phase),
    title: document.querySelector('.spec-header-title')?.textContent,
}));
assert.ok(first.slotFirst, 'the actions slot shows above the rail and document');
assert.ok(first.slotUnstyled, 'the slotted host content sits outside the viewer styles');
assert.deepEqual(first.tabs.slice(0, 3), ['spec', 'plan', 'tasks'], 'the rail lists the documents');
assert.equal(first.title, 'Starred todos');
const shot = process.argv[2];
if (shot) await tab.screenshot({ path: shot });

await tab.click('.step-tab[data-phase="plan"]');
await tab.waitForFunction(() => document.querySelector('#markdown-content h2')?.textContent === 'Summary');
const after = await tab.evaluate(() => ({ events: window.events, current: document.querySelector('.step-tab.current')?.dataset.phase, title: document.querySelector('.spec-header-title')?.textContent }));
assert.deepEqual(after.events[0], { type: 'stepperClick', phase: 'plan' }, 'the rail click comes out as a speckit-action event');
assert.equal(after.current, 'plan', 'the element switched document itself');
assert.equal(after.title, 'Starred todos', 'the title stays on another tab');
assert.deepEqual(external, [], 'no request leaves the page (no CDN)');
assert.deepEqual(errors, []);

await browser.close();
server.close();
console.log('speckit-viewer element: rail, slot, highlighting, navigation, events and no CDN all check out.');
