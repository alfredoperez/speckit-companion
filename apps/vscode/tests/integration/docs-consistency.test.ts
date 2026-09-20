/**
 * Docs consistency check — the prevention layer for the structural-cleanup refactor.
 *
 * Runs as part of `npm test`. Fails loud when documentation drifts from reality
 * along the dimensions that historically rot:
 *   - provider count in prose vs. package.json enum
 *   - provider files added without a mention in architecture.md
 *   - .ts/.tsx paths in docs that no longer exist on disk
 *
 * If you're updating docs to add a new file, the test will pass once the path
 * is real. If you're deleting a file, the test will fail until you remove its
 * doc mention. That's the point.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(REPO_ROOT, rel));

describe('docs consistency', () => {
  describe('provider count', () => {
    const enumValues: string[] = (() => {
      const pkg = JSON.parse(read('package.json'));
      // `contributes.configuration` may be either an object or an array of objects
      // depending on how VS Code's manifest is structured. Merge `properties` across
      // entries so the lookup is shape-independent.
      const cfg = pkg.contributes.configuration;
      const properties = Array.isArray(cfg)
        ? Object.assign({}, ...cfg.map((c: { properties?: object }) => c.properties ?? {}))
        : (cfg.properties ?? {});
      return properties['speckit.aiProvider'].enum;
    })();

    it('package.json enum, the website provider matrix, and architecture.md prose agree', () => {
      const count = enumValues.length;

      // The provider matrix moved from README.md to the site's provider reference in the
      // README rewrite, then to the website's provider reference when the repo
      // docs merged into the site.
      const providersDoc = read('apps/website/src/content/docs/docs/reference/providers.mdx');
      const matrixHeader = providersDoc.match(/^\| Feature \|([^\n]+)\|$/m);
      expect(matrixHeader).not.toBeNull();
      const matrixColumns = matrixHeader![1].split('|').map((s) => s.trim()).filter(Boolean);
      expect(matrixColumns).toHaveLength(count);

      const arch = read('docs/architecture.md');
      // The architecture doc must claim a provider count that matches the enum.
      // We accept any English digit phrasing ("8 supported providers", "eight providers ship", etc.).
      const wordForCount: Record<number, string> = {
        5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven',
      };
      const expectedWord = wordForCount[count];
      const hasNumeric = new RegExp(`\\b${count}\\b[^.\\n]*provider`, 'i').test(arch);
      const hasWord = expectedWord
        ? new RegExp(`\\b${expectedWord}\\b[^.\\n]*provider`, 'i').test(arch)
        : false;
      expect(hasNumeric || hasWord).toBe(true);
    });

    it('every speckit.* setting is window- or machine-scoped, so the migration needs no folder tier', () => {
      const pkg = JSON.parse(read('package.json'));
      const cfg = pkg.contributes.configuration;
      const properties: Record<string, { scope?: string }> = Array.isArray(cfg)
        ? Object.assign({}, ...cfg.map((c: { properties?: object }) => c.properties ?? {}))
        : (cfg.properties ?? {});
      const resourceScoped = Object.entries(properties)
        .filter(([, v]) => v.scope !== 'window' && v.scope !== 'machine')
        .map(([k]) => k);
      // src/core/settingsMigration.ts writes Global and Workspace only; VS Code
      // rejects a folder write for a window- or machine-scoped key.
      expect(resourceScoped).toEqual([]);
    });

    it('every enum id has a corresponding *Provider.ts or named integration file', () => {
      // Map enum ids to expected source files. "ide-chat" → ideChatProvider; "claude-vscode" → claudePanelProvider.
      const idToFile: Record<string, string> = {
        claude: 'claudeCodeProvider.ts',
        'claude-vscode': 'claudePanelProvider.ts',
        gemini: 'geminiCliProvider.ts',
        copilot: 'copilotCliProvider.ts',
        codex: 'codexCliProvider.ts',
        qwen: 'qwenCliProvider.ts',
        opencode: 'openCodeProvider.ts',
        'ide-chat': 'ideChatProvider.ts',
        wibey: 'wibeyCliProvider.ts',
        'wibey-vscode': 'wibeyPanelProvider.ts',
        antigravity: 'antigravityCliProvider.ts',
      };
      for (const id of enumValues) {
        const file = idToFile[id];
        expect(file).toBeDefined();
        expect(exists(`apps/vscode/src/ai-providers/${file}`)).toBe(true);
      }
    });
  });

  describe('provider file inventory', () => {
    it('every *Provider.ts under src/ai-providers/ is named in architecture.md', () => {
      const arch = read('docs/architecture.md');
      const dir = path.join(REPO_ROOT, 'apps/vscode/src/ai-providers');
      const providerFiles = fs
        .readdirSync(dir)
        .filter((f) => /Provider\.ts$/.test(f));
      expect(providerFiles.length).toBeGreaterThan(0);
      const missing = providerFiles.filter((f) => !arch.includes(f));
      expect(missing).toEqual([]);
    });
  });

  describe('paths referenced in docs exist on disk', () => {
    const DOCS = [
      'docs/architecture.md',
      'CLAUDE.md',
    ];

    // Extract paths from backticked spans that look like real source paths.
    // We're strict: must contain a slash and end in .ts/.tsx/.css/.json/.md.
    const PATH_RE = /`([a-zA-Z0-9_./-]+\/[a-zA-Z0-9_.-]+\.(?:ts|tsx|css|json|md))`/g;

    // Paths we know are intentional non-existent references (examples in prose,
    // legacy names quoted for historical context). Keep this list short and reviewed.
    const KNOWN_EXCEPTIONS = new Set<string>([
      // Gitignored, generated by `specify extension add` on install — absent in
      // a fresh checkout/CI. CLAUDE.md references it only to say "never edit it".
      '.specify/extensions/companion/CHANGELOG.md',
    ]);

    for (const doc of DOCS) {
      it(`${doc} → every backticked path resolves`, () => {
        const content = read(doc);
        const refs = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = PATH_RE.exec(content)) !== null) {
          const candidate = m[1];
          // Only check repo-relative paths (skip URLs and absolute-looking ones).
          if (candidate.startsWith('http') || candidate.startsWith('/')) continue;
          if (KNOWN_EXCEPTIONS.has(candidate)) continue;
          refs.add(candidate);
        }
        const missing = [...refs].filter((p) => !exists(p));
        // Diagnostic message names the offenders so the failure is actionable.
        if (missing.length > 0) {
          throw new Error(
            `${doc} references paths that don't exist:\n  - ${missing.join('\n  - ')}`,
          );
        }
      });
    }
  });

  describe('core layering', () => {
    // Shrinks over time; never grows.
    const ALLOWLIST = ['apps/vscode/src/core/telemetry.ts', 'apps/vscode/src/core/utils/terminalUtils.ts'];
    const UPWARD_IMPORT = /(?:from\s+|import\(|require\()\s*['"]\.\.?\/(?:[^'"]*\/)?(?:features|ai-providers)(?:\/|['"])/;

    it('the files under src/core that import features/ or ai-providers/ are exactly the allowlist', () => {
      const upward = fs
        .readdirSync(path.join(REPO_ROOT, 'apps/vscode/src/core'), { recursive: true, encoding: 'utf8' })
        .map((f) => `apps/vscode/src/core/${f.split(path.sep).join('/')}`)
        .filter((f) => /\.ts$/.test(f) && !/\.(test|spec)\.ts$/.test(f) && !f.includes('/__tests__/'))
        .filter((rel) => UPWARD_IMPORT.test(read(rel)))
        .sort();
      expect(upward).toEqual([...ALLOWLIST].sort());
    });
  });

  describe('repo map', () => {
    const IGNORED = new Set(['node_modules', 'dist', 'out', 'storybook-static', 'coverage']);

    const topLevelDirs = () =>
      fs
        .readdirSync(REPO_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORED.has(e.name))
        .map((e) => e.name)
        .sort();

    it('CLAUDE.md names every top-level directory a contributor sees', () => {
      const map = read('CLAUDE.md').split('## Gotchas')[0];
      const unnamed = topLevelDirs().filter((dir) => !map.includes(`${dir}/`));
      expect(unnamed).toEqual([]);
    });

    it('the repo map names no directory that has been moved or deleted', () => {
      const map = read('CLAUDE.md').split('## Gotchas')[0];
      const named = [...map.matchAll(/`([a-z][a-z-]*)\/`/g)].map((m) => m[1]);
      expect(named.filter((dir) => !exists(dir))).toEqual([]);
    });
  });

  describe('docs/ does not regrow', () => {
    // A cleanup pass deleted the docs that restated, as prose, behaviour the
    // living specs now state enforceably. This allowlist is what's left —
    // anything else is a doc going stale again. See docs/doc-sync.md.
    const ALLOWED_FILES = new Set([
      'architecture.md',
      'configuration.md',
      'doc-sync.md',
      'getting-started.md',
      'media-manifest.md',
      'pipeline-builder.md',
      'providers.md',
      'sidebar.md',
      'telemetry.md',
      'viewer.md',
      'visual-assets.md',
    ]);
    const ALLOWED_DIRS = new Set(['architecture', 'media', 'providers', 'reference', 'screenshots', 'style-guide']);

    it('holds no file outside the allowlist', () => {
      const entries = fs
        .readdirSync(path.join(REPO_ROOT, 'docs'), { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.'));
      const stray = entries
        .filter((e) => (e.isDirectory() ? !ALLOWED_DIRS.has(e.name) : !ALLOWED_FILES.has(e.name)))
        .map((e) => e.name);
      expect(stray).toEqual([]);
    });
  });

  describe('where unit tests live', () => {
    // CLAUDE.md pins unit tests to `__tests__`; 25 had drifted out with nothing failing.
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(full);
        return /\.(test|spec)\.tsx?$/.test(e.name) ? [full] : [];
      });

    it('every unit test sits in a __tests__ folder beside its code', () => {
      const roots = ['apps/vscode/src', 'apps/vscode/webview/src'].map((d) => path.join(REPO_ROOT, d));
      const stray = roots
        .flatMap(walk)
        .filter((f) => path.basename(path.dirname(f)) !== '__tests__')
        .map((f) => path.relative(REPO_ROOT, f));
      expect(stray).toEqual([]);
    });
  });

  describe('pinned fixtures stay pinned', () => {
    // The installed extension writes a per-machine id into any run record it
    // watches, including the committed fixtures. It reached main three times
    // during one cleanup, each time through a blanket `git add`.
    const fixtureRecords = (): string[] => {
      const out: string[] = [];
      const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name === '.spec-context.json') out.push(full);
        }
      };
      for (const root of ['specs', 'apps/vscode/webview/src/spec-viewer/__fixtures__']) {
        const abs = path.join(REPO_ROOT, root);
        if (fs.existsSync(abs)) walk(abs);
      }
      return out;
    };

    it('no committed run record carries a per-machine telemetry id', () => {
      const carrying = fixtureRecords()
        .filter(f => 'telemetryInstanceId' in JSON.parse(fs.readFileSync(f, 'utf8')))
        .map(f => path.relative(REPO_ROOT, f));
      expect(carrying).toEqual([]);
    });
  });
});
