// Red Rock Mail Run: fuel and hull. The two dials that make flying a
// choice instead of a hold-the-button exercise.
//  - Fuel burns with throttle and twice as fast on the afterburner. Empty
//    means the engine quits and the pilot glides; landing on a runway
//    refuels.
//  - Hull bends on hard touchdowns, on scraping the canyon and on sustained
//    high-G banks. A bent plane is slower and lazier to roll. Landing on a
//    runway repairs it.
// Both are repaired/refuelled only on a runway, so a careless pilot pays in
// time as well as in metal.
import { CONFIG } from './config.js';

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createFuelHull() {
  return {
    fuel: CONFIG.fuel.capacity,
    hull: CONFIG.hull.max,
    fuelLowWarned: false,
    fuelEmptyWarned: false,
    hullWarned: false,
  };
}

// Burn fuel for one step. Returns true when the engine just quit.
export function stepFuel(state, input, dt) {
  const F = CONFIG.fuel;
  const fh = state.fuelHull;
  if (state.plane.onGround && state.plane.speed < 5) {
    // Parked on a runway: refuel and repair while the pilot sits.
    const onRunway = state.terrain.runwayAt(state.plane.x, state.plane.z);
    if (onRunway) {
      fh.fuel = Math.min(F.capacity, fh.fuel + 34 * dt);
      fh.hull = Math.min(CONFIG.hull.max, fh.hull + 30 * dt);
      return false;
    }
  }
  const burn = F.burnIdle + state.plane.throttle * F.burnThrottle + (input.boost ? F.burnBoost : 0);
  fh.fuel = Math.max(0, fh.fuel - burn * dt);
  if (fh.fuel <= F.lowWarn && !fh.fuelLowWarned) {
    fh.fuelLowWarned = true;
    state.showMessage('LOW FUEL — EASE OFF OR LAND TO REFUEL', 3);
  }
  if (fh.fuel <= F.emptyWarn && !fh.fuelEmptyWarned) {
    fh.fuelEmptyWarned = true;
    state.showMessage('FUEL CRITICAL — GLIDE TO A RUNWAY', 3);
  }
  const justQuit = fh.fuel <= 0 && state.plane.throttle > 0;
  if (justQuit) state.showMessage('ENGINE OUT — GLIDING', 3);
  return justQuit;
}

// Hull damage from one step of rough handling. `scrape` is true when the
// plane is within 5 m of terrain, `hardLanding` the touchdown's vertical
// speed. Returns the damage dealt this step.
export function stepHull(state, input, dt, scrape, hardLandingSpeed) {
  const H = CONFIG.hull;
  const fh = state.fuelHull;
  let damage = 0;
  if (scrape) damage += H.scrape * dt;
  if (Math.abs(state.plane.bank) > 55) damage += H.highG * dt;
  if (state.plane.speed < CONFIG.plane.minSpeed && !state.plane.onGround) {
    damage += H.stallShake * dt;
  }
  if (hardLandingSpeed !== null && hardLandingSpeed < -9) {
    damage += H.hardLanding;
    state.showMessage('HARD LANDING — HULL BENT', 2.5);
  }
  if (damage > 0) {
    fh.hull = Math.max(0, fh.hull - damage);
    if (fh.hull <= 35 && !fh.hullWarned) {
      fh.hullWarned = true;
      state.showMessage('HULL 35% — LAND ON A RUNWAY TO REPAIR', 3);
    }
  }
  return damage;
}

// How much of the plane's performance the hull has left, 0..1.
export function hullSpeedFactor(state) {
  const H = CONFIG.hull;
  return H.minSpeedFactor + (1 - H.minSpeedFactor) * (state.fuelHull.hull / H.max);
}

export function hullRollFactor(state) {
  const H = CONFIG.hull;
  return H.minRollFactor + (1 - H.minRollFactor) * (state.fuelHull.hull / H.max);
}

// True when the engine can run (fuel left).
export function engineAlive(state) {
  return state.fuelHull.fuel > 0;
}

// Reset the low-fuel and hull warnings after a refuel/repair.
export function resetFuelHullWarnings(state) {
  const fh = state.fuelHull;
  if (fh.fuel > CONFIG.fuel.lowWarn) fh.fuelLowWarned = false;
  if (fh.fuel > CONFIG.fuel.emptyWarn) fh.fuelEmptyWarned = false;
  if (fh.hull > 40) fh.hullWarned = false;
}

export { clamp };
