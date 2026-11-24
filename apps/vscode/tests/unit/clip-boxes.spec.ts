import { execFileSync } from 'child_process';
import * as path from 'path';

const lib = path.join(__dirname, '..', '..', '..', '..', 'tooling', 'scripts', 'lib', 'clip-boxes.mjs');

/** The lib is an ES module and jest here is CommonJS, so each case runs in node and reports JSON. */
function run<T>(body: string): T {
    const out = execFileSync('node', [
        '--input-type=module',
        '-e',
        `import * as lib from ${JSON.stringify(lib)}; const out = (${body}); console.log(JSON.stringify(out ?? null));`,
    ], { encoding: 'utf8' });
    return JSON.parse(out) as T;
}

const html = `
<img class="shot" id="sh0" src="assets/captures/a.png" alt="" />
<img class="shot" id="sh1" src="assets/captures/b.png" alt="" />
<script>
  var BEATS = [
    {"t":3,"r":[10,20,100,40],"label":"First"},
    {"t":9,"r":[0,0,50,50],"label":"Second"},
    {"t":12,"rest":true}
  ];
  var CUTS = [
    {"t":6,"from":0,"to":1}
  ];
</script>`;

describe('clip box drift check', () => {
    describe('given a composition', () => {
        it('reads its beats, cuts and the capture file behind each shot', () => {
            const comp = run<{ beats: unknown[]; cuts: unknown[]; shots: string[] }>(`lib.readComposition(${JSON.stringify(html)})`);
            expect(comp.beats).toHaveLength(3);
            expect(comp.cuts).toHaveLength(1);
            expect(comp.shots).toEqual(['a.png', 'b.png']);
        });

        it('treats a hand-authored composition with no BEATS as having nothing to check', () => {
            expect(run(`lib.readComposition('<html></html>')`)).toBeNull();
        });

        it('reads an empty CUTS array as no cuts', () => {
            const comp = run<{ cuts: unknown[] }>(`lib.readComposition(${JSON.stringify(html.replace(/\{"t":6[^}]*\}/, ''))})`);
            expect(comp.cuts).toEqual([]);
        });
    });

    describe('which shot a beat is drawn over', () => {
        it('is the first shot before any cut', () => {
            expect(run(`lib.shotAtBeat({ t: 3 }, [{ t: 6, to: 1 }])`)).toBe(0);
        });

        it('is the cut target once the cut has happened', () => {
            expect(run(`lib.shotAtBeat({ t: 9 }, [{ t: 6, to: 1 }])`)).toBe(1);
        });

        it('counts a cut on the same second as the beat', () => {
            expect(run(`lib.shotAtBeat({ t: 6 }, [{ t: 6, to: 1 }])`)).toBe(1);
        });
    });

    describe('comparing a stored box with a measurement', () => {
        const box = `{ clip: 'review', beat: 0, label: 'Catch it', selector: '.slot', stored: [10, 20, 100, 40]`;

        it('passes a box that stayed put', () => {
            expect(run(`lib.describeDrift(${box}, measured: [10, 20, 100, 40] })`)).toBeNull();
        });

        it('passes a box that moved by exactly the tolerance', () => {
            expect(run(`lib.describeDrift(${box}, measured: [14, 24, 100, 40] })`)).toBeNull();
        });

        it('names the clip, the box and the edge for a box that moved 20px down', () => {
            const sentence = run<string>(`lib.describeDrift(${box}, measured: [10, 40, 100, 40] })`);
            expect(sentence).toContain('review beat 1 "Catch it" (.slot)');
            expect(sentence).toContain('moved 20px');
            expect(sentence).toContain('was [10, 20, 100, 40] now [10, 40, 100, 40]');
        });

        it('fails a box that grew taller even though its top edge held', () => {
            const sentence = run<string>(`lib.describeDrift(${box}, measured: [10, 20, 100, 60] })`);
            expect(sentence).toContain('bottom edge moved 20px');
        });

        it('reports a box whose element is gone', () => {
            expect(run<string>(`lib.describeDrift(${box}, measured: null })`)).toContain('element not found');
        });
    });
});
