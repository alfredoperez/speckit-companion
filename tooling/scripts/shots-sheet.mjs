// Puts every picture in a folder on one reduced sheet, so a run is looked at once and small. Open a single file only when a detail is in doubt.
// usage: node tooling/scripts/shots-sheet.mjs <dir> [--out <file>] [--cols <n>] [--match <text>]
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
const dir = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : undefined;
if (!dir || !existsSync(dir)) {
    console.error('usage: node tooling/scripts/shots-sheet.mjs <dir> [--out <file>] [--cols <n>] [--match <text>]');
    process.exit(2);
}
const out = resolve(arg('out', join(dir, '_sheet.png')));
const cols = Number(arg('cols', 3));
const match = arg('match', '');
const names = readdirSync(dir).filter(name => name.endsWith('.png') && !name.startsWith('_') && name.includes(match)).sort();
if (!names.length) {
    console.error(`No pictures in ${dir}${match ? ` matching "${match}"` : ''}.`);
    process.exit(2);
}

const cell = 480;
const escape = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#fff;font:12px/1.3 -apple-system,sans-serif;color:#222;display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:12px}
figure{margin:0}img{width:${cell}px;display:block;border:1px solid #ccc}figcaption{padding:3px 0 0;word-break:break-all}
</style>${names.map(name => `<figure><img src="${pathToFileURL(join(dir, name)).href}"><figcaption>${escape(name.slice(0, -4))}</figcaption></figure>`).join('')}`;

// A page set from a string cannot load local files, so the sheet is a file of its own.
const scratch = mkdtempSync(join(tmpdir(), 'shots-sheet-'));
const sheet = join(scratch, 'sheet.html');
writeFileSync(sheet, html);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
    const page = await browser.newPage({ viewport: { width: cols * (cell + 12) + 12, height: 600 } });
    await page.goto(pathToFileURL(sheet).href, { waitUntil: 'load' });
    await page.screenshot({ path: out, fullPage: true });
} finally {
    await browser.close();
    rmSync(scratch, { recursive: true, force: true });
}
console.log(`${names.length} pictures on one sheet: ${out}`);
