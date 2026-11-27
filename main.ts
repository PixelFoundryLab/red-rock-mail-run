// Red Rock Mail Run — a 3D flight game (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, Three.js vendored under game/vendor/, no library loaded
// from the network and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. The game: a bush pilot flies a sunset
// mail run through Red Rock Canyon — 8 glowing gates, mail drops over the Cedar, Juniper and
// Coyote outposts, then a landing on the far runway. Put 3 or 4 PNG or JPEG screenshots in
// screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files, in all, or a path under game/ over
// 1000 bytes: game/ counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json). Named here so the pre-flight checks below and the dossier build below can
// never disagree about the limits.
const TEXT_MAX_BYTES = 163840;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  throw new Error(`Red Rock Mail Run build failed: ${message}`);
}

// Count the files and bytes under a directory, walking it recursively, so the build can
// refuse an over-limit game/ before copying instead of handing the scorer a refused entry.
function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

// Pre-flight checks: fail early with a plain message when the entry cannot load or the
// scorer would refuse it, instead of copying a broken game and failing later.
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  fail('game/index.html is missing — the game has no entry page to load');
}
const gameTree = countTree(gameDir);
if (gameTree.files > GAME_MAX_FILES) {
  fail(`game/ holds ${gameTree.files} files, over the scorer's cap of ${GAME_MAX_FILES}`);
}
if (gameTree.bytes > GAME_MAX_BYTES) {
  fail(`game/ totals ${gameTree.bytes} bytes, over the scorer's cap of ${GAME_MAX_BYTES}`);
}
for (const entry of readdirSync(gameDir, { withFileTypes: true, recursive: true })) {
  const path = join(entry.parentPath ?? gameDir, entry.name);
  if (Buffer.byteLength(path) > GAME_PATH_MAX_BYTES) {
    fail(`a path under game/ is over ${GAME_PATH_MAX_BYTES} bytes: ${entry.name}`);
  }
}

const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile())
  : [];
if (shots.length === 0) {
  fail('screenshots/ is empty — the judge needs at least one screenshot, the first is the cover');
}
if (shots.length > SCREENSHOT_MAX) {
  fail(`screenshots/ holds ${shots.length} files, over the scorer's cap of ${SCREENSHOT_MAX}`);
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > SCREENSHOT_MAX_BYTES) {
    fail(`screenshot ${name} is ${size} bytes, over the scorer's cap of ${SCREENSHOT_MAX_BYTES}`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (shots.length > 0) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: GAME_PATH_MAX_BYTES,
  }),
);

console.log(
  `Red Rock Mail Run built: ${gameTree.files} game files (${gameTree.bytes} bytes), ` +
    `${shots.length} screenshots, dossier ${statSync(dossierPath).size} bytes at ${dossierPath}`,
);
