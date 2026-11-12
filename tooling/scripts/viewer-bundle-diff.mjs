// Compares two builds of the extension's webview bundles after stripping what moving a file
// changes on its own: webpack module ids and module path comments.
// Usage: node tooling/scripts/viewer-bundle-diff.mjs <base dist> <branch dist>
// Exits 1 when any bundle differs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [baseDir, headDir] = process.argv.slice(2);
if (!baseDir || !headDir) {
    console.error('Usage: node tooling/scripts/viewer-bundle-diff.mjs <base dist> <branch dist>');
    process.exit(2);
}

const BUNDLES = ['spec-viewer.js', 'spec-editor.js', 'process-create.js', 'pipeline-builder.js'];

function normalize(js) {
    return js
        .replace(/\/\*{3}\/ "[^"]*"/g, '/***/ "<path>"')
        .replace(/\/\*!?\s*[./\w-]+\.(?:ts|tsx|js)\s*\*\//g, '')
        .replace(/__webpack_require__\(\s*\d+\s*\)/g, '__webpack_require__(<id>)')
        .replace(/([{,])\s*\d+\s*:\s*(\(|function)/g, '$1<id>:$2')
        .replace(/"\.\/(?:apps|packages)\/[^"]+"/g, '"<path>"');
}

let differing = 0;
for (const name of BUNDLES) {
    const a = normalize(readFileSync(join(baseDir, 'webview', name), 'utf8')).split('\n');
    const b = normalize(readFileSync(join(headDir, 'webview', name), 'utf8')).split('\n');
    let lines = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) lines++;
    if (lines) differing++;
    console.log(`${name}: ${lines === 0 ? 'identical after normalizing' : `${lines} differing line(s)`}`);
}
process.exit(differing ? 1 : 0);
