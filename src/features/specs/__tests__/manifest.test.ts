import * as fs from 'fs';
import * as path from 'path';

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf-8')
);

const commands: Array<{ command: string; title: string; icon?: string }> = manifest.contributes.commands;
const views: Array<{ id: string; name: string; when?: string; visibility?: string }> =
    manifest.contributes.views.speckit;
const viewTitle: Array<{ command: string; when: string; group: string }> =
    manifest.contributes.menus['view/title'];
const itemContext: Array<{ command?: string; submenu?: string; when: string; group: string }> =
    manifest.contributes.menus['view/item/context'];
const rowMenu: Array<{ command: string; when?: string; group: string }> =
    manifest.contributes.menus['speckit.specs.rowMenu'];
const commandPalette: Array<{ command: string; when?: string }> = manifest.contributes.menus.commandPalette;

const SPECS_VIEW = 'speckit.views.explorer';

function commandTitle(id: string): string | undefined {
    return commands.find(c => c.command === id)?.title;
}

function specsTitleActions(): Array<{ command: string; group: string }> {
    return viewTitle
        .filter(entry => entry.when.includes(`view == ${SPECS_VIEW}`))
        .map(({ command, group }) => ({ command, group }));
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
            ['speckit.specs.moreActions', 'More Actions…'],
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
        it('shows at most four actions, in the target order', () => {
            const actions = specsTitleActions();
            expect(actions).toHaveLength(4);
            expect(actions.map(a => a.command)).toEqual([
                'speckit.specs.filter',
                'speckit.specs.sort',
                'speckit.specs.moreActions',
                'speckit.create',
            ]);
        });

        it('places New Spec last', () => {
            const actions = specsTitleActions();
            const groups = actions.map(a => a.group);
            const createGroup = actions.find(a => a.command === 'speckit.create')!.group;
            expect(groups.every(g => g <= createGroup)).toBe(true);
        });

        it.each([
            'speckit.specs.filter.clear',
            'speckit.specs.collapseAll',
            'speckit.specs.expandAll',
            'speckit.companion.installSpecKitExtension',
            'speckit.upgrade',
        ])('%s left the title bar but is still a contributed command', id => {
            expect(specsTitleActions().some(a => a.command === id)).toBe(false);
            expect(commands.some(c => c.command === id)).toBe(true);
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
        it('keeps Resume gated on active/tasks-done, the beta flag, and the installed extension', () => {
            const resume = itemContext.find(e => e.command === 'speckit.specs.resume')!;
            expect(resume.when).toBe(
                `view == ${SPECS_VIEW} && (viewItem == spec-active || viewItem == spec-tasks-done) && speckit.resumeBeta && speckit.companion.installed`
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
