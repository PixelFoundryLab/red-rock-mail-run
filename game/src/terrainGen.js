// Red Rock Mail Run: the terrain. Pure logic, no rendering: the valley
// centreline, the canyon height field, the river channel and the flattened
// runway ground. The renderer and the flight model both read this.
import { CONFIG } from './config.js';
import { createNoise } from './noise.js';

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// The valley centreline: where the river runs, where the runways sit, where
// the mail gates hang. It snakes gently so the route is not a straight line.
export function centrelineX(z) {
  return 200 * Math.sin(z * 0.0012) + 80 * Math.sin(z * 0.0031 + 1.3);
}

// Course tangent (direction of travel, toward decreasing z) at a given z.
export function courseTangent(z) {
  const slope = 200 * 0.0012 * Math.cos(z * 0.0012) + 80 * 0.0031 * Math.cos(z * 0.0031 + 1.3);
  const len = Math.hypot(-slope, -1);
  return { x: -slope / len, y: 0, z: -1 / len };
}

export function createTerrain(seed) {
  const noise = createNoise(seed);
  const T = CONFIG.terrain;
  const R = CONFIG.runways;

  function runwayBlend(x, z) {
    let blend = 0;
    for (const r of [R.start, R.finish]) {
      const dz = Math.abs(z - r.z);
      const dx = Math.abs(x - centrelineX(z));
      const fz = 1 - smoothstep(r.length / 2, r.length / 2 + 90, dz);
      const fx = 1 - smoothstep(r.width / 2, r.width / 2 + 70, dx);
      blend = Math.max(blend, fz * fx);
    }
    return blend;
  }

  // Height of the ground at a point. Low in the valley, steep canyon walls,
  // high mesas, a river channel along the centreline, flat ground at the
  // runways.
  function terrainHeight(x, z) {
    const cx = centrelineX(z);
    const off = Math.abs(x - cx);
    const floor = T.floorHeight + noise.fbm(x * 0.004, z * 0.004, 3) * 6;
    const wall = smoothstep(120, 300, off);
    const mesa = T.mesaHeight + noise.fbm(x * 0.002 + 7.3, z * 0.002 + 2.1, 3) * 35;
    let h = floor + (mesa - floor) * wall;
    h += noise.fbm(x * 0.01, z * 0.01, 2) * 8 * wall;
    // A river channel carved along the centreline.
    const river = 1 - smoothstep(12, 42, off);
    h = lerp(h, 5, river * 0.9);
    // Flattened ground under both runways.
    return lerp(h, T.floorHeight, runwayBlend(x, z));
  }

  // True when a point lies on a runway strip (flat, safe to land on).
  function runwayAt(x, z) {
    for (const key of ['start', 'finish']) {
      const r = R[key];
      if (Math.abs(z - r.z) < r.length / 2 && Math.abs(x - centrelineX(z)) < r.width / 2) {
        return key;
      }
    }
    return null;
  }

  return { terrainHeight, centrelineX, courseTangent, runwayAt, noise };
}
