import * as fs from 'fs';
import * as path from 'path';

const stylesDir = path.join(__dirname, '..', '..', '..', 'webview', 'styles');
const sharedTokens = fs.readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');
const viewerTokens = fs.readFileSync(path.join(stylesDir, 'spec-viewer', '_tokens-viewer.css'), 'utf8');
const viewerIndex = fs.readFileSync(path.join(stylesDir, 'spec-viewer', 'index.css'), 'utf8');

// The owned Codex palette is scoped to the spec viewer (spec 394). The
// spec-editor and workflow-editor webviews import the shared tokens.css and
// must keep tracking the host theme — a Codex literal leaking into the shared
// file silently repaints out-of-scope webviews.
describe('viewer palette scoping', () => {
  const codexLiterals = ['#65e6bd', '#087d63', '#101416', '#f4f7f6'];

  it('keeps the shared tokens host-derived', () => {
    expect(sharedTokens).toMatch(/--bg-primary:\s*var\(--vscode-editor-background/);
    expect(sharedTokens).toMatch(/--accent:\s*var\(--vscode-focusBorder/);
    for (const literal of codexLiterals) {
      expect(sharedTokens).not.toContain(literal);
    }
  });

  it('keeps the owned palette in the viewer-only layer', () => {
    for (const literal of codexLiterals) {
      expect(viewerTokens).toContain(literal);
    }
  });

  it('loads the viewer layer after the shared tokens so it wins the cascade', () => {
    const shared = viewerIndex.indexOf("@import '../tokens.css';");
    const viewer = viewerIndex.indexOf("@import '_tokens-viewer.css';");
    expect(shared).toBeGreaterThanOrEqual(0);
    expect(viewer).toBeGreaterThan(shared);
  });

  it('is not imported by the out-of-scope webview stylesheets', () => {
    for (const file of ['spec-editor.css', 'workflow.css']) {
      const css = fs.readFileSync(path.join(stylesDir, file), 'utf8');
      expect(css).not.toContain('_tokens-viewer.css');
    }
  });
});
