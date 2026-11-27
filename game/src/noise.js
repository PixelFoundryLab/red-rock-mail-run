// Deterministic value noise (2D) built on a seeded RNG: smooth, repeatable
// bumps for the terrain. No library, no network, same seed, same mountains.
import { createRandom } from './random.js';

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function createNoise(seed) {
  const rand = createRandom(seed);
  // A 256-entry permutation table, hashed so lattice points are stable.
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function lattice(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }

  // Value noise in [-1, 1] at one octave.
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fz = smooth(z - iz);
    const a = lattice(ix, iz) * 2 - 1;
    const b = lattice(ix + 1, iz) * 2 - 1;
    const c = lattice(ix, iz + 1) * 2 - 1;
    const d = lattice(ix + 1, iz + 1) * 2 - 1;
    const ab = a + (b - a) * fx;
    const cd = c + (d - c) * fx;
    return ab + (cd - ab) * fz;
  }

  // Fractal noise: a few octaves, higher ones quieter, normalised near [-1, 1].
  function fbm(x, z, octaves = 3) {
    let value = 0;
    let amplitude = 0.55;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i += 1) {
      value += noise(x * frequency, z * frequency) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2.1;
    }
    return value / total;
  }

  return { noise, fbm };
}
