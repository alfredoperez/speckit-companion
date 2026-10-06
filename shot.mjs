import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ensureStorybook, launchChrome, openStory, storyIndex } from './tooling/scripts/lib/storybook-browser.mjs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
await ensureStorybook();
const ids = Object.keys(await storyIndex()).filter(id => /pipeline-builder-situations.*stock/i.test(id));
const browser = await launchChrome();
const page = await browser.newPage({ viewport: { width: 1340, height: 1100 }, deviceScaleFactor: 2 });
for (const id of ids) { await openStory(page, id, { vscodeTheme: 'vivid-light' }); await page.screenshot({ path: join(out, `${id}.png`) }); console.log(id); }
await browser.close();
