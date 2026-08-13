/**
 * Renders a perfectly seamless looping equirectangular sky video from the
 * 4K NASA star plate.
 *
 * Seamlessness matters more than it sounds: a 360 sky that jumps on loop is
 * far more immersion-breaking than a still one. Every animated term below is
 * periodic over exactly LOOP_SECONDS, so frame 0 and frame N are identical.
 *
 *  - Horizontal sway: the plate is duplicated side by side and the crop window
 *    oscillates sinusoidally, so the wrap seam is never inside the view.
 *  - Luminance breathing: a very shallow sinusoid keeps the Milky Way from
 *    reading as a frozen photograph.
 *
 * Usage: node tools/build-sky-video.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const SOURCE = 'assets/sky/starmap-nasa-4k.jpg';
const OUTPUT = 'assets/sky/starmap-nasa-4k-loop.mp4';
const WIDTH = 4096;
const HEIGHT = 2048;
const LOOP_SECONDS = 24;
const FPS = 30;
const SWAY_PIXELS = 48;

// t is seconds; every expression completes a whole number of cycles per loop.
const angular = `(2*PI*t/${LOOP_SECONDS})`;
const cropX = `${WIDTH / 2}+${SWAY_PIXELS}*sin(${angular})`;
const brightness = `0.010*sin(${angular})`;

const filter = [
  `[0:v]scale=${WIDTH}:${HEIGHT},split=2[a][b]`,
  `[a][b]hstack=inputs=2[wide]`,
  `[wide]crop=${WIDTH}:${HEIGHT}:'${cropX}':0[swayed]`,
  `[swayed]eq=brightness='${brightness}':eval=frame[out]`
].join(';');

const args = [
  '-y',
  '-loop', '1',
  '-i', SOURCE,
  '-filter_complex', filter,
  '-map', '[out]',
  '-t', String(LOOP_SECONDS),
  '-r', String(FPS),
  '-an',
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-level', '5.2',
  '-pix_fmt', 'yuv420p',
  '-crf', '23',
  '-preset', 'medium',
  // Frequent keyframes keep loop restarts from stalling on a headset decoder.
  '-g', String(FPS * 2),
  '-movflags', '+faststart',
  OUTPUT
];

console.log('[sky-video] encoding…');
execFileSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });

const { size } = fs.statSync(OUTPUT);
console.log(`[sky-video] wrote ${OUTPUT} — ${(size / 1048576).toFixed(1)} MB`);
