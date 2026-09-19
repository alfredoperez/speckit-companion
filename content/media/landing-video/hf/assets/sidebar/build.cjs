/*
 * Build the two sidebar states the composition renders in beats 4 and 5.
 *
 * INPUT   capture-state-a.raw.html / capture-state-b.raw.html, next to this file.
 *         These are the SpecKit tree lifted out of a running VS Code through the
 *         developer tools with every computed style inlined, so each one renders
 *         standalone with no VS Code stylesheet.
 *
 * WHAT IT DOES
 *   - undoes the monaco virtual list: the scroll offset on .monaco-list-rows and
 *     the sticky top row pinned in .monaco-tree-sticky-container
 *   - drops VS Code's injected <style> blocks, which only reference --vscode-*
 *     variables that do not exist outside the workbench and which out-specify the
 *     inlined declarations
 *   - substitutes Teamboard content for the real spec names, so nothing private
 *     and no em dash reaches the screen
 *   - inlines the two provider icons, which were vscode-file:// URLs
 *   - resizes every pane to its own content so nothing clips or scrolls
 *   - adds data-hook / data-pane attributes the composition timeline measures
 *   - prunes the computed-style dump to the properties that actually paint
 *   - regrades the capture theme onto the composition palette
 *
 * OUTPUT  sidebar-state-a.frag.html / sidebar-state-b.frag.html.
 *         Then run dedupe.py, then sync.py. See sync.py for the full pipeline.
 *
 * RE-SKINNING. The regrade below maps the captured theme to literal colours; sync.py
 * then rewrites those literals to CSS custom properties. If you re-capture from a
 * VS Code in a different theme, the REGRADE table here is the thing to update.
 *
 * Needs playwright-core. Point PLAYWRIGHT_CORE at it if it is not resolvable.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const HOME = process.env.HOME;
const EXT = HOME + '/.vscode/extensions/alfredoperez.speckit-companion-0.31.5/assets/icons/';
const dataUri = (p) => 'data:image/svg+xml;base64,' + fs.readFileSync(p).toString('base64');
const MOSS = dataUri(EXT + 'moss.svg');
const CLAUDE = dataUri(EXT + 'providers/claude.svg');

/* ------------------------------------------------------------------ content */
// [label, description, iconClassOverride|null, iconColorOverride|null, id|null]
const SPECS_A = [
  ['Active (3)', '', null, null, 'rwActive'],
  ['041-profile-photo-upload', '2d ago', null, null, 'rw041'],
  ['040-audit-log', '5d ago', null, null, 'rw040'],
  ['039-session-timeout', '6d ago', null, null, 'rw039'],
  ['Completed (1)', '', null, null, 'rwDone'],
];

// state B: target visual order -> source row id in capture B
const SPECS_B = [
  ['list_id_2_0',  'Active (3)', '', null, null, 'rwActive'],
  ['list_id_2_9',  '041-profile-photo-upload', '2d ago', null, 'rgb(120, 220, 232)', 'rw041'],
  ['list_id_2_10', 'Specification', '', null, null, 'rwDocSpec'],
  ['list_id_2_11', 'Requirements', '', null, null, 'rwDocReq'],
  ['list_id_2_12', 'Plan', '', null, null, 'rwDocPlan'],
  ['list_id_2_13', 'Progression', '', null, null, null],
  ['list_id_2_14', 'Data Model', '', null, null, null],
  ['list_id_2_15', 'Research', '', null, null, null],
  ['list_id_2_16', 'Verification', '', null, null, null],
  ['list_id_2_4',  'Tasks', 'not created', null, null, 'rwDocTasks'],
  ['list_id_2_5',  '040-audit-log', '5d ago', null, null, 'rw040'],
  ['list_id_2_6',  '039-session-timeout', '6d ago', null, null, 'rw039'],
  ['list_id_2_7',  'Completed (1)', '', null, null, 'rwDone'],
];

const STEERING_A = 8;   // keep first 8 captured rows unchanged (product files, not repo content)
const LIVING_A = [
  'api', 'auth', 'boards', 'cards', 'uploads',
  'workers', 'image-resize',
  'web', 'components', 'hooks',
  'routes', 'board', 'card', 'upload',
];
const LIVING_B = LIVING_A.slice(0, 8);

/* ---------------------------------------------------------------- regrade */
// capture theme  ->  monokai-black, the composition palette
const REGRADE = [
  [/rgb\(25,\s*28,\s*36\)/g,            'rgb(14, 14, 14)'],
  [/rgba\(25,\s*28,\s*36,/g,            'rgba(14, 14, 14,'],
  [/rgb\(21,\s*23,\s*30\)/g,            'rgb(19, 19, 19)'],
  [/rgb\(30,\s*34,\s*44\)/g,            'rgb(20, 20, 20)'],
  [/rgb\(115,\s*201,\s*145\)/g,         'rgb(169, 220, 118)'],   // green -> charts.green
  [/rgba\(115,\s*201,\s*145,/g,         'rgba(169, 220, 118,'],
  [/rgb\(208,\s*211,\s*222\)/g,         'rgb(199, 199, 199)'],   // pane header fg
  [/rgb\(178,\s*184,\s*201\)/g,         'rgb(199, 199, 199)'],
  [/rgba\(178,\s*184,\s*201,/g,         'rgba(199, 199, 199,'],
  [/rgb\(83,\s*91,\s*117\)/g,           'rgb(84, 84, 84)'],      // view title fg
  [/rgba\(83,\s*91,\s*117,/g,           'rgba(84, 84, 84,'],
];

/* ------------------------------------------------------------- style prune */
const KEEP = new Set(`position display top left right bottom width height min-width min-height max-width max-height
margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left
box-sizing overflow-x overflow-y background-color background-image background-size background-repeat background-position
color opacity visibility
border-top-width border-right-width border-bottom-width border-left-width
border-top-style border-right-style border-bottom-style border-left-style
border-top-color border-right-color border-bottom-color border-left-color
border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius
font-family font-size font-weight font-style font-variant line-height letter-spacing
text-transform text-overflow text-decoration-line white-space text-align vertical-align word-break
flex-grow flex-shrink flex-basis flex-direction flex-wrap align-items align-self align-content justify-content
gap row-gap column-gap order
transform transform-origin z-index box-shadow outline-width outline-style outline-color
text-rendering -webkit-font-smoothing pointer-events content mask-image -webkit-mask-image`.split(/\s+/).filter(Boolean));

const DEFAULTS = {
  'position': 'static', 'display': 'block', 'top': 'auto', 'left': 'auto', 'right': 'auto', 'bottom': 'auto',
  'min-width': '0px', 'min-height': '0px', 'max-width': 'none', 'max-height': 'none',
  'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px',
  'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
  'box-sizing': 'border-box', 'overflow-x': 'visible', 'overflow-y': 'visible',
  'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'background-size': 'auto',
  'background-repeat': 'repeat', 'background-position': '0% 0%',
  'opacity': '1', 'visibility': 'visible',
  'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px',
  'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
  'border-top-left-radius': '0px', 'border-top-right-radius': '0px',
  'border-bottom-left-radius': '0px', 'border-bottom-right-radius': '0px',
  'font-style': 'normal', 'font-variant': 'normal', 'text-transform': 'none', 'text-overflow': 'clip',
  'text-decoration-line': 'none', 'white-space': 'normal', 'text-align': 'start', 'vertical-align': 'baseline',
  'word-break': 'normal', 'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto',
  'flex-direction': 'row', 'flex-wrap': 'nowrap', 'align-items': 'normal', 'align-self': 'auto',
  'align-content': 'normal', 'justify-content': 'normal', 'gap': 'normal', 'row-gap': 'normal',
  'column-gap': 'normal', 'order': '0', 'transform': 'none', 'transform-origin': '',
  'z-index': 'auto', 'box-shadow': 'none', 'outline-style': 'none', 'outline-width': '0px',
  'text-rendering': 'auto', '-webkit-font-smoothing': 'auto', 'pointer-events': 'auto',
  'content': 'normal', 'mask-image': 'none', '-webkit-mask-image': 'none',
};

(async () => {
  const browser = await chromium.launch({
    executablePath: HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  });

  for (const state of ['A', 'B']) {
    const page = await browser.newPage({ viewport: { width: 500, height: 1000 } });
    const src = state === 'A' ? 'capture-state-a.raw.html' : 'capture-state-b.raw.html';
    await page.goto('file://' + __dirname + '/' + src);

    const html = await page.evaluate((args) => {
      const { state, SPECS_A, SPECS_B, STEERING_A, LIVING_A, LIVING_B, MOSS, CLAUDE, KEEP, DEFAULTS } = args;
      const keep = new Set(KEEP);
      const ROW = 22, HDR = 28, TITLE = 32;

      const panes = [...document.querySelectorAll('.split-view-view')];
      const paneOf = (i) => panes[i];
      const rowsBox = (p) => p.querySelector('.monaco-list-rows');
      const setLabel = (row, label, desc) => {
        const l = row.querySelector('.monaco-highlighted-label');
        if (l) l.textContent = label;
        const d = row.querySelector('.label-description');
        if (d) { if (desc) d.textContent = desc; else d.remove(); }
        const c = row.querySelector('.monaco-tl-contents');
        if (c) c.title = label;
        row.title = label;
        const cvl = row.querySelector('.custom-view-tree-node-item-resourceLabel, .monaco-icon-label');
        if (cvl) cvl.removeAttribute('aria-label');
      };

      /* ---------------- normalise the virtual list ---------------- */
      // monaco scrolls by offsetting .monaco-list-rows and pins the top group in a
      // sticky container. Undo both so the capture is a plain, unscrolled list.
      document.querySelectorAll('.monaco-list-rows').forEach(rb => {
        rb.style.top = '0px';
        rb.style.transform = 'none';
      });
      document.querySelectorAll('.monaco-tree-sticky-container').forEach(sc => {
        const row = sc.querySelector('.monaco-list-row');
        const list = sc.closest('.monaco-list');
        const rb = list && list.querySelector('.monaco-list-rows');
        if (row && rb) {
          const sib = rb.querySelector('.monaco-list-row');
          row.classList.remove('monaco-tree-sticky-row', 'passive-focused', 'focused', 'selected');
          if (sib) {
            ['position', 'left', 'width', 'height', 'box-sizing'].forEach(pr => {
              row.style.setProperty(pr, getComputedStyle(sib).getPropertyValue(pr));
            });
          }
          row.style.backgroundColor = 'transparent';
          row.style.top = '0px';
          rb.insertBefore(row, rb.firstChild);
        }
        sc.remove();
      });
      document.querySelectorAll('.shadow, .invisible.scrollbar').forEach(e => e.remove());
      // VS Code injects per-list <style> blocks that only reference --vscode-* variables
      // which do not exist outside the workbench. They out-specify the inlined styles and
      // would repaint the indent guides in currentColor, so drop them.
      document.querySelectorAll('#workbench\\.parts\\.sidebar style').forEach(e => e.remove());

      /* ---------------- Specs pane ---------------- */
      const specPane = paneOf(0);
      const specRows = rowsBox(specPane);
      if (state === 'A') {
        const rows = [...specRows.querySelectorAll('.monaco-list-row')];
        SPECS_A.forEach((spec, i) => {
          const r = rows[i];
          setLabel(r, spec[0], spec[1]);
          if (spec[4]) r.setAttribute('data-hook', spec[4]);
          r.style.top = (i * 22) + 'px';
        });
      } else {
        const byId = {};
        specRows.querySelectorAll('.monaco-list-row').forEach(r => byId[r.id] = r);
        const ordered = [];
        SPECS_B.forEach((spec, i) => {
          const r = byId[spec[0]];
          if (!r) { console.warn('missing ' + spec[0]); return; }
          setLabel(r, spec[1], spec[2]);
          if (spec[4]) { const ic = r.querySelector('.custom-view-tree-node-item-icon'); if (ic) ic.style.color = spec[4]; }
          if (spec[5]) r.setAttribute('data-hook', spec[5]);
          r.style.top = (i * 22) + 'px';
          r.style.backgroundColor = 'transparent';
          ordered.push(r);
        });
        // drop anything not in the target order, then reflow in visual order
        specRows.querySelectorAll('.monaco-list-row').forEach(r => { if (!ordered.includes(r)) r.remove(); });
        ordered.forEach(r => specRows.appendChild(r));
        // Completed (1) is collapsed in this state
        const done = specRows.querySelector('[data-hook="rwDone"] .monaco-tl-twistie');
        if (done) done.classList.add('collapsed');
      }

      /* ---------------- Steering pane ---------------- */
      const steerPane = paneOf(1);
      const steerRows = [...rowsBox(steerPane).querySelectorAll('.monaco-list-row')];
      const steerKeep = state === 'A' ? STEERING_A : steerRows.length;
      steerRows.forEach((r, i) => { if (i >= steerKeep) r.remove(); });
      // the two provider icons are vscode-file:// urls; inline them
      rowsBox(steerPane).querySelectorAll('.custom-view-tree-node-item-icon').forEach(ic => {
        const bg = ic.style.backgroundImage || '';
        if (bg.includes('moss.svg')) ic.style.backgroundImage = 'url("' + MOSS + '")';
        else if (bg.includes('claude.svg')) ic.style.backgroundImage = 'url("' + CLAUDE + '")';
      });

      /* ---------------- Living Specs pane ---------------- */
      const livePane = paneOf(2);
      const liveRows = [...rowsBox(livePane).querySelectorAll('.monaco-list-row')];
      const names = state === 'A' ? LIVING_A : LIVING_B;
      liveRows.forEach((r, i) => {
        if (i >= names.length) { r.remove(); return; }
        setLabel(r, names[i], r.querySelector('.label-description') ? 'drift' : '');
      });

      /* ---------------- resize every pane to its content ---------------- */
      const counts = [
        rowsBox(paneOf(0)).querySelectorAll('.monaco-list-row').length,
        rowsBox(paneOf(1)).querySelectorAll('.monaco-list-row').length,
        rowsBox(paneOf(2)).querySelectorAll('.monaco-list-row').length,
      ];
      let top = 0;
      const heights = [];
      counts.forEach((n, i) => {
        const bodyH = n * ROW, paneH = HDR + bodyH;
        const p = paneOf(i);
        p.style.top = top + 'px';
        p.style.height = paneH + 'px';
        p.querySelectorAll('.pane').forEach(e => e.style.height = paneH + 'px');
        p.querySelectorAll('.pane-body').forEach(e => e.style.height = bodyH + 'px');
        p.querySelectorAll('.monaco-list, .monaco-scrollable-element, .monaco-list-rows').forEach(e => e.style.height = bodyH + 'px');
        p.querySelectorAll('.scrollbar').forEach(e => e.remove());
        heights.push(paneH);
        top += paneH;
      });
      // Settings & Feedback pane sits last
      const settings = paneOf(3);
      settings.style.top = top + 'px';
      settings.style.height = HDR + 'px';
      settings.querySelectorAll('.pane').forEach(e => e.style.height = HDR + 'px');
      const total = top + HDR;

      ['.content', '.composite.viewlet', '.monaco-pane-view', '.monaco-split-view2',
       '.sash-container', '.split-view-container', '.monaco-scrollable-element'].forEach(sel => {
        document.querySelectorAll(sel).forEach(e => {
          if (e.closest('.split-view-view')) return;
          e.style.height = total + 'px';
        });
      });
      document.querySelectorAll('.empty-pane-message-area, .monaco-progress-container, .sash').forEach(e => e.remove());

      // stable hooks for the composition timeline
      ['specs', 'steering', 'living', 'settings'].forEach((n, i) => {
        if (panes[i]) panes[i].setAttribute('data-pane', n);
      });
      const vt = document.querySelector('.composite.title');
      if (vt) vt.setAttribute('data-hook', 'viewTitle');
      const ph = panes[0].querySelector('.pane-header');
      if (ph) ph.setAttribute('data-hook', 'specsHeader');

      const root = document.getElementById('workbench.parts.sidebar');
      root.style.height = (total + TITLE) + 'px';
      root.style.marginLeft = '0px';
      root.style.marginBottom = '0px';
      root.style.position = 'absolute';
      root.style.top = '0px';
      root.style.left = '0px';

      /* ---------------- prune inline styles ---------------- */
      const all = [root, ...root.querySelectorAll('*')];
      all.forEach(el => {
        const s = el.style;
        const out = [];
        for (let i = 0; i < s.length; i++) {
          const prop = s[i];
          if (!keep.has(prop)) continue;
          const v = s.getPropertyValue(prop);
          if (DEFAULTS[prop] !== undefined && DEFAULTS[prop] === v) continue;
          if (v === '' || v === 'normal' && prop === 'content') continue;
          out.push(prop + ':' + v);
        }
        el.setAttribute('style', out.join(';'));
        el.removeAttribute('aria-label'); el.removeAttribute('aria-level'); el.removeAttribute('aria-posinset');
        el.removeAttribute('aria-setsize'); el.removeAttribute('aria-selected'); el.removeAttribute('aria-expanded');
        el.removeAttribute('data-index'); el.removeAttribute('data-last-element'); el.removeAttribute('data-parity');
        el.removeAttribute('role'); el.removeAttribute('tabindex'); el.removeAttribute('draggable');
        el.removeAttribute('data-resource-name');
      });
      root.setAttribute('data-total-h', String(total + TITLE));
      return root.outerHTML;
    }, { state, SPECS_A, SPECS_B, STEERING_A, LIVING_A, LIVING_B, MOSS, CLAUDE, KEEP: [...KEEP], DEFAULTS });

    let out = html;
    REGRADE.forEach(([re, to]) => { out = out.replace(re, to); });
    // em dash guard
    if (out.includes('—')) { console.error('EM DASH SURVIVED in state ' + state); }
    fs.writeFileSync(process.argv[2] + '/sidebar-state-' + state.toLowerCase() + '.frag.html', out);
    console.log('state ' + state + ': ' + (out.length / 1024).toFixed(1) + ' KB');
    await page.close();
  }
  await browser.close();
})();
