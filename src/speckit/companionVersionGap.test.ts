import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    computeCompanionGap,
    parseManifestVersion,
    parseRegistryVersion,
    readBundledCompanionVersion,
    readInstalledCompanionVersion,
    resolveCompanionGap,
    cachedCompanionGap,
    refreshCompanionGap,
    markInstallInFlight,
    clearInstallInFlight,
    isInstallInFlight,
} from './companionVersionGap';

describe('companionVersionGap', () => {
    describe('parseManifestVersion', () => {
        it('reads extension.version from a manifest body', () => {
            expect(parseManifestVersion('extension:\n  id: companion\n  version: "0.21.0"\n')).toBe('0.21.0');
        });

        it('is unknown for a missing, non-semver or malformed manifest', () => {
            expect(parseManifestVersion('extension:\n  id: companion\n')).toBeUndefined();
            expect(parseManifestVersion('extension:\n  version: latest\n')).toBeUndefined();
            expect(parseManifestVersion('extension: [\n')).toBeUndefined();
            expect(parseManifestVersion('')).toBeUndefined();
        });
    });

    describe('parseRegistryVersion', () => {
        it('reads extensions.companion.version from the spec-kit registry', () => {
            expect(parseRegistryVersion('{"extensions":{"companion":{"version":"0.20.2"}}}')).toBe('0.20.2');
        });

        it('is unknown when the registry lacks the entry or is not JSON', () => {
            expect(parseRegistryVersion('{"extensions":{"git":{"version":"1.0.0"}}}')).toBeUndefined();
            expect(parseRegistryVersion('{"extensions":{"companion":{"version":42}}}')).toBeUndefined();
            expect(parseRegistryVersion('not json')).toBeUndefined();
        });
    });

    describe('computeCompanionGap', () => {
        it('is missing when the extension dir is absent, whatever the versions say', () => {
            expect(computeCompanionGap(false, '0.20.2', '0.21.0')).toEqual({ state: 'missing' });
        });

        it('is outdated only when the bundled version is newer than the installed one', () => {
            expect(computeCompanionGap(true, '0.20.2', '0.21.0')).toEqual({ state: 'outdated', installed: '0.20.2', expected: '0.21.0' });
            expect(computeCompanionGap(true, '0.21.0', '0.21.0')).toEqual({ state: 'current' });
            expect(computeCompanionGap(true, '0.22.0', '0.21.0')).toEqual({ state: 'current' });
        });

        it('reads an unknown version on either side as current, never as out of date', () => {
            expect(computeCompanionGap(true, undefined, '0.21.0')).toEqual({ state: 'current' });
            expect(computeCompanionGap(true, '0.20.2', undefined)).toEqual({ state: 'current' });
        });
    });

    describe('the cached gap', () => {
        it('re-resolves when the workspace changes instead of serving the previous folder answer', () => {
            const a = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-gap-a-'));
            const b = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-gap-b-'));
            try {
                fs.mkdirSync(path.join(b, '.specify/extensions/companion'), { recursive: true });
                expect(cachedCompanionGap(a, a).state).toBe('missing');
                expect(cachedCompanionGap(b, b).state).toBe('current');
                expect(cachedCompanionGap(a, a).state).toBe('missing');
            } finally {
                fs.rmSync(a, { recursive: true, force: true });
                fs.rmSync(b, { recursive: true, force: true });
            }
        });
    });

    describe('an install in flight', () => {
        it('masks the delete-then-create of a --force reinstall, so nothing downstream sees uninstalled', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-gap-flight-'));
            const ext = path.join(dir, '.specify/extensions/companion');
            try {
                fs.mkdirSync(ext, { recursive: true });
                expect(refreshCompanionGap(dir, dir)).toEqual({ gap: { state: 'current' }, masked: false });

                markInstallInFlight();
                fs.rmSync(ext, { recursive: true, force: true });
                // Every tick between the delete and the copy is masked, and the answer stays the installed one.
                for (let i = 0; i < 3; i++) {
                    expect(refreshCompanionGap(dir, dir)).toEqual({ gap: { state: 'current' }, masked: true });
                }

                fs.mkdirSync(ext, { recursive: true });
                expect(refreshCompanionGap(dir, dir)).toEqual({ gap: { state: 'current' }, masked: false });
                // Seeing the extension back is what ends the window — a masked tick must never end it.
                expect(isInstallInFlight()).toBe(false);

                fs.rmSync(ext, { recursive: true, force: true });
                expect(refreshCompanionGap(dir, dir)).toEqual({ gap: { state: 'missing' }, masked: false });
            } finally {
                clearInstallInFlight();
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('on disk', () => {
        let dir: string;
        beforeEach(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-gap-'));
        });
        afterEach(() => {
            fs.rmSync(dir, { recursive: true, force: true });
        });

        const write = (rel: string, body: string) => {
            const file = path.join(dir, rel);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, body);
        };

        it('reads the bundled version from the extension install path', () => {
            write('speckit-extension/extension.yml', 'extension:\n  version: "0.21.0"\n');
            expect(readBundledCompanionVersion(dir)).toBe('0.21.0');
            expect(readBundledCompanionVersion(path.join(dir, 'nowhere'))).toBeUndefined();
        });

        it('prefers the installed manifest (a --dev link keeps it current) and falls back to the registry', () => {
            write('.specify/extensions/.registry', '{"extensions":{"companion":{"version":"0.20.2"}}}');
            expect(readInstalledCompanionVersion(dir)).toBe('0.20.2');
            write('.specify/extensions/companion/extension.yml', 'extension:\n  version: "0.21.0"\n');
            expect(readInstalledCompanionVersion(dir)).toBe('0.21.0');
        });

        it('resolves the three states from real files', () => {
            // The bundled manifest ships inside the .vsix and never changes at runtime, so it is read once
            // per install path — write it before the first resolve or the memoized miss stands.
            write('speckit-extension/extension.yml', 'extension:\n  version: "0.21.0"\n');
            expect(resolveCompanionGap(dir, dir)).toEqual({ state: 'missing' });
            write('.specify/extensions/companion/extension.yml', 'extension:\n  version: "0.20.2"\n');
            expect(resolveCompanionGap(dir, dir)).toEqual({ state: 'outdated', installed: '0.20.2', expected: '0.21.0' });
            write('.specify/extensions/companion/extension.yml', 'extension:\n  version: "0.21.0"\n');
            expect(resolveCompanionGap(dir, dir)).toEqual({ state: 'current' });
        });
    });
});
