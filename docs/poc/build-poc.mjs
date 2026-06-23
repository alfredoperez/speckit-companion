#!/usr/bin/env node
// Generates docs/poc/spec-views-data-driven.html by reading the real files of a
// handful of specs (markdown artifacts + .spec-context.json) and embedding them
// into _template.html. Nothing is hand-transcribed — the PoC renders the data
// exactly as it sits on disk.
//
//   node docs/poc/build-poc.mjs
//
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const specsDir = join(repo, 'specs');

// id → real spec directory. The id is what the switcher shows.
const PICKS = [
  ['327', '327-install-banner-responsive'],
  ['349', '349-cleanup-followups'],
  ['060', '060-spec-context-tracking'],
];

const FLAT = ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md', 'quickstart.md'];
const SUBDIRS = ['checklists', 'contracts'];

function read(p) { return readFileSync(p, 'utf8'); }
function firstIn(dir, exts) {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find(n => exts.some(e => n.endsWith(e)));
  return f ? join(dir, f) : null;
}

const specs = {};
const order = [];
for (const [id, slug] of PICKS) {
  const dir = join(specsDir, slug);
  if (!existsSync(dir)) { console.warn(`skip ${id}: ${slug} not found`); continue; }

  const docs = {};
  for (const f of FLAT) {
    const p = join(dir, f);
    if (existsSync(p)) docs[f] = read(p);
  }
  for (const sub of SUBDIRS) {
    const p = firstIn(join(dir, sub), sub === 'contracts' ? ['.json'] : ['.md']);
    if (p) docs[`${sub}/${p.split('/').pop()}`] = read(p);
  }

  const ctxPath = join(dir, '.spec-context.json');
  const context = existsSync(ctxPath) ? JSON.parse(read(ctxPath)) : { history: [] };

  const title = (context.specName || slug).replace(/\s+/g, ' ').slice(0, 28);
  specs[id] = { id, title, context, docs };
  order.push(id);
  console.log(`+ ${id} (${slug}): ${Object.keys(docs).length} artifacts, ${(context.history || []).length} history events`);
}

const template = read(join(here, '_template.html'));
// JSON.stringify handles all escaping; neutralize any literal </script> in content.
const safe = obj => JSON.stringify(obj).replace(/<\//g, '<\\/');
const out = template
  .replace('__DATA__', safe(specs))
  .replace('__ORDER__', safe(order));

const dest = join(here, 'spec-views-data-driven.html');
writeFileSync(dest, out);
console.log(`\nwrote ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
