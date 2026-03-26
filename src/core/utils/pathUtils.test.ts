import { convertPathIfWSL } from './pathUtils';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const originalEnv = { ...process.env };

afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    process.env = { ...originalEnv };
});

function setPlatform(value: string) {
    Object.defineProperty(process, 'platform', { value, configurable: true });
}

describe('convertPathIfWSL', () => {
    it('converts Windows path when WSL_DISTRO_NAME is set', () => {
        setPlatform('win32');
        process.env.WSL_DISTRO_NAME = 'Ubuntu';

        expect(convertPathIfWSL('C:\\Users\\foo\\file.txt')).toBe('/mnt/c/Users/foo/file.txt');
    });

    it('does not convert on native Windows (no WSL_DISTRO_NAME)', () => {
        setPlatform('win32');
        delete process.env.WSL_DISTRO_NAME;

        expect(convertPathIfWSL('C:\\Users\\foo\\file.txt')).toBe('C:\\Users\\foo\\file.txt');
    });

    it('does not convert on macOS', () => {
        setPlatform('darwin');
        delete process.env.WSL_DISTRO_NAME;

        expect(convertPathIfWSL('/Users/foo/file.txt')).toBe('/Users/foo/file.txt');
    });

    it('does not convert on Linux (non-WSL)', () => {
        setPlatform('linux');
        delete process.env.WSL_DISTRO_NAME;

        expect(convertPathIfWSL('/home/foo/file.txt')).toBe('/home/foo/file.txt');
    });

    it('handles different drive letters', () => {
        setPlatform('win32');
        process.env.WSL_DISTRO_NAME = 'Ubuntu';

        expect(convertPathIfWSL('D:\\Projects\\app')).toBe('/mnt/d/Projects/app');
    });
});
