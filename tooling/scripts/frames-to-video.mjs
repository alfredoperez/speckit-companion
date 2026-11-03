#!/usr/bin/env node
// Turns one recording (<record dir>/<name>/: numbered PNG frames and recording.json) into an MP4, or a GIF preview, at the recording's own frame rate.
// usage: node tooling/scripts/frames-to-video.mjs <recording folder> <out.mp4|out.gif> [--width <px>] [--lossy <n>]
// The MP4 keeps every frame at full size, for a video tool to frame later. The GIF uses the same palette and gifsicle chain as build-clip-gifs.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [from, to] = process.argv.slice(2).filter((value, at, all) => !value.startsWith('--') && !all[at - 1]?.startsWith('--'));
const flag = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? Number(process.argv[at + 1]) : fallback;
};
if (!from || !to) {
    console.error('usage: node tooling/scripts/frames-to-video.mjs <recording folder> <out.mp4|out.gif> [--width <px>] [--lossy <n>]');
    process.exit(2);
}
const folder = resolve(from);
const out = resolve(to);
if (!existsSync(join(folder, 'recording.json'))) {
    console.error(`${folder} has no recording.json. Record it first with --record.`);
    process.exit(2);
}
const facts = JSON.parse(readFileSync(join(folder, 'recording.json'), 'utf8'));
const input = ['-framerate', String(facts.fps), '-i', join(folder, '%04d.png')];
const ffmpeg = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

if (out.endsWith('.mp4')) {
    // H.264 wants even sides; one row or column of padding at most.
    ffmpeg([...input, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
} else if (out.endsWith('.gif')) {
    const width = flag('width', Math.min(facts.width, 1200));
    const tmp = mkdtempSync(join(tmpdir(), 'frames-gif-'));
    const chain = `scale=${width}:-1:flags=lanczos`;
    try {
        ffmpeg([...input, '-vf', `${chain},palettegen=stats_mode=diff:max_colors=128`, join(tmp, 'pal.png')]);
        ffmpeg([...input, '-i', join(tmp, 'pal.png'), '-lavfi', `${chain}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, join(tmp, 'raw.gif')]);
        execFileSync('gifsicle', ['-O3', `--lossy=${flag('lossy', 30)}`, '--loop', join(tmp, 'raw.gif'), '-o', out]);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
} else {
    console.error('The output must end in .mp4 or .gif.');
    process.exit(2);
}
console.log(`${out}: ${facts.frames} frames at ${facts.fps} fps, ${(statSync(out).size / 1e6).toFixed(2)} MB`);
