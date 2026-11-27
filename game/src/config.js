// Red Rock Mail Run: tuning for the world, the plane, the course and the
// systems that make flying it a choice (fuel, hull, wind, mail drops).
// All distances are metres, speeds metres per second, angles degrees.
// Display converts to knots / feet / compass degrees.
export const CONFIG = {
  // The valley the mail route follows. The centreline snakes with z; the
  // terrain is low near it (the canyon floor) and rises to mesas away from it.
  terrain: {
    halfX: 1200,
    zMin: -2300,
    zMax: 300,
    segmentsX: 160,
    segmentsZ: 180,
    valleyHalfWidth: 130,
    wallHeight: 150,
    mesaHeight: 175,
    floorHeight: 10,
  },
  // Start runway (take-off) and finish runway (landing). Both are flattened
  // into the terrain and sit on the valley centreline.
  runways: {
    start: { z: 60, length: 340, width: 46, heading: 0 },
    finish: { z: -2050, length: 500, width: 48, heading: 0 },
  },
  plane: {
    minSpeed: 38, // below this the wing stops flying and the nose drops
    maxSpeed: 135,
    accel: 26, // m/s^2 at full throttle
    drag: 0.12,
    maxBank: 62, // degrees of roll
    maxPitch: 28, // degrees of pitch
    rollRate: 150, // degrees per second toward the target bank
    pitchRate: 110,
    turnRate: 0.62, // heading degrees per second per degree of bank
    climbFactor: 0.9,
    groundClearance: 2.2,
  },
  // Fuel: the throttle discipline. Full throttle and the afterburner drink
  // it; a careful pilot reaches the far runway with fuel to spare, a
  // wasteful one glides in on fumes. Landing on either runway refuels.
  fuel: {
    capacity: 100,
    burnIdle: 0.25, // per second at throttle 0
    burnThrottle: 1.05, // per second at throttle 1 (added to idle)
    burnBoost: 1.6, // extra per second while the afterburner is lit
    lowWarn: 25,
    emptyWarn: 8,
  },
  // Hull: rough handling bends the airframe. Hard touchdowns, scraping the
  // canyon walls and sustained high-G banks all cost hull; a bent plane is
  // slower and lazier. Landing on a runway repairs it.
  hull: {
    max: 100,
    hardLanding: 16, // vertical speed below -9 m/s on a runway
    scrape: 6, // flying within 5 m of terrain
    highG: 2.5, // per second banked past 55 degrees
    stallShake: 4, // per second stalled
    minSpeedFactor: 0.72, // at 0 hull the plane keeps 72% of its speed
    minRollFactor: 0.6, // at 0 hull the roll rate keeps 60%
  },
  // Wind: gusts push the plane and grow with the day. Day 1 is calm; later
  // days blow harder across the canyon.
  wind: {
    baseSpeed: 2, // m/s on day 1
    gustStrength: 3, // m/s of gust on day 1
    perDay: 2.5, // extra m/s of base and gust each later day
    changeSeconds: 9, // how often the gust direction swings
  },
  // The mail route: 8 gates, 3 outpost drops, one landing.
  course: {
    rings: 8,
    ringRadius: 20,
    ringSpacing: 250,
    firstRingZ: -220,
    ringHeightAboveFloor: [52, 64, 46, 72, 58, 80, 50, 62],
    ringScore: 1000,
    drops: 3, // outposts to fly low over and drop the mail
    dropRadius: 55, // metres from the outpost centre
    dropMaxAgl: 42, // must be this low over the ground to drop
    dropScore: 500,
    landingBonus: 5000,
    timeBonusStart: 8000,
    timeBonusPerSecond: 12,
  },
  lives: 3,
};

export const BEST_KEY = 'red-rock-mail-run-best';
export const STEP = 1 / 60;
