import { buildMoreActions } from '../specsMoreActions';

const commands = (entries: ReturnType<typeof buildMoreActions>) =>
    entries.filter(e => !e.separator).map(e => e.command);

const separators = (entries: ReturnType<typeof buildMoreActions>) =>
    entries.filter(e => e.separator).map(e => e.label);

describe('buildMoreActions', () => {
    it('offers Collapse All while the tree is expanded', () => {
        const entries = buildMoreActions({
            allCollapsed: false,
            companionInstalled: true,
            speckitAvailable: false,
        });
        expect(entries.find(e => !e.separator)).toEqual({
            label: 'Collapse All',
            command: 'speckit.specs.collapseAll',
        });
    });

    it('offers Expand All while the tree is collapsed', () => {
        const entries = buildMoreActions({
            allCollapsed: true,
            companionInstalled: true,
            speckitAvailable: false,
        });
        expect(entries.find(e => !e.separator)).toEqual({
            label: 'Expand All',
            command: 'speckit.specs.expandAll',
        });
    });

    it('drops the maintenance section entirely when spec-kit is unavailable', () => {
        const entries = buildMoreActions({
            allCollapsed: true,
            companionInstalled: false,
            speckitAvailable: false,
        });
        expect(separators(entries)).toEqual(['View']);
        expect(commands(entries)).toEqual(['speckit.specs.expandAll']);
    });

    it('offers install and upgrade when spec-kit is available and the companion is not installed', () => {
        const entries = buildMoreActions({
            allCollapsed: false,
            companionInstalled: false,
            speckitAvailable: true,
        });
        expect(separators(entries)).toEqual(['View', 'Maintenance']);
        expect(commands(entries)).toEqual([
            'speckit.specs.collapseAll',
            'speckit.companion.installSpecKitExtension',
            'speckit.upgrade',
        ]);
    });

    it('drops install once the companion is installed but keeps upgrade', () => {
        const entries = buildMoreActions({
            allCollapsed: false,
            companionInstalled: true,
            speckitAvailable: true,
        });
        expect(commands(entries)).toEqual(['speckit.specs.collapseAll', 'speckit.upgrade']);
    });

    it('never offers more than one collapse affordance', () => {
        for (const allCollapsed of [true, false]) {
            const entries = buildMoreActions({
                allCollapsed,
                companionInstalled: false,
                speckitAvailable: true,
            });
            const toggles = commands(entries).filter(
                c => c === 'speckit.specs.collapseAll' || c === 'speckit.specs.expandAll'
            );
            expect(toggles).toHaveLength(1);
        }
    });
});
