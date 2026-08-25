#!/usr/bin/env python3
"""Re-inject the built sidebar states and their stylesheet into index.html.

Pipeline, in order:
    node assets/sidebar/build.cjs assets/sidebar     # capture -> pruned fragment
    python3 assets/sidebar/dedupe.py                 # inline styles -> .sbs* classes
    python3 assets/sidebar/sync.py                   # fragment + css -> index.html

Colours in the generated CSS are rewritten to the --vs-* / --accent-* tokens
declared in index.html's :root, so a re-skin reaches the sidebar too.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
HF = os.path.abspath(os.path.join(HERE, '..', '..'))
IDX = os.path.join(HF, 'index.html')

TOKENISE = [
    (r'rgba\(199, 199, 199, ([0-9.]+)\)', r'rgba(var(--vs-fg-rgb),\1)'),
    (r'rgb\(199, 199, 199\)',             'var(--vs-fg-bright)'),
    (r'rgba\(84, 84, 84, ([0-9.]+)\)',    r'rgba(var(--vs-title-rgb),\1)'),
    (r'rgb\(84, 84, 84\)',                'var(--vs-fg-title)'),
    (r'rgb\(14, 14, 14\)',                'var(--vs-sidebar)'),
    (r'rgb\(19, 19, 19\)',                'var(--vs-row-sticky)'),
    (r'rgb\(20, 20, 20\)',                'var(--vs-editor)'),
    (r'rgb\(169, 220, 118\)',             'var(--accent-pass)'),
    (r'rgb\(120, 220, 232\)',             'var(--accent-run)'),
    (r'rgb\(255, 216, 102\)',             'var(--accent-cost)'),
    (r'rgba\(152, 162, 181, 0\.08\)',     'rgba(var(--vs-fg-rgb),0.08)'),
]

def tokenise(css):
    for a, b in TOKENISE:
        css = re.sub(a, b, css)
    return css

fragA = open(os.path.join(HERE, 'state-a.html')).read().strip()
fragB = open(os.path.join(HERE, 'state-b.html')).read().strip()
css = tokenise(open(os.path.join(HERE, 'sidebar.css')).read())

s = open(IDX).read()

# The two states are siblings of #vsSidebar rather than children of it, because
# beat 4 lands the rows BEFORE the sidebar ground fades in and a hidden parent
# would take the rows with it.
HOST = ('          <div id="vsSidebar"></div>\n'
        '          <!-- state A: everything collapsed. beat 4\'s establishing shot. -->\n'
        '          <div class="sbcap" id="sbA" data-layout-ignore>' + fragA + '</div>\n'
        '          <!-- state B: 041 expanded. beat 5\'s close-up. -->\n'
        '          <div class="sbcap" id="sbB" data-layout-ignore>' + fragB + '</div>\n')
a = s.index('          <div id="vsSidebar">')
b = s.index('          <!-- four specs: folder in beat 3')
s = s[:a] + HOST + s[b:]

CSSHEAD = '      /* ================================================================\n         CAPTURED SIDEBAR STYLES.'
a = s.index(CSSHEAD)
b = s.index('    </style>')
s = s[:a] + CSSHEAD + ''' Generated: assets/sidebar/build.cjs lifts
         the tree out of VS Code with every computed style inlined, then
         assets/sidebar/dedupe.py folds the repeated declarations into these
         .sbs* classes and assets/sidebar/sync.py drops them in here. The
         colours were rewritten to reference the --vs-* / --accent-* tokens
         above, so a re-skin reaches this too.
         Do not hand-edit; run the three scripts again.
         ================================================================ */
''' + css + '\n' + s[b:]

open(IDX, 'w').write(s)
print('synced: index.html is now %.1f KB' % (len(s) / 1024))
