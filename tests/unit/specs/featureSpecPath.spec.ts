import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    featureSpecName,
    featureSpecPath,
    isFeatureSpecFile,
    resolveStepFile,
} from '../../../src/features/specs/featureSpecPath';

const FIXTURE = path.resolve(__dirname, '../../fixtures/named-spec/012-offline-queue');
const specifyStep = { name: 'specify', label: 'Specification', command: 'speckit.specify', file: 'spec.md' };

describe('featureSpecPath', () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-spec-')); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it('finds the named spec in the fixture and routes the specify step to it', () => {
        expect(featureSpecName(FIXTURE)).toBe('offline-queue.spec.md');
        expect(featureSpecPath(FIXTURE)).toBe(path.join(FIXTURE, 'offline-queue.spec.md'));
        expect(resolveStepFile(FIXTURE, specifyStep)).toBe('offline-queue.spec.md');
    });

    it('prefers the new name when both are present', () => {
        fs.writeFileSync(path.join(tmp, 'spec.md'), '# old');
        fs.writeFileSync(path.join(tmp, 'offline-queue.spec.md'), '# new');
        expect(featureSpecName(tmp)).toBe('offline-queue.spec.md');
    });

    it('falls back to spec.md, present or not', () => {
        fs.writeFileSync(path.join(tmp, 'spec.md'), '# old');
        expect(featureSpecName(tmp)).toBe('spec.md');
        expect(featureSpecName(path.join(tmp, 'missing'))).toBe('spec.md');
    });

    it('leaves other step files alone', () => {
        expect(resolveStepFile(FIXTURE, { name: 'plan', label: 'Plan', command: 'x', file: 'plan.md' })).toBe('plan.md');
        expect(resolveStepFile(FIXTURE, { name: 'design', label: 'Design', command: 'x' })).toBe('design.md');
    });

    it('recognises both spellings of the spec file', () => {
        expect(isFeatureSpecFile('spec.md')).toBe(true);
        expect(isFeatureSpecFile('offline-queue.spec.md')).toBe(true);
        expect(isFeatureSpecFile('plan.md')).toBe(false);
    });
});
