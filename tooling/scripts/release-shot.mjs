// node tooling/scripts/release-shot.mjs <storyId> <outBase> <label> <selector>[||<selector>...]
// Writes <outBase>.png (clean), <outBase>.marked.png (marker label + outline) and <outBase>.json
// (the highlight box in the clean image's pixels). The frame is 16:9, cropped as tight as the
// highlighted part allows (640–1000 CSS px wide), so text stays readable on a phone.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [id, outBase, label, sels] = process.argv.slice(2);
const PAGE_W = 1000;
setTimeout(() => { console.error('shot timed out'); process.exit(2); }, 120000).unref();
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: PAGE_W, height: 2800 }, deviceScaleFactor: 2 });
await p.goto(`http://localhost:6006/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(3500);
const boxes = [];
const locs = [];
for (const sel of sels.split('||')) {
  const loc = p.locator(sel).first();
  if (!(await loc.count())) { console.error(`no match: ${sel}`); continue; }
  const bb = await loc.boundingBox();
  if (bb) { boxes.push(bb); locs.push(loc); }
}
if (!boxes.length) { console.error('nothing highlighted'); process.exit(3); }
const L = Math.min(...boxes.map(x => x.x)), T = Math.min(...boxes.map(x => x.y));
const R = Math.max(...boxes.map(x => x.x + x.width)), B = Math.max(...boxes.map(x => x.y + x.height));
let w = Math.min(PAGE_W, Math.max(640, R - L + 160));
let h = Math.round(w * 9 / 16);
if (B - T + 120 > h) { h = Math.min(B - T + 120, 1400); w = Math.min(PAGE_W, Math.round(h * 16 / 9)); h = Math.round(w * 9 / 16); }
const x = Math.round(R + 40 <= w ? 0 : Math.min(R + 40 - w, PAGE_W - w));
const y = Math.round(Math.max(0, (T + B) / 2 - h / 2 + 20));
const clip = { x, y, width: w, height: h };
await p.screenshot({ path: `${outBase}.png`, clip, timeout: 20000 });
const pad = 8;
writeFileSync(`${outBase}.json`, JSON.stringify({
  scale: 2, width: w * 2, height: h * 2,
  highlight: { x: Math.round((L - pad - x) * 2), y: Math.round((T - pad - y) * 2), w: Math.round((R - L + 2 * pad) * 2), h: Math.round((B - T + 2 * pad) * 2) },
}));
await p.addStyleTag({ content: `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
.hl-mark{outline:3px solid #F5C400 !important;outline-offset:5px;border-radius:8px;}
.hl-label{position:absolute;z-index:99999;font:700 26px/1 'Caveat',cursive;color:#1d1d1f;white-space:nowrap;transform:rotate(-2deg);
  padding:0 6px;background:linear-gradient(104deg,rgba(245,196,0,0) 1%,rgba(245,196,0,.85) 3%,rgba(245,196,0,.7) 96%,rgba(245,196,0,0) 99%);
  background-size:100% 62%;background-repeat:no-repeat;background-position:0 72%;background-color:#fbfbfe;border-radius:4px;box-shadow:0 0 0 4px #fbfbfe;}` });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(600);
for (const loc of locs) await loc.evaluate(el => el.classList.add('hl-mark'));
await p.evaluate(({ text, L, T, R, B, clip }) => {
  const el = document.createElement('div');
  el.className = 'hl-label';
  el.textContent = text;
  document.body.appendChild(el);
  const width = el.offsetWidth, height = el.offsetHeight;
  const room = T - clip.y - 14;
  const top = room >= height ? T - height - 14 : Math.min(B + 16, clip.y + clip.height - height - 8);
  const left = Math.min(Math.max(clip.x + 8, R - width), clip.x + clip.width - width - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}, { text: label, L, T, R, B, clip });
await p.screenshot({ path: `${outBase}.marked.png`, clip, timeout: 20000 });
await b.close();
process.exit(0);
