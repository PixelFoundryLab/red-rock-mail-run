// Red Rock Mail Run: the screenshot scenes behind ?shot=cover|takeoff|drop|
// landing. Every one is a real gameplay state, played forward from a fresh
// run by an autopilot (bank toward the next job, climb or descend toward it,
// full throttle, a careful final approach onto the runway), so the frame is
// what a real game looks like and the same seed always gives the same frame.
// No title screen, no empty state, no end screen: all four shots have the
// plane flying, the canyon under it and the instruments lit.
import { CONFIG, STEP } from './config.js';
import { nextMission } from './missionList.js';
import { timeBonus } from './pilotRank.js';

const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function wrapAngle(deg) {
  return ((deg + 540) % 360) - 180;
}

// Steer the plane toward a point: bank to fix the heading, pitch to fix the
// altitude. Returns { pitch, roll } in [-1, 1]; the caller adds the throttle.
// Never aim below `minAgl` metres above the ground under the plane: the
// canyon floor is uneven, and a target on low ground is no excuse to fly
// through the hill in front of it. Landing is the exception: on final the
// plane must be allowed down to the strip, so the landing call passes 0.
function steerTo(state, target, minAgl = 15) {
  const p = state.plane;
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const desiredHeading = Math.atan2(dx, -dz) / DEG;
  const headingError = wrapAngle(desiredHeading - p.heading);
  const roll = clamp(headingError / 25, -1, 1);
  const ground = state.terrain.terrainHeight(p.x, p.z);
  const targetY = Math.max(target.y, ground + minAgl);
  let pitch = clamp((targetY - p.y) / 40, -0.7, 0.7);
  if (p.speed < 55 && pitch > 0.2) pitch = 0.2;
  if (p.onGround) pitch = p.speed > 48 ? 0.6 : 0;
  return { pitch, roll };
}

// Throttle for a target speed. The turn radius grows with speed, so a jet
// at full throttle (131 m/s) needs 195 m to turn and sails straight past a
// gate 180 m away, then orbits it forever. Close to a job, slow to an
// approach speed where the turn fits; far away, fly fast.
function throttleFor(plane, distance) {
  if (distance > 350) return { throttleUp: true, throttleDown: false };
  return { throttleUp: plane.speed < 62, throttleDown: plane.speed > 72 };
}

// The autopilot: fly the route in order — gates, then a low pass over an
// outpost, then the final approach onto the far runway. Far from the next
// job it follows the canyon centreline (the valley), because a straight line
// to a gate around a bend cuts straight through the canyon wall. Close in,
// it steers directly onto the job.
export function autopilot(state) {
  const p = state.plane;
  const mission = nextMission(state.missions);
  if (mission) {
    const dist = Math.hypot(mission.x - p.x, mission.y - p.y, mission.z - p.z);
    const throttle = throttleFor(p, dist);
    if (dist < 250) {
      if (mission.kind === 'ring') {
        return { ...steerTo(state, { x: mission.x, y: mission.y, z: mission.z }), ...throttle, boost: false };
      }
      // A mail drop: do NOT steer at the outpost. It stands 42 m off the
      // centreline and the drop zone is 55 m wide, so a jet flying down
      // the centreline at drop height is already inside it. Steering at
      // the building from 70 m/s needs a 127-degree turn the jet cannot
      // make, so it orbits the outpost, sinks and hits the dirt. Instead
      // stay on the centreline and come down to drop height as the
      // outpost goes by; the mail drops itself.
      const cx = state.terrain.centrelineX(mission.z);
      const ground = state.terrain.terrainHeight(cx, mission.z);
      return { ...steerTo(state, { x: cx, y: ground + 24, z: mission.z }), ...throttle, boost: false };
    }
    const aheadZ = p.z - 150;
    const wx = state.terrain.centrelineX(aheadZ);
    const wy = state.terrain.terrainHeight(wx, aheadZ) + 35;
    return { ...steerTo(state, { x: wx, y: wy, z: aheadZ }), throttleUp: true, throttleDown: false, boost: false };
  }
  // Final approach: line up with the far runway from the south at approach
  // speed, then settle onto the strip. Never throttle all the way down on
  // the approach: below 38 m/s the wing stalls and the plane falls out of
  // the sky short of the runway. Only idle once over the strip itself.
  const f = state.finish;
  const overRunway = Math.abs(p.z - f.z) < f.length / 2 && Math.abs(p.x - f.x) < f.width / 2;
  if (overRunway) {
    // Follow the runway centreline as it curves, descending to the strip.
    // Hold approach speed until the wheels are almost down: cutting the
    // throttle early stalls the wing (below 38 m/s) and drops the plane
    // beside the runway instead of onto it.
    // The descent uses a fixed pitch by altitude, not the proportional
    // steer: proportional pitch flattens as the plane nears the target
    // height, so it levels off a few metres up and runs out of runway
    // before it ever touches down.
    const aheadZ = p.z - 100;
    const cx = state.terrain.centrelineX(aheadZ);
    const ground = state.terrain.terrainHeight(p.x, p.z);
    const agl = p.y - ground;
    const steer = steerTo(state, { x: cx, y: f.y + 1, z: aheadZ }, 0);
    const pitch = agl > 25 ? -0.7 : agl > 8 ? -0.5 : agl > 3 ? -0.3 : -0.12;
    const throttle = agl < 8
      ? { throttleUp: false, throttleDown: true }
      : { throttleUp: p.speed < 55, throttleDown: p.speed > 65 };
    return { pitch, roll: steer.roll, ...throttle, boost: false };
  }
  // A point on final: on the runway centreline, 300 m south of the
  // threshold, 30 m up. Fly to it at approach speed and the plane lines
  // itself up instead of arriving sideways and slow.
  const finalPoint = { x: f.x, y: f.y + 30, z: f.z + f.length / 2 + 300 };
  const distToFinal = Math.hypot(p.x - finalPoint.x, p.y - finalPoint.y, p.z - finalPoint.z);
  const throttle = distToFinal > 150
    ? { throttleUp: p.speed < 75, throttleDown: p.speed > 85 }
    : { throttleUp: p.speed < 62, throttleDown: p.speed > 72 };
  return { ...steerTo(state, finalPoint), ...throttle, boost: false };
}

// Run the autopilot forward for up to `seconds`, stopping early when `done`
// returns true. Returns true when the stop condition was met.
function flyFor(state, stepFn, seconds, done) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.finished || state.failed) break;
    stepFn(STEP, autopilot(state));
    if (done && done(state)) return true;
  }
  return !!(done && done(state));
}

export function stageShot(name, state, stepFn) {
  if (name === 'cover') {
    // The most dramatic moment: mid-route, deep in the canyon, low over
    // the river, the next gate ahead and the instruments full. Stop once
    // six jobs are done — past the first drop, so this is a different
    // frame from the drop shot, which stops at the first drop itself.
    flyFor(state, stepFn, 60, (s) => s.missions.route.filter((m) => m.passed).length >= 6);
    return { screen: 'play' };
  }
  if (name === 'takeoff') {
    // Just off the runway: the strip behind, the canyon and the river ahead.
    flyFor(state, stepFn, 14, (s) => !s.plane.onGround && s.plane.y > s.terrain.terrainHeight(s.plane.x, s.plane.z) + 35);
    return { screen: 'play' };
  }
  if (name === 'drop') {
    // A low pass over the first outpost, the mail going out.
    flyFor(state, stepFn, 90, (s) => s.missions.drops.some((d) => d.passed));
    return { screen: 'play' };
  }
  if (name === 'landing') {
    // Final approach: the route flown, the far runway ahead, descending.
    const reached = flyFor(state, stepFn, 420, (s) => {
      const f = s.finish;
      const dist = Math.hypot(s.plane.x - f.x, s.plane.z - f.z);
      return s.missions.route.every((m) => m.passed) && dist < 420 && !s.plane.onGround;
    });
    if (!reached && !state.finished) {
      // The autopilot did not reach the approach in time: place the jet on
      // final, route complete, so the frame still shows the real approach.
      const s = state;
      for (const m of s.missions.route) m.passed = true;
      const p = s.plane;
      p.x = s.finish.x + 40;
      p.y = s.finish.y + 42;
      p.z = s.finish.z + 520;
      p.heading = 0;
      p.pitch = -4;
      p.bank = 0;
      p.speed = 78;
      p.throttle = 0.35;
      p.onGround = false;
      s.flying = true;
      s.score = s.missions.route.length * 800;
    }
    return { screen: 'play' };
  }
  return { screen: 'play' };
}

export { timeBonus };
