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

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { markHighlights } from '../../../website/src/components/changelog/parseChangelog';

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

      // The website's provider reference lists every provider once, with its `aiProvider` value in
      // backticks, in the table under "How each one is reached". Those values must be exactly the enum.
      const providersDoc = read('apps/website/src/content/docs/docs/reference/providers.mdx');
      const reached = providersDoc.match(/^## How each one is reached\n+((?:\|[^\n]*\n)+)/m);
      expect(reached).not.toBeNull();
      const documented = [...reached![1].matchAll(/\(`([a-z-]+)`\)\s*\|/g)].map((m) => m[1]);
      expect([...documented].sort()).toEqual([...enumValues].sort());
      expect(documented).toHaveLength(count);

      const arch = read('docs/architecture.md');
      // The architecture doc must claim a provider count that matches the enum.
      // We accept any English digit phrasing ("8 supported providers", "eight providers ship", etc.).
      const wordForCount: Record<number, string> = {
        5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve',
      };
      const expectedWord = wordForCount[count];
      const hasNumeric = new RegExp(`\\b${count}\\b[^.\\n]*provider`, 'i').test(arch);
      const hasWord = expectedWord
        ? new RegExp(`\\b${expectedWord}\\b[^.\\n]*provider`, 'i').test(arch)
        : false;
      expect(hasNumeric || hasWord).toBe(true);
    });

    it('custom workflows accept every selectable provider id', () => {
      const pkg = JSON.parse(read('package.json'));
      const cfg = pkg.contributes.configuration;
      const properties = Array.isArray(cfg)
        ? Object.assign({}, ...cfg.map((c: { properties?: object }) => c.properties ?? {}))
        : (cfg.properties ?? {});
      const workflowProviders = properties['speckit.customWorkflows'].items.properties
        .supportedAiProviders.items.enum;
      expect(workflowProviders).toEqual(expect.arrayContaining(enumValues));
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
        omp: 'ompProvider.ts',
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
    // These are baselines, each frozen at one viewer state. The extension writes
    // a per-machine id into any run record it watches, which is right for a
    // user's project and wrong for a file this repo ships: it reached main three
    // times in one cleanup, through a blanket `git add`. CLAUDE.md says to
    // restore these rather than commit them; this is that rule, enforced.
    const PINNED = [
      'specs/_00_demo-specified',
      'specs/_01_demo-planned',
      'specs/_02_demo-tasked',
      'specs/_03_demo-living',
      'apps/vscode/webview/src/spec-viewer/__fixtures__/specs/393-implement-button-lost',
      'apps/vscode/webview/src/spec-viewer/__fixtures__/specs/394-adopt-codex-design',
    ];

    it('no pinned fixture carries a per-machine telemetry id', () => {
      const carrying = PINNED.filter(dir => {
        const file = path.join(REPO_ROOT, dir, '.spec-context.json');
        return fs.existsSync(file) && 'telemetryInstanceId' in JSON.parse(fs.readFileSync(file, 'utf8'));
      });
      expect(carrying).toEqual([]);
    });

    it('no committed run record carries a per-machine telemetry id', () => {
      let tracked: string[];
      try {
        tracked = execFileSync('git', ['ls-files', '-z', 'specs'], { cwd: REPO_ROOT, encoding: 'utf8' })
          .split('\0')
          .filter(f => /(^|\/)\.spec-context\.json$/.test(f));
      } catch {
        return;
      }
      const carrying = tracked.filter(f => {
        const file = path.join(REPO_ROOT, f);
        return fs.existsSync(file) && 'telemetryInstanceId' in JSON.parse(fs.readFileSync(file, 'utf8'));
      });
      expect(carrying).toEqual([]);
    });
  });

  describe('changelog voice', () => {
    // docs/doc-sync.md "Changelog voice", enforced on the Unreleased block only:
    // a released version is history and is never checked. A file is held to the
    // PR links and area tags it already writes; the Claude Code mod's has neither.
    const CHANGELOGS = [
      { file: 'CHANGELOG.md', links: true, areas: true },
      { file: 'apps/speckit-extension/CHANGELOG.md', links: true, areas: true },
      { file: 'apps/claude-mod/CHANGELOG.md', links: false, areas: false },
    ];
    const TITLE_WORDS = 8;
    const SENTENCE_WORDS = 22;

    const COMMENT = /<!--[\s\S]*?-->/g;
    const PR_LINKS = /\(\[#\d+\]\([^)\s]+\)(?:,\s*\[#\d+\]\([^)\s]+\))*\)/g;

    // A code span counts as one word, and a stop inside it ends no sentence.
    const plain = (markdown: string) =>
      markdown
        .replace(COMMENT, ' ')
        .replace(PR_LINKS, ' ')
        .replace(/`[^`]*`/g, 'code')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/==|\*\*|\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const words = (text: string) => text.split(' ').filter(word => /[A-Za-z0-9]/.test(word)).length;
    const sentences = (text: string) => text.split(/(?<=[.!?]["')]?)\s+/).filter(Boolean);
    const marks = (markdown: string) => (markdown.replace(/`[^`]*`/g, '').match(/==/g) ?? []).length;

    function voiceProblems(source: string, { links, areas }: { links: boolean; areas: boolean }): string[] {
      const start = source.search(/^## \[Unreleased\]/m);
      if (start === -1) return [];
      const after = source.slice(start + 3);
      const end = after.search(/^## /m);
      const lines = (end === -1 ? after : after.slice(0, end)).split('\n').slice(1);

      const problems: string[] = [];
      const check = (kind: 'bullet' | 'highlight', title: string, raw: string) => {
        const say = (rule: string) => problems.push(`"${title}": ${rule}`);
        const body = sentences(plain(raw));
        if (kind === 'bullet') {
          if (words(plain(title)) > TITLE_WORDS) say(`title is over ${TITLE_WORDS} words`);
          if (body.length !== 1) say(`body is ${body.length} sentences, a bullet gets exactly one`);
          if (links && !/\[#\d+\]\([^)\s]+\)/.test(raw)) say('no PR link');
        } else {
          if (body.length < 1 || body.length > 2) say(`body is ${body.length} sentences, a highlight gets one or two`);
          if (links && !/<!--[^>]*\bpr:\s*\d/.test(raw)) say('no pr: in its comment');
        }
        if (body.some(sentence => words(sentence) > SENTENCE_WORDS)) say(`a sentence is over ${SENTENCE_WORDS} words`);
        if (marks(raw) > 2 || marks(raw) % 2 === 1 || marks(title) > 0) say('more than one ==highlight==, or one in the title');
        if (areas && !/<!--[^>]*\barea:\s*[\w-]+/.test(raw)) say('no area tag');
        if (/\b(now|previously)\b/i.test(plain(`${title} ${raw}`))) say('says "now" or "previously"');
      };

      let section = '';
      let open: { kind: 'bullet' | 'highlight'; title: string; raw: string[] } | null = null;
      const close = () => {
        if (open) check(open.kind, open.title, open.raw.join('\n'));
        open = null;
      };
      for (const line of lines) {
        const heading = line.match(/^(#{3,4})\s+(.+?)\s*$/);
        if (heading) {
          close();
          if (heading[1] === '###') section = heading[2];
          else open = { kind: 'highlight', title: heading[2], raw: [] };
        } else if (/^- /.test(line)) {
          close();
          const bold = line.match(/^- \*\*(.+?)\*\*(.*)$/);
          if (!bold) problems.push(`"${line.slice(2, 50)}": a bullet starts with a bold title`);
          else open = { kind: 'bullet', title: bold[1], raw: [bold[2]] };
        } else if (open && (open.kind === 'bullet' || /highlights/i.test(section))) {
          open.raw.push(line);
        }
      }
      close();
      return problems;
    }

    it.each(CHANGELOGS)('$file → every Unreleased entry is in the voice', ({ file, links, areas }) => {
      expect(voiceProblems(read(file), { links, areas })).toEqual([]);
    });

    it('names the entry and the rule it breaks, and leaves released versions alone', () => {
      const long = 'It wraps the text and it keeps going with far more words than any skimmer wants to read in a single changelog bullet today.';
      const sample = [
        '## [Unreleased]',
        '### Highlights',
        '#### Three sentences',
        'One. Two. Three.',
        '<!-- area: docs; pr: 1 -->',
        '### Fixed',
        '- **Fine entry.** A menu keeps ==its text== inside. ([#1](https://x/pull/1)) <!-- area: docs -->',
        '- **Two sentences.** One here. Two here. ([#1](https://x/pull/1)) <!-- area: docs -->',
        `- **Long sentence.** ${long} ([#1](https://x/pull/1)) <!-- area: docs -->`,
        '- **This title has rather more than eight words in.** Short. ([#1](https://x/pull/1)) <!-- area: docs -->',
        '- **Two marks.** A ==first== and a ==second== phrase. ([#1](https://x/pull/1)) <!-- area: docs -->',
        '- **Untagged.** It now works.',
        '## [1.0.0] - 2026-01-01',
        '- **A released entry is never checked.** One. Two. Three.',
      ].join('\n');
      expect(voiceProblems(sample, { links: true, areas: true })).toEqual([
        '"Three sentences": body is 3 sentences, a highlight gets one or two',
        '"Two sentences.": body is 2 sentences, a bullet gets exactly one',
        '"Long sentence.": a sentence is over 22 words',
        '"This title has rather more than eight words in.": title is over 8 words',
        '"Two marks.": more than one ==highlight==, or one in the title',
        '"Untagged.": no PR link',
        '"Untagged.": no area tag',
        '"Untagged.": says "now" or "previously"',
      ]);
      expect(voiceProblems(sample, { links: false, areas: false })).not.toContain('"Untagged.": no PR link');
    });

    it('the site draws ==a phrase== as a marker stroke, outside code and URLs only', () => {
      expect(markHighlights('<strong>Go.</strong> It is ==one <strong>big</strong> paragraph== here.')).toBe(
        '<strong>Go.</strong> It is <mark class="cl-hi">one <strong>big</strong> paragraph</mark> here.',
      );
      const untouched = '<a href="https://x/?a==b">link</a> <code>a == b == c</code> and a lone == sign';
      expect(markHighlights(untouched)).toBe(untouched);
    });
  });

});
