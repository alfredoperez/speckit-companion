import * as fs from 'fs';
import * as path from 'path';
import { CONTEXT_KEYS } from '../../../core/utils/contextKeys';

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf-8')
);

const commands: Array<{ command: string; title: string; icon?: string }> = manifest.contributes.commands;
const views: Array<{ id: string; name: string; when?: string; visibility?: string }> =
    manifest.contributes.views.speckit;
const viewTitle: Array<{ command?: string; submenu?: string; when: string; group: string }> =
    manifest.contributes.menus['view/title'];
const itemContext: Array<{ command?: string; submenu?: string; when: string; group: string }> =
    manifest.contributes.menus['view/item/context'];
const rowMenu: Array<{ command: string; when?: string; group: string }> =
    manifest.contributes.menus['speckit.specs.rowMenu'];
const titleMenu: Array<{ command: string; when?: string; group: string }> | undefined =
    manifest.contributes.menus['speckit.specs.titleMenu'];
const submenus: Array<{ id: string; label: string; icon?: string }> = manifest.contributes.submenus;
const commandPalette: Array<{ command: string; when?: string }> = manifest.contributes.menus.commandPalette;

const SPECS_VIEW = 'speckit.views.explorer';

function commandTitle(id: string): string | undefined {
    return commands.find(c => c.command === id)?.title;
}

function specsTitleActions(): Array<{ id: string; group: string }> {
    return viewTitle
        .filter(entry => entry.when.includes(`view == ${SPECS_VIEW}`))
        .map(entry => ({ id: (entry.command ?? entry.submenu)!, group: entry.group }));
}

/** The five lifecycle spec-row context values, as a `when`-clause regex fragment. */
const SPEC_ROW_WHEN = 'viewItem =~ /^spec-(active|tasks-done|implemented|completed|archived)$/';

describe('sidebar contributions', () => {
    describe('view names', () => {
        it('titles the four views for what they hold', () => {
            const byId = Object.fromEntries(views.map(v => [v.id, v.name]));
            expect(byId).toEqual({
                'speckit.views.explorer': 'Specs',
                'speckit.views.livingSpecs': 'Living Specs',
                'speckit.views.steering': 'Steering',
                'speckit.views.settings': 'Settings & Feedback',
            });
        });

        it('keeps the living-specs view gated on the companion extension and collapsed', () => {
            const living = views.find(v => v.id === 'speckit.views.livingSpecs')!;
            expect(living.visibility).toBe('collapsed');
            expect(living.when).toContain('speckit.companion.installed');
        });
    });

    describe('command titles', () => {
        it.each([
            ['speckit.create', 'New Spec'],
            ['speckit.specs.filter', 'Filter…'],
            ['speckit.specs.filter.clear', 'Clear Filter'],
            ['speckit.specs.sort', 'Sort…'],
            ['speckit.specs.collapseAll', 'Collapse All'],
            ['speckit.specs.expandAll', 'Expand All'],
            ['speckit.markCompleted', 'Mark Complete'],
            ['speckit.specs.setStatus', 'Set Status…'],
            ['speckit.group.markAllCompleted', 'Mark All Complete'],
            ['speckit.group.archiveAll', 'Archive All'],
            ['speckit.group.reactivateAll', 'Reactivate All'],
            ['speckit.steering.create', 'New Steering Document…'],
            ['speckit.specs.copyName', 'Copy Spec Name'],
            ['speckit.specs.copyPath', 'Copy Spec Path'],
            ['speckit.specs.revealInExplorer', 'Reveal in VS Code Explorer'],
            ['speckit.specs.reveal', 'Reveal in File Manager'],
            ['speckit.revealItemInExplorer', 'Reveal in VS Code Explorer'],
            ['speckit.revealItemInOS', 'Reveal in File Manager'],
            ['speckit.livingSpecs.drift', 'Check for Drift'],
            ['speckit.livingSpecs.adopt', 'Adopt Code Area…'],
            ['speckit.livingSpecs.sync', 'Sync living specs from my changes'],
            ['speckit.livingSpecs.refresh', 'Refresh Living Specs'],
            ['speckit.companion.installSpecKitExtension', 'Install Companion Extension'],
        ])('%s is titled "%s"', (id, title) => {
            expect(commandTitle(id)).toBe(title);
        });

        it('declares no emoji in any command title', () => {
            const emoji = /\p{Extended_Pictographic}/u;
            for (const c of commands) {
                expect(c.title).not.toMatch(emoji);
            }
        });
    });

    describe('specs title toolbar', () => {
        // The cap is the point: a title bar is the one place a command can be
        // added without anyone noticing it got crowded, so every addition is a
        // decision recorded here rather than a line in package.json.
        it('shows at most six buttons, in the target order', () => {
            // Collapse All and Expand All are the same button in two states, gated
            // on opposite when-clauses, so seven declarations render as six buttons.
            const actions = specsTitleActions();
            expect(actions.map(a => a.id)).toEqual([
                'speckit.refresh',
                'speckit.specs.filter',
                'speckit.specs.sort',
                'speckit.specs.collapseAll',
                'speckit.specs.expandAll',
                'speckit.companion.openPipelineBuilder',
                'speckit.create',
            ]);
            const exclusive = new Set(['speckit.specs.expandAll']);
            expect(actions.filter(a => !exclusive.has(a.id))).toHaveLength(6);
        });

        it('never shows Collapse All and Expand All at the same time', () => {
            const collapse = viewTitle.find(e => e.command === 'speckit.specs.collapseAll')!;
            const expand = viewTitle.find(e => e.command === 'speckit.specs.expandAll')!;
            expect(collapse.group).toBe(expand.group);
            expect(collapse.when).toContain('!speckit.specs.allCollapsed');
            expect(expand.when).toContain('speckit.specs.allCollapsed');
            expect(expand.when).not.toContain('!speckit.specs.allCollapsed');
        });

        it('expanding the tree is one click, with no menu to open first', () => {
            for (const id of ['speckit.specs.collapseAll', 'speckit.specs.expandAll']) {
                expect(specsTitleActions().some(a => a.id === id)).toBe(true);
                // The glyph is what says which action it will perform.
                expect(commands.find(c => c.command === id)!.icon).toBeTruthy();
            }
        });

        it('leaves the view with no overflow menu of its own', () => {
            // The view container already has one a few pixels away, and this one
            // existed to hold a single everyday action.
            expect(viewTitle.some(e => e.submenu === 'speckit.specs.titleMenu')).toBe(false);
            expect(submenus.some(sm => sm.id === 'speckit.specs.titleMenu')).toBe(false);
            expect(titleMenu).toBeUndefined();
        });

        it('gives Specs the Refresh its sibling views have', () => {
            expect(specsTitleActions()[0].id).toBe('speckit.refresh');
        });

        it('shows the pipeline builder only where its extension is installed', () => {
            const entry = viewTitle.find(
                e => e.command === 'speckit.companion.openPipelineBuilder')!;
            expect(entry.when).toContain('speckit.companion.installed');
        });

        it('places New Spec last', () => {
            const actions = specsTitleActions();
            const groups = actions.map(a => a.group);
            const createGroup = actions.find(a => a.id === 'speckit.create')!.group;
            expect(groups.every(g => g <= createGroup)).toBe(true);
        });

        it.each([
            'speckit.specs.filter.clear',
            'speckit.companion.installSpecKitExtension',
            'speckit.upgrade',
        ])('%s left the title bar but is still a contributed command', id => {
            expect(specsTitleActions().some(a => a.id === id)).toBe(false);
            expect(commands.some(c => c.command === id)).toBe(true);
        });

        it.each([
            'speckit.upgrade',
            'speckit.companion.installSpecKitExtension',
        ])('%s is still reachable, from the command palette', id => {
            expect(commandPalette.some(e => e.command === id && e.when !== 'false')).toBe(true);
        });

        it.each([
            'speckit.specs.collapseAll',
            'speckit.specs.expandAll',
            'speckit.upgrade',
            'speckit.specs.filter.clear',
        ])('%s stays reachable from the command palette', id => {
            const hidden = commandPalette.find(e => e.command === id && e.when === 'false');
            expect(hidden).toBeUndefined();
        });
    });

    describe('spec row menus', () => {
        const ROW_GROUPS = [
            ['speckit.specs.setStatus', '1_status'],
            ['speckit.markCompleted', '2_lifecycle'],
            ['speckit.archive', '2_lifecycle'],
            ['speckit.reactivate', '2_lifecycle'],
            ['speckit.specs.copyName', '3_copy'],
            ['speckit.specs.copyPath', '3_copy'],
            ['speckit.revealItemInExplorer', '4_reveal'],
            ['speckit.revealItemInOS', '4_reveal'],
            ['speckit.delete', '5_danger'],
        ] as const;

        it.each(ROW_GROUPS)('%s sits in the %s group of the hover submenu', (command, group) => {
            const entry = rowMenu.find(e => e.command === command);
            expect(entry).toBeDefined();
            expect(entry!.group.split('@')[0]).toBe(group);
        });

        it.each(ROW_GROUPS)('%s sits in the %s group of the right-click menu', (command, group) => {
            const entry = itemContext.find(
                e =>
                    e.command === command &&
                    e.when.includes(`view == ${SPECS_VIEW}`) &&
                    !e.when.includes('spec-group')
            );
            expect(entry).toBeDefined();
            expect(entry!.group.split('@')[0]).toBe(group);
        });

        it('presents the same commands, in the same order, on hover and on right-click', () => {
            const order = (entries: Array<{ command?: string; group: string }>) =>
                entries
                    .filter(e => e.command)
                    .slice()
                    .sort((a, b) => a.group.localeCompare(b.group))
                    .map(e => e.command);

            const hover = order(rowMenu);
            const right = order(
                itemContext.filter(
                    e =>
                        e.command &&
                        !e.group.startsWith('inline') &&
                        e.when.includes(`view == ${SPECS_VIEW}`) &&
                        !e.when.includes('spec-group') &&
                        !e.when.includes('spec-document') &&
                        !e.when.includes('spec-related-doc')
                )
            );
            expect(right).toEqual(hover);
        });

        it('isolates delete in the danger group and nowhere else', () => {
            const deletes = [...rowMenu, ...itemContext].filter(e => e.command === 'speckit.delete');
            expect(deletes.length).toBeGreaterThan(0);
            for (const entry of deletes) {
                expect(entry.group.split('@')[0]).toBe('5_danger');
            }
        });

        it('shows at most two inline actions on a spec row', () => {
            const inline = itemContext.filter(
                e => e.group.startsWith('inline') && e.when.includes(SPEC_ROW_WHEN)
            );
            const resume = itemContext.filter(
                e => e.command === 'speckit.specs.resume' && e.group === 'inline'
            );
            expect(inline.map(e => e.command ?? e.submenu)).toEqual(['speckit.specs.rowMenu']);
            expect(resume).toHaveLength(1);
        });
    });

    describe('lifecycle gates', () => {
        it('keeps Resume gated on active/tasks-done and the installed extension (no beta gate)', () => {
            const resume = itemContext.find(e => e.command === 'speckit.specs.resume')!;
            expect(resume.when).toBe(
                `view == ${SPECS_VIEW} && (viewItem == spec-active || viewItem == spec-tasks-done) && speckit.companion.installed`
            );
        });

        it.each([
            ['speckit.markCompleted', 'viewItem == spec-active || viewItem == spec-tasks-done || viewItem == spec-implemented'],
            ['speckit.archive', 'viewItem =~ /^spec-(active|tasks-done|implemented|completed)$/'],
            ['speckit.reactivate', 'viewItem == spec-completed || viewItem == spec-archived'],
        ])('%s keeps its lifecycle gate', (command, gate) => {
            const entry = itemContext.find(e => e.command === command && e.when.includes(`view == ${SPECS_VIEW}`))!;
            expect(entry.when).toContain(gate);
        });

        it.each([
            ['speckit.group.markAllCompleted', 'viewItem == spec-group-active'],
            ['speckit.group.archiveAll', 'viewItem == spec-group-active || viewItem == spec-group-completed'],
            ['speckit.group.reactivateAll', 'viewItem == spec-group-completed || viewItem == spec-group-archived'],
        ])('%s keeps its group gate', (command, gate) => {
            const entry = itemContext.find(e => e.command === command)!;
            expect(entry.when).toContain(gate);
        });
    });

    describe('reveal eligibility', () => {
        const REVEALABLE = [
            'living-specs-capability',
            'living-specs-tier',
            'living-specs-orphan',
            'steering-document',
            'steering-file',
            'provider-settings',
            'agent',
            'skill',
            'skill-warning',
            'speckit-constitution',
            'speckit-script',
            'speckit-template',
            'companion-config-item',
            'companion-command',
            'companion-template',
        ];

        const revealClauses = (command: string) =>
            itemContext.filter(e => e.command === command).map(e => e.when).join(' || ');

        it.each(REVEALABLE)('%s can be revealed in the VS Code explorer', contextValue => {
            expect(revealClauses('speckit.revealItemInExplorer')).toContain(contextValue);
        });

        it.each(REVEALABLE)('%s can be revealed in the file manager', contextValue => {
            expect(revealClauses('speckit.revealItemInOS')).toContain(contextValue);
        });

        it.each(['living-specs-capability-missing', 'living-specs-empty'])(
            '%s exposes no reveal action',
            contextValue => {
                for (const command of ['speckit.revealItemInExplorer', 'speckit.revealItemInOS']) {
                    for (const entry of itemContext.filter(e => e.command === command)) {
                        // A `viewItem == x` clause must not name the missing/empty value.
                        expect(entry.when).not.toContain(`viewItem == ${contextValue}`);
                    }
                }
            }
        );

        it('restricts destructive steering actions to generated steering documents', () => {
            const entries = itemContext.filter(e => e.command === 'speckit.steering.delete');
            expect(entries).toHaveLength(1);
            expect(entries[0].when).toContain('viewItem == steering-document');
        });
    });
});

describe('zero-spec merged welcome — viewsWelcome', () => {
    const viewsWelcome: Array<{ view: string; contents: string; when?: string }> =
        manifest.contributes.viewsWelcome;
    const zeroSpecBlocks = viewsWelcome.filter(
        w => w.view === SPECS_VIEW && w.contents.includes('Create your first spec')
    );

    it('renders one welcome block, not one per Companion state', () => {
        // The two variants differed only by a Companion install pitch, which the
        // activity-bar badge and the pinned CTA row already deliver on the same
        // screen. Three deliveries of one message is what read as pushy.
        expect(zeroSpecBlocks).toHaveLength(1);
        const [block] = zeroSpecBlocks;
        expect(block.when).toContain('speckit.detected');
        expect(block.when).toContain('!speckit.constitutionNeedsSetup');
        expect(block.when).not.toContain('speckit.companion.installed');
        expect(block.when).not.toContain('installNudgeDismissed');
    });

    it('pins both welcome actions verbatim in each variant', () => {
        for (const block of zeroSpecBlocks) {
            expect(block.contents).toContain('Create your first spec](command:speckit.create)');
            expect(block.contents).toContain('Open a live sample](command:speckit.openSampleSpec)');
        }
    });

    it('registers the sample command in contributes.commands', () => {
        expect(commandTitle('speckit.openSampleSpec')).toBeDefined();
    });
});

describe('Companion install nudge — viewsWelcome', () => {
    const viewsWelcome: Array<{ view: string; contents: string; when?: string }> =
        manifest.contributes.viewsWelcome;

    it('no longer delivers the install pitch a third time in the empty state', () => {
        // A fresh uninstalled workspace gave five asks in the first minute. The
        // badge and the pinned CTA row are ambient and stay; this one was the
        // same message again, in the space the welcome copy needed.
        const block = viewsWelcome.find(
            w => w.view === SPECS_VIEW && w.contents.includes('speckit.companion.installNudge')
        );
        expect(block).toBeUndefined();
    });

    it('keeps the install command, which the pinned CTA row still uses', () => {
        expect(commands.some(c => c.command === 'speckit.companion.installNudge')).toBe(true);
    });

    it('drops the dismiss command along with the block that was its only invoker', () => {
        expect(commands.some(c => c.command === 'speckit.companion.dismissInstallNudge'))
            .toBe(false);
    });
});

describe('Get Started walkthrough — contributes.walkthroughs', () => {
    interface WalkthroughStep {
        id: string;
        title: string;
        description?: string;
        when?: string;
        completionEvents?: string[];
        media: { markdown?: string; svg?: string; image?: string; altText?: string };
    }
    const walkthroughs: Array<{ id: string; title: string; description: string; steps: WalkthroughStep[] }> =
        manifest.contributes.walkthroughs;
    const steps = walkthroughs.flatMap(w => w.steps);
    const mediaPath = (step: WalkthroughStep) => step.media.markdown ?? step.media.svg ?? step.media.image;
    const repoRoot = path.join(__dirname, '../../../..');

    it('ships one walkthrough so the post-install Get Started page is not empty', () => {
        expect(walkthroughs).toHaveLength(1);
        expect(steps.length).toBeGreaterThan(0);
    });

    it('gives every step the id, title, and media the schema requires', () => {
        for (const step of steps) {
            expect(step.id).toBeTruthy();
            expect(step.title).toBeTruthy();
            expect(mediaPath(step)).toBeTruthy();
        }
        expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
    });

    it('uses exactly one media shape per step, with altText wherever the schema demands it', () => {
        for (const step of steps) {
            const shape = Object.keys(step.media).sort().join(',');
            expect(['markdown', 'altText,svg', 'altText,image']).toContain(shape);
        }
    });

    it('ships every media file it points at', () => {
        for (const step of steps) {
            expect(fs.existsSync(path.join(repoRoot, mediaPath(step)!))).toBe(true);
        }
    });

    it('only links commands the extension actually contributes', () => {
        const linked = steps
            .flatMap(step => [...(step.description ?? '').matchAll(/\]\(command:([^)?]+)/g)])
            .map(match => match[1].replace(/^toSide:/, ''))
            .filter(id => !id.startsWith('vscode.') && !id.startsWith('workbench.'));
        expect(linked.length).toBeGreaterThan(0);
        for (const id of linked) {
            expect(commandTitle(id)).toBeDefined();
        }
    });

    it('completes steps on commands and context keys the extension really sets', () => {
        const known = new Set(Object.values(CONTEXT_KEYS) as string[]);
        for (const event of steps.flatMap(s => s.completionEvents ?? [])) {
            if (event.startsWith('onCommand:')) {
                const id = event.slice('onCommand:'.length);
                if (id.startsWith('vscode.')) {
                    continue;
                }
                expect(commandTitle(id)).toBeDefined();
            } else if (event.startsWith('onContext:')) {
                const key = event.slice('onContext:'.length).split(/\s/)[0];
                if (key.startsWith('speckit.')) {
                    expect(known.has(key)).toBe(true);
                }
            }
        }
    });
});
