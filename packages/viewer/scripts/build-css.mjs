// Builds dist/styles: viewer.css with its partials inlined and every selector scoped under
// `.sk-viewer`, plus the theme files as written. `:where()` adds no specificity, so the
// rules weigh against each other exactly as they did unscoped.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = ':where(.sk-viewer)';
const require = createRequire(import.meta.url);
const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(pkg, 'styles');
const out = join(pkg, 'dist', 'styles');

function inline(file) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkAtRules('import', (rule) => {
        const target = rule.params.replace(/^url\(|\)$/g, '').replace(/^['"]|['"]$/g, '');
        rule.replaceWith(inline(join(dirname(file), target)).nodes);
    });
    return root;
}

const LEAD = /^(html|body|:root|\*)(?=$|[\s.#:[>+~])/;

// A selector that names the page root (`body`, `:root`, `*`) also has to reach the
// viewer's root element itself, not only what sits inside it.
export function scope(selector) {
    const s = selector.trim();
    if (s.includes('.sk-viewer')) return [s];
    const lead = s.match(LEAD)?.[1];
    if (!lead) return [`${ROOT} ${s}`];
    const rest = s.slice(lead.length);
    if (lead === '*') return [`${ROOT}${rest}`, `${ROOT} ${s}`];
    return [`${ROOT}${rest}`];
}

export function buildCss() {
    const sheet = inline(join(src, 'viewer.css'));
    sheet.walkRules((rule) => {
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
        rule.selectors = rule.selectors.flatMap(scope);
    });
    mkdirSync(join(out, 'themes'), { recursive: true });
    writeFileSync(join(out, 'viewer.css'), sheet.toString());
    for (const name of readdirSync(join(src, 'themes'))) copyFileSync(join(src, 'themes', name), join(out, 'themes', name));
    // Code colours for the bundled highlighter, unscoped like the CDN sheet the webview used to load.
    mkdirSync(join(out, 'highlight'), { recursive: true });
    copyFileSync(require.resolve('highlight.js/styles/github-dark.min.css'), join(out, 'highlight', 'github-dark.css'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildCss();
