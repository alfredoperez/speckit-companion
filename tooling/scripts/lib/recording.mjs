// Records a piece of footage as numbered PNG frames plus one JSON file of facts about it, for the video tool that consumes them.
// A capture script takes --record <dir> and hands each recording a grab function; nothing here knows about video, timing curves or camera moves.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Every recording runs at this rate, and the JSON says so, so the consumer plays the frames back at the speed they were taken.
export const FPS = 12;
// A scroll that reads well on screen is too fast on film. Every recorded scroll moves this far per frame — about 190 pixels a second — and no step picks its own speed.
export const SCROLL_PX_PER_FRAME = 16;
// How long a recording holds still at a state worth reading, so the cut has somewhere to land.
export const HOLD_SECONDS = 1;

export function recordDir(argv = process.argv) {
    const at = argv.indexOf('--record');
    return at > -1 && argv[at + 1] ? resolve(argv[at + 1]) : undefined;
}

/** A PNG's pixel size, read from its IHDR chunk. */
function pngSize(file) {
    const header = readFileSync(file).subarray(16, 24);
    return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

/**
 * Opens one recording under <dir>/<name>/.
 * grab(file) writes one frame; flush() is awaited before the JSON is written, for a grab that defers its drawing.
 * `what` is one plain sentence about what is on screen and what to notice — prose, never a shot instruction.
 */
export function startRecording(dir, name, { surface, what, fps = FPS, grab, flush }) {
    const folder = join(dir, name);
    mkdirSync(folder, { recursive: true });
    const files = [];
    // Frames are held apart by the frame rate, so a cheap grab does not race ahead of what is happening on the surface.
    let due = Date.now();
    const pace = async () => {
        const wait = due - Date.now();
        if (wait > 0) await new Promise(done => setTimeout(done, wait));
        due = Math.max(Date.now(), due) + 1000 / fps;
    };
    const recording = {
        name,
        get frames() {
            return files.length;
        },
        /** One frame. */
        async frame() {
            await pace();
            const file = join(folder, `${String(files.length + 1).padStart(4, '0')}.png`);
            await grab(file);
            files.push(file);
        },
        /** The same picture held for this many seconds. */
        async hold(seconds = HOLD_SECONDS) {
            for (let left = Math.round(seconds * fps); left > 0; left--) await recording.frame();
        },
        async close() {
            await flush?.();
            if (!files.length) throw new Error(`the recording "${name}" has no frames`);
            const { width, height } = pngSize(files[0]);
            const facts = { name, surface, fps, width, height, frames: files.length, what };
            writeFileSync(join(folder, 'recording.json'), `${JSON.stringify(facts, null, 2)}\n`);
            console.log(`film ${name}: ${files.length} frames at ${fps} fps, ${width}x${height}`);
            return facts;
        },
    };
    return recording;
}
