#!/usr/bin/env python3
"""Fold the repeated inline styles produced by build.cjs into .sbs* classes.

A computed-style dump repeats the same declaration block on hundreds of
elements. Hoisting the duplicates into classes takes the two fragments from
about 710 KB to about 175 KB with a pixel-identical render.

Step two of three: build.cjs -> dedupe.py -> sync.py.
"""
import re, os, collections, sys
OUT = os.path.dirname(os.path.abspath(__file__)) + '/'
frags = {}
for s in ['a', 'b']:
    frags[s] = open(OUT + 'sidebar-state-%s.frag.html' % s).read()

counter = collections.Counter()
for t in frags.values():
    counter.update(re.findall(r'style="([^"]*)"', t))

table = {}
css = []
for i, (style, n) in enumerate(counter.most_common()):
    if not style:
        continue
    cls = 'sbs%d' % i
    table[style] = cls
    decl = style.replace('&quot;', '\"').replace('&#39;', "'").replace('&amp;', '&')
    css.append('.%s{%s}' % (cls, decl))

def rewrite(t):
    def sub(m):
        whole, cls_attr, style = m.group(0), m.group('cls'), m.group('style')
        c = table.get(style)
        if not c:
            return whole
        if cls_attr is None:
            return whole.replace('style="%s"' % style, 'class="%s"' % c)
        return whole.replace('style="%s"' % style, '').replace('class="%s"' % cls_attr, 'class="%s %s"' % (cls_attr, c))
    # match a full tag
    def tagsub(m):
        tag = m.group(0)
        sm = re.search(r'\sstyle="([^"]*)"', tag)
        if not sm:
            return tag
        c = table.get(sm.group(1))
        if not c:
            return tag
        tag = tag[:sm.start()] + tag[sm.end():]
        cm = re.search(r'\sclass="([^"]*)"', tag)
        if cm:
            tag = tag[:cm.start()] + ' class="%s %s"' % (cm.group(1), c) + tag[cm.end():]
        else:
            tag = tag[:-1].rstrip() + ' class="%s">' % c
        return tag
    return re.sub(r'<[a-zA-Z][^>]*>', tagsub, t)

total = 0
for s, t in frags.items():
    r = rewrite(t)
    open(OUT + 'state-%s.html' % s, 'w').write(r)
    total += len(r)
    print(s, len(t), '->', len(r))
open(OUT + 'sidebar.css', 'w').write('\n'.join(css))
print('css', len(''.join(css)), 'rules', len(css), 'grand total', total + len(''.join(css)))
