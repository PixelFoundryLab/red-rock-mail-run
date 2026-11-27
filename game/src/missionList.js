// Red Rock Mail Run: the mail route. Three kinds of job on one run:
// fly the eight glowing gates, drop the mail low over three outposts, then
// land on the far runway. The route is the planning: gates and drops hang
// along the valley in order, and the HUD's route strip shows them all.
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;

export function buildMissions(terrain, day) {
  const C = CONFIG.course;
  // Gates hang over the valley, following the centreline, one per stretch.
  const rings = [];
  for (let i = 0; i < C.rings; i += 1) {
    const z = C.firstRingZ - i * C.ringSpacing;
    const cx = terrain.centrelineX(z);
    const y = terrain.terrainHeight(cx, z) + C.ringHeightAboveFloor[i];
    const tangent = terrain.courseTangent(z);
    rings.push({
      kind: 'ring',
      index: i,
      label: `GATE ${i + 1}`,
      x: cx,
      y,
      z,
      nx: tangent.x,
      ny: tangent.y,
      nz: tangent.z,
      radius: C.ringRadius - Math.min(3, (day - 1) * 1.5),
      passed: false,
      prevAlong: null,
    });
  }
  // Outposts: a few buildings on the valley floor where the mail goes.
  // Fly low over one and the mail drops itself.
  const dropZ = [-560, -1080, -1560];
  const drops = dropZ.map((z, i) => {
    const cx = terrain.centrelineX(z);
    const side = i % 2 === 0 ? 1 : -1;
    return {
      kind: 'drop',
      index: i,
      label: `OUTPOST ${['CEDAR', 'JUNIPER', 'COYOTE'][i]}`,
      x: cx + side * 42,
      y: terrain.terrainHeight(cx + side * 42, z),
      z,
      radius: C.dropRadius,
      maxAgl: C.dropMaxAgl,
      passed: false,
    };
  });
  // The route in order: gates and drops interleaved by distance.
  const route = [...rings, ...drops].sort((a, b) => b.z - a.z);
  route.forEach((m, i) => {
    m.order = i + 1;
  });
  return { rings, drops, route };
}

// The next job on the route (the one the pointer and the strip highlight).
export function nextMission(missions) {
  for (const m of missions.route) if (!m.passed) return m;
  return null;
}

// How far along the route the pilot is, 0..1.
export function routeProgress(missions) {
  const done = missions.route.filter((m) => m.passed).length;
  return done / missions.route.length;
}

// Check the plane against the next gate and any drop zone. Returns a list of
// completed missions this step (their scores are added by the caller).
export function checkMissions(missions, plane) {
  const done = [];
  const ring = missions.rings.find((r) => !r.passed);
  if (ring) {
    const along = (plane.x - ring.x) * ring.nx + (plane.y - ring.y) * ring.ny + (plane.z - ring.z) * ring.nz;
    if (ring.prevAlong !== null && (ring.prevAlong > 0) !== (along > 0)) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dz = plane.z - ring.z;
      const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
      if (radial < ring.radius * 0.9) {
        ring.passed = true;
        done.push(ring);
      }
    }
    ring.prevAlong = along;
  }
  for (const drop of missions.drops) {
    if (drop.passed) continue;
    const dx = plane.x - drop.x;
    const dz = plane.z - drop.z;
    const horizontal = Math.hypot(dx, dz);
    const agl = plane.y - drop.y;
    if (horizontal < drop.radius && agl < drop.maxAgl && agl > 2 && !plane.onGround) {
      drop.passed = true;
      done.push(drop);
    }
  }
  return done;
}

export function missionScore(mission) {
  return mission.kind === 'ring' ? CONFIG.course.ringScore : CONFIG.course.dropScore;
}
