import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makeOverride, removeOverride } from '../stockOverride';

const CORE = '.specify/templates/spec-template.md';
const OVERRIDE = '.specify/templates/overrides/spec-template.md';

function write(root: string, rel: string, body: string): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
}

function project(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-override-'));
    write(root, CORE, '# Core spec\n');
    return root;
}

describe('making a template override', () => {
    it('creates the overrides folder and copies the file now in use', () => {
        const root = project();
        const result = makeOverride(root, CORE);

        expect(result).toEqual({ file: path.join(root, OVERRIDE) });
        expect(fs.readFileSync(path.join(root, OVERRIDE), 'utf8')).toBe('# Core spec\n');
    });

    it('refuses a path the board did not offer', () => {
        const root = project();
        expect(makeOverride(root, '../../etc/passwd')).toEqual({ error: expect.any(String) });
        expect(fs.existsSync(path.join(root, '.specify/templates/overrides'))).toBe(false);
    });
});

describe('removing a template override', () => {
    it('deletes nothing until the person confirms', async () => {
        const root = project();
        write(root, OVERRIDE, 'mine\n');
        const asked: string[] = [];

        const declined = await removeOverride(root, OVERRIDE, async file => { asked.push(file); return false; });
        expect(declined).toBeNull();
        expect(asked).toEqual([OVERRIDE]);
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(true);

        const done = await removeOverride(root, OVERRIDE, async () => true);
        expect(done).toEqual({ file: path.join(root, OVERRIDE) });
        expect(fs.existsSync(path.join(root, OVERRIDE))).toBe(false);
        expect(fs.existsSync(path.join(root, CORE))).toBe(true);
    });

    it('never removes a layer that is not an override', async () => {
        const root = project();
        const result = await removeOverride(root, CORE, async () => true);
        expect(result).toEqual({ error: expect.any(String) });
        expect(fs.existsSync(path.join(root, CORE))).toBe(true);
    });
});
