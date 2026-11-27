// Red Rock Mail Run: the wind. Gusts swing direction every few seconds and
// push the plane sideways; they grow stronger each day, so the same canyon
// flies differently tomorrow. The HUD shows the wind the pilot is fighting.
import { CONFIG } from './config.js';
import { createRandom } from './random.js';

const DEG = Math.PI / 180;

export function createWind(seed, day) {
  const rand = createRandom(seed + 777);
  const W = CONFIG.wind;
  const baseSpeed = W.baseSpeed + (day - 1) * W.perDay;
  const gustStrength = W.gustStrength + (day - 1) * W.perDay;
  // A slow sequence of gust headings, one per swing, fixed for the day.
  const gusts = [];
  for (let i = 0; i < 64; i += 1) {
    gusts.push({
      heading: rand() * 360,
      strength: 0.4 + rand() * 0.6,
    });
  }

  // Wind vector (m/s, x and z) at a moment in the flight.
  function windAt(time) {
    const slot = Math.floor(time / W.changeSeconds) % gusts.length;
    const next = (slot + 1) % gusts.length;
    const t = (time % W.changeSeconds) / W.changeSeconds;
    const smooth = t * t * (3 - 2 * t);
    const g = gusts[slot];
    const h = gusts[next];
    // Blend the gust heading the short way around the compass.
    let dh = h.heading - g.heading;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const heading = (g.heading + dh * smooth) * DEG;
    const strength = (g.strength + (h.strength - g.strength) * smooth) * gustStrength;
    const speed = baseSpeed + strength;
    return {
      x: Math.sin(heading) * speed,
      z: -Math.cos(heading) * speed,
      speed,
      heading: Math.round(((heading / DEG) % 360 + 360) % 360),
    };
  }

  return { windAt, baseSpeed, gustStrength };
}
