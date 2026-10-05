// Copies the named pictures from the shots library to every place that uses them. Opens no window.
// usage: node tooling/scripts/place-shots.mjs [--from <dir>] [--check] [--list]
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (name) => process.argv.includes(`--${name}`);
const at = process.argv.indexOf('--from');
const library = resolve(root, at > -1 ? process.argv[at + 1] : '.shots');
const map = JSON.parse(readFileSync(join(root, 'tooling/scripts/shots.json'), 'utf8'));

if (!existsSync(library)) {
  console.error(`No shots library at ${library}. Run "npm run shots" first.`);
  process.exit(2);
}

const taken = readdirSync(library).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));

if (flag('list')) {
  for (const name of taken) {
    const uses = (map[name] ?? []).map((use) => use.to);
    console.log(`${name}${uses.length ? `  ->  ${uses.join(', ')}` : '  (not placed anywhere)'}`);
  }
  process.exit(0);
}

const same = (a, b) => existsSync(b) && readFileSync(a).equals(readFileSync(b));
let placed = 0;
let stale = 0;
let missing = 0;

for (const [name, uses] of Object.entries(map)) {
  const source = join(library, `${name}.png`);
  if (!existsSync(source)) {
    console.error(`Missing picture: ${name} is not in the library.`);
    missing += 1;
    continue;
  }
  for (const use of uses) {
    const target = join(root, use.to);
    if (flag('check')) {
      if (!use.crop && !use.width && !same(source, target)) {
        console.log(`Out of date: ${use.to}`);
        stale += 1;
      }
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    if (use.crop || use.width) {
      const filters = [use.crop && `crop=${use.crop}`, use.width && `scale=${use.width}:-2`].filter(Boolean).join(',');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-vf', filters, target]);
    } else {
      if (same(source, target)) continue;
      copyFileSync(source, target);
    }
    console.log(`Placed ${use.to}`);
    placed += 1;
  }
}

if (flag('check')) console.log(stale ? `${stale} out of date. Run "npm run shots:place".` : 'Every placed picture matches the library.');
else console.log(`${placed} placed.`);
process.exit(missing || (flag('check') && stale) ? 1 : 0);
