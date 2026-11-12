// Fails when the packaged extension needs something the .vsix does not carry.
// 1. Every shipped .js file: each require("x") must be a Node built-in, `vscode`, or a file
//    or package inside the .vsix.
// 2. The manifest's `main` loads under plain Node with `vscode` stubbed.
//
// Usage: node tooling/scripts/check-vsix.mjs [path/to.vsix]
//   Without a path it runs `vsce package` into a temp folder first.

import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = mkdtempSync(join(tmpdir(), 'check-vsix-'));
let vsix = process.argv[2];
if (!vsix) {
    vsix = join(work, 'extension.vsix');
    execFileSync('npx', ['vsce', 'package', '-o', vsix], { cwd: repo, stdio: 'inherit' });
}
execFileSync('unzip', ['-q', resolve(vsix), '-d', join(work, 'unpacked')]);
const root = join(work, 'unpacked', 'extension');

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
});
const shipped = (base) => ['', '.js', '.json', '/index.js'].some((ext) => existsSync(base + ext) && statSync(base + ext).isFile());

const problems = [];
const files = walk(root).filter((f) => f.endsWith('.js'));
for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
        if (spec === 'vscode' || builtins.has(spec)) continue;
        const found = spec.startsWith('.')
            ? shipped(resolve(dirname(file), spec))
            : existsSync(join(root, 'node_modules', spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]));
        if (!found) problems.push(`${relative(root, file)} requires "${spec}", which the .vsix does not ship`);
    }
}

const main = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).main;
// Any vscode member is a class that builds more of itself; `__esModule` lets TypeScript's
// import helpers pass the module through as is.
const loader = `
const Module = require('module');
const make = () => new Proxy(class {}, { get: (t, k) => (k === '__esModule' ? true : k === 'prototype' ? t.prototype : typeof k === 'symbol' ? t[k] : make()), apply: () => make(), construct: () => make() });
const vscode = make();
const load = Module._load;
Module._load = function (request, ...rest) { return request === 'vscode' ? vscode : load.call(this, request, ...rest); };
try { require(process.argv[1]); } catch (e) { console.error(e.name + ': ' + e.message); process.exit(1); }
`;
try {
    execFileSync(process.execPath, ['-e', loader, join(root, main)], { stdio: 'pipe' });
} catch (error) {
    problems.push(`${main} does not load under Node with vscode stubbed: ${String(error.stderr).trim().split('\n').pop()}`);
}

if (problems.length) {
    console.error(`The .vsix is missing what it needs (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`The .vsix carries everything it requires: ${files.length} .js file(s) checked, ${main} loads.`);
