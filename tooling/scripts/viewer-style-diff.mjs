// Proves a stylesheet change leaves the viewer looking the same: renders every viewer story's
// DOM under two builds of the extension's CSS and compares the computed style of every
// element and its ::before and ::after, in VS Code dark and light. Custom properties are
// skipped (their names are what changed); every other property must match. No screenshots.
//
// Usage: node tooling/scripts/viewer-style-diff.mjs <base storybook> <base dist> <branch dist> [branch storybook]
//   <base storybook>, [branch storybook]  `storybook build` outputs; each side renders its own
//     stories' DOM (stories that set tokens inline name them as their side's stylesheet does).
//     Without a branch build, the base DOM is used for both sides.
//   <base dist>, <branch dist>  each a dist/ holding webview/spec-viewer.css and what it imports
// Exits 1 on any difference.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const [sbDir, baseDist, headDist, headSbDir = sbDir] = process.argv.slice(2);
if (!sbDir || !baseDist || !headDist) {
    console.error('Usage: node tooling/scripts/viewer-style-diff.mjs <storybook-static> <base dist> <branch dist>');
    process.exit(2);
}

const TITLES = /^(VS Code Extension\/(Spec Viewer|Living Spec Viewer)|Scenes)\//;
const THEMES = [
    { name: 'dark', global: 'capture', bodyClass: 'vscode-dark' },
    { name: 'light', global: 'vivid-light', bodyClass: 'vscode-light' },
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const ROOTS = { sb: sbDir, sbhead: headSbDir, base: join(baseDist, 'webview'), head: join(headDist, 'webview') };
// A side whose stylesheet is scoped under .sk-viewer (the package's, from V4 on) gets the class on <body>, as the extension sets it.
const scoped = { base: existsSync(join(ROOTS.base, 'viewer', 'viewer.css')), head: existsSync(join(ROOTS.head, 'viewer', 'viewer.css')) };

const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const [, side, ...rest] = url.pathname.split('/');
    if ((side === 'base' || side === 'head') && rest.join('/') === 'page.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<!doctype html><html><head><link rel="stylesheet" href="spec-viewer.css"></head><body></body></html>');
    }
    const root = ROOTS[side];
    const file = root && normalize(join(root, decodeURIComponent(rest.join('/')) || 'index.html'));
    if (!file || !file.startsWith(normalize(root)) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end();
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// STORIES=id1,id2 narrows the run to those stories, to recheck a difference quickly.
const only = process.env.STORIES?.split(',').filter(Boolean);
const stories = Object.values(JSON.parse(readFileSync(join(sbDir, 'index.json'), 'utf8')).entries)
    .filter((e) => e.type === 'story' && TITLES.test(e.title) && (!only || only.includes(e.id)));

async function snapshot(id, theme, sb = 'sb') {
    await page.goto(`${origin}/${sb}/iframe.html?id=${id}&viewMode=story&globals=vscodeTheme:${theme.global}`);
    await page.waitForFunction(() => document.querySelector('#storybook-root')?.children.length || document.querySelector('.sb-show-errordisplay'), null, { timeout: 15000 }).catch(() => {});
    // A story that opens or settles after mount is read only once its DOM stops changing.
    const read = () => page.evaluate(() => ({ html: document.querySelector('#storybook-root')?.innerHTML ?? '', rootStyle: document.documentElement.getAttribute('style') ?? '' }));
    let last = await read();
    for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(300);
        const next = await read();
        if (next.html === last.html) return next;
        last = next;
    }
    return last;
}

const collect = () => {
    const rows = [];
    for (const el of [document.body, ...document.body.querySelectorAll('*')]) {
        for (const pseudo of [null, '::before', '::after']) {
            const cs = getComputedStyle(el, pseudo);
            let s = '';
            for (let i = 0; i < cs.length; i++) {
                const p = cs[i];
                if (!p.startsWith('--')) s += `${p}:${cs.getPropertyValue(p)};`;
            }
            const path = [];
            for (let n = el; n && n !== document.body; n = n.parentElement) path.unshift(n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
            rows.push({ where: `${path.slice(-3).join(' > ') || 'body'}${pseudo ?? ''}`, s });
        }
    }
    return rows;
};

async function render(side, snap, theme) {
    await page.goto(`${origin}/${side}/page.html`);
    await page.evaluate(({ snap, cls }) => {
        document.documentElement.setAttribute('style', snap.rootStyle);
        document.body.className = cls;
        document.body.innerHTML = `<div class="${cls.split(' ').pop()}">${snap.html}</div>`;
    }, { snap, cls: scoped[side] ? `sk-viewer ${theme.bodyClass}` : theme.bodyClass });
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    // A running spinner is sampled mid-turn; freeze every animation at its start so both sides match.
    await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; }));
    return page.evaluate(collect);
}

let failures = 0;
let compared = 0;
for (const story of stories) {
    for (const theme of THEMES) {
        const snap = await snapshot(story.id, theme);
        if (!snap.html) continue;
        const headSnap = headSbDir === sbDir ? snap : await snapshot(story.id, theme, 'sbhead');
        const [a, b] = [await render('base', snap, theme), await render('head', headSnap, theme)];
        compared++;
        const diffs = [];
        for (let i = 0; i < a.length; i++) {
            if (a[i].s === b[i]?.s) continue;
            const pa = Object.fromEntries(a[i].s.split(';').filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));
            const pb = Object.fromEntries((b[i]?.s ?? '').split(';').filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));
            for (const p of Object.keys({ ...pa, ...pb })) if (pa[p] !== pb[p]) diffs.push(`${a[i].where} ${p}: ${pa[p]} -> ${pb[p]}`);
        }
        if (diffs.length) {
            failures++;
            console.log(`DIFF ${story.id} [${theme.name}] ${diffs.length} propert${diffs.length === 1 ? 'y' : 'ies'}`);
            for (const d of diffs.slice(0, 8)) console.log(`  ${d}`);
        }
    }
}
await browser.close();
server.close();
console.log(`${compared} story renders compared across ${stories.length} stories; ${failures} with differences`);
process.exit(failures ? 1 : 0);
