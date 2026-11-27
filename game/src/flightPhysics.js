// Red Rock Mail Run: the flight model. One fixed step of arcade flying:
// throttle and speed, bank and pitch toward the stick, banked turns, stall,
// the wind pushing the plane, take-off, runway touchdowns and terrain
// strikes. It moves the plane and reports what happened; it never draws.
import { CONFIG } from './config.js';
import { engineAlive, hullRollFactor, hullSpeedFactor } from './damageFuel.js';

export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_OVER = 8;

const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// One fixed step. `input` is { pitch, roll, throttleUp, throttleDown, boost }
// with pitch/roll in [-1, 1]. Returns an event mask.
export function stepPlane(state, input, dt) {
  if (state.finished || state.failed) return 0;
  let events = 0;
  state.time += dt;
  const p = state.plane;
  const P = CONFIG.plane;
  const alive = engineAlive(state);
  const speedFactor = hullSpeedFactor(state);
  const rollFactor = hullRollFactor(state);

  // Throttle (dead stick when the fuel is gone).
  if (alive) {
    if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.45, 0, 1);
    if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.6, 0, 1);
  } else {
    p.throttle = 0;
  }

  // Speed chases the throttle's target; drag grows with speed. A bent hull
  // costs top speed.
  const boost = input.boost && alive ? 1.25 : 1;
  const targetSpeed = (P.minSpeed + p.throttle * (P.maxSpeed - P.minSpeed)) * boost * speedFactor;
  const rate = p.onGround ? 0.55 : 0.85;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * rate);
  p.speed -= p.speed * p.speed * P.drag * 0.001 * dt * 60 * 0.016;
  p.speed = clamp(p.speed, 0, P.maxSpeed * 1.3);

  // Bank toward the stick, pitch toward the stick. Pitch also bites on the
  // ground: the pilot rotates (pulls up) before the wheels leave, so that
  // the moment the plane lifts off it is already climbing. If the pitch
  // were forced to zero on the ground, the vertical speed at lift-off
  // would be zero and the touchdown check in the same step would put the
  // plane straight back down — it could never take off at all.
  const targetBank = input.roll * P.maxBank;
  p.bank += clamp(targetBank - p.bank, -P.rollRate * rollFactor * dt, P.rollRate * rollFactor * dt);
  const airborne = !p.onGround;
  const targetPitch = input.pitch * P.maxPitch;
  p.pitch += clamp(targetPitch - p.pitch, -P.pitchRate * dt, P.pitchRate * dt);

  // Stall: too slow and the nose drops on its own.
  if (airborne && p.speed < P.minSpeed) {
    p.pitch += clamp(-18 - p.pitch, -P.pitchRate * dt, P.pitchRate * dt);
    if (p.speed < P.minSpeed - 6) state.showMessage('STALL — THROTTLE UP', 0.4);
  }

  // A banked turn: heading follows the bank.
  p.heading += p.bank * P.turnRate * dt;
  p.heading = ((p.heading + 540) % 360) - 180;

  // Ceiling: a soft push back down.
  if (p.y > 430) p.pitch = Math.min(p.pitch, -4);

  // Integrate the velocity, then let the wind shove the plane sideways.
  const hdg = p.heading * DEG;
  const pit = p.pitch * DEG;
  const fx = Math.sin(hdg) * Math.cos(pit);
  const fy = Math.sin(pit);
  const fz = -Math.cos(hdg) * Math.cos(pit);
  p.verticalSpeed = fy * p.speed;
  p.x += fx * p.speed * dt;
  p.y += fy * p.speed * dt;
  p.z += fz * p.speed * dt;
  const wind = state.wind.windAt(state.time);
  p.x += wind.x * dt * (airborne ? 1 : 0.15);
  p.z += wind.z * dt * (airborne ? 1 : 0.15);
  if (p.onGround) p.y = state.terrain.terrainHeight(p.x, p.z) + P.groundClearance;

  // Take-off: fast enough and pulling up lifts off the runway.
  if (p.onGround && p.speed > 48 && input.pitch > 0.15) {
    p.onGround = false;
    state.flying = true;
    state.showMessage('AIRBORNE — FLY THE MAIL ROUTE');
  }

  // Ground proximity: how close the belly is to the dirt.
  const ground = state.terrain.terrainHeight(p.x, p.z);
  const agl = p.y - ground;
  state.flags.scrape = airborne && agl < 5;
  if (airborne && agl < 18 && p.verticalSpeed < 0) state.showMessage('PULL UP — TERRAIN', 0.4);

  // Ground contact.
  state.flags.hardLanding = null;
  function crashPlane() {
    events |= EVENT_CRASH;
    state.lives -= 1;
    if (state.lives <= 0) {
      state.failed = true;
      events |= EVENT_OVER;
    } else {
      state.showMessage(`CRASH — ${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);
      respawn(state);
    }
  }
  if (!p.onGround && p.y < ground - 1) {
    // Buried in the terrain: the plane flew into the mountain. A crash,
    // however hard it is climbing — a climbing plane inside solid rock is
    // still inside solid rock. (The touchdown check below only fires when
    // the plane is settling onto the ground, so a steep climb out of a
    // valley never trips it, but flying *through* a ridge must.)
    crashPlane();
  } else if (!p.onGround && p.y <= ground + P.groundClearance && p.verticalSpeed <= 0.5) {
    const runway = state.terrain.runwayAt(p.x, p.z);
    const gentle = p.verticalSpeed > -9 && Math.abs(p.bank) < 25 && Math.abs(p.pitch) < 12 && p.speed < 95;
    if (runway && gentle) {
      // A runway touchdown: roll out on it. The finish runway, with the
      // route complete, ends the mission.
      p.onGround = true;
      p.y = ground + P.groundClearance;
      p.pitch = 0;
      p.bank = 0;
      const routeDone = state.missions.route.every((m) => m.passed);
      if (runway === 'finish' && routeDone) {
        state.finished = true;
        events |= EVENT_LANDED;
      } else if (runway === 'finish') {
        state.showMessage('TOUCH AND GO — MAIL STILL TO FLY');
      } else {
        state.showMessage('BACK ON THE RUNWAY — REFUELLED AND REPAIRED');
      }
    } else if (runway && p.verticalSpeed > -14 && p.speed < 130) {
      // A hard landing on the strip: the plane survives, bent. The hull
      // system reads flags.hardLanding and charges for it.
      state.flags.hardLanding = p.verticalSpeed;
      p.onGround = true;
      p.y = ground + P.groundClearance;
      p.pitch = 0;
      p.bank = 0;
      state.showMessage('HARD LANDING — HULL BENT');
    } else {
      // A terrain strike, or a touchdown far too hard or too fast.
      crashPlane();
    }
  }

  // Soft edge of the world: steer back toward the valley.
  if (Math.abs(p.x) > 1050 || p.z > 220 || p.z < -2220) {
    state.showMessage('TURN BACK — LEAVING THE CANYON', 0.4);
  }

  return events;
}

// Back in the air behind the last completed job, lined up on the route.
function respawn(state) {
  const p = state.plane;
  const done = state.missions.route.filter((m) => m.passed);
  const last = done[done.length - 1];
  if (last) {
    const tangent = state.terrain.courseTangent(last.z);
    p.x = last.x - tangent.x * 40;
    p.y = last.y + 12;
    p.z = last.z - tangent.z * 40;
    p.heading = (Math.atan2(tangent.x, -tangent.z) / DEG);
  } else {
    p.x = state.start.x;
    p.y = state.start.y + 60;
    p.z = state.start.z - 120;
    p.heading = 0;
  }
  p.pitch = 0;
  p.bank = 0;
  p.speed = 72;
  p.throttle = 0.55;
  p.onGround = false;
  p.verticalSpeed = 0;
  state.showMessage('BACK IN THE AIR — FLY THE NEXT JOB');
}
