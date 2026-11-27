// Red Rock Mail Run: the game state. One object holds everything a run is:
// the plane, the fuel and hull, the missions, the wind, the score and the
// day. The systems in the other files read and write it; nothing else keeps
// a copy, so the renderer, the HUD and the physics always agree.
import { CONFIG } from './config.js';
import { createFuelHull } from './damageFuel.js';

export function createGameState(seed, day, terrain, missions, wind) {
  const R = CONFIG.runways;
  const start = {
    x: terrain.centrelineX(R.start.z),
    y: CONFIG.terrain.floorHeight,
    z: R.start.z,
    length: R.start.length,
    width: R.start.width,
  };
  const finish = {
    x: terrain.centrelineX(R.finish.z),
    y: CONFIG.terrain.floorHeight,
    z: R.finish.z,
    length: R.finish.length,
    width: R.finish.width,
  };

  const state = {
    seed,
    day,
    time: 0,
    score: 0,
    lives: CONFIG.lives,
    flying: false,
    finished: false,
    failed: false,
    terrain,
    missions,
    wind,
    fuelHull: createFuelHull(),
    start,
    finish,
    plane: {
      x: start.x,
      y: start.y + CONFIG.plane.groundClearance,
      z: start.z,
      heading: 0,
      pitch: 0,
      bank: 0,
      speed: 0,
      throttle: 0,
      onGround: true,
      verticalSpeed: 0,
    },
    message: '',
    messageUntil: 0,
    // Set fresh by the physics step each frame: scrape = within 5 m of
    // terrain, hardLanding = touchdown vertical speed (null when airborne).
    flags: { scrape: false, hardLanding: null },
  };

  state.showMessage = function showMessage(text, seconds = 2.5) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  };

  // Back to the start runway for another try at the same canyon.
  state.reset = function reset() {
    state.time = 0;
    state.score = 0;
    state.lives = CONFIG.lives;
    state.flying = false;
    state.finished = false;
    state.failed = false;
    state.message = '';
    state.messageUntil = 0;
    state.fuelHull = createFuelHull();
    for (const m of state.missions.route) {
      m.passed = false;
      if (m.prevAlong !== undefined) m.prevAlong = null;
    }
    const p = state.plane;
    p.x = start.x;
    p.y = start.y + CONFIG.plane.groundClearance;
    p.z = start.z;
    p.heading = 0;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 0;
    p.throttle = 0;
    p.onGround = true;
    p.verticalSpeed = 0;
    state.flags.scrape = false;
    state.flags.hardLanding = null;
  };

  return state;
}
