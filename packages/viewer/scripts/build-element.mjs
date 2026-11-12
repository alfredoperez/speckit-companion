// Bundles `<speckit-viewer>` as one ES module, Preact and highlight.js inside, so a host needs no CDN.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildElement() {
    await build({
        absWorkingDir: pkg,
        entryPoints: ['src/element/index.ts'],
        outfile: 'dist/element/index.js',
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        jsx: 'automatic',
        jsxImportSource: 'preact',
        minify: true,
        sourcemap: true,
        legalComments: 'linked',
        logLevel: 'warning',
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildElement();
