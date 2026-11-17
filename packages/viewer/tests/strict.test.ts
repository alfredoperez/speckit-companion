import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// A strict consumer (Factory) compiles with unchecked index access forbidden; the package must too.
const pkg = join(__dirname, '..');
const tsc = join(__dirname, '../../../node_modules/.bin/tsc');

describe.each(['tsconfig.json', 'tsconfig.view.json'])('%s', (config) => {
    it('forbids unchecked index access and type-checks with zero errors', () => {
        expect(readFileSync(join(pkg, config), 'utf8')).toMatch(/"noUncheckedIndexedAccess":\s*true/);
        expect(() => execFileSync(tsc, ['--noEmit', '-p', join(pkg, config)], { encoding: 'utf8' })).not.toThrow();
    }, 120_000);
});
