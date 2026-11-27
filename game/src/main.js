// Red Rock Mail Run: boot and the one loop. It wires the systems together
// and steps them in order each frame: the flight model moves the plane, the
// mission list scores gates and drops, fuel and hull charge for the flying,
// and the rank keeps the record. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the scene renderer paints what is
// there. The game moves between title, play, paused, game over and win.
// ?seed=N fixes the canyon. ?shot=cover|takeoff|drop|landing (with &seed=N)
// stages that gameplay scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, CONFIG, STEP } from './config.js';
import { createTerrain } from './terrainGen.js';
import { createWind } from './weatherWind.js';
import { buildMissions, checkMissions, missionScore, nextMission } from './missionList.js';
import { createGameState } from './gameState.js';
import { stepPlane, EVENT_CRASH, EVENT_LANDED, EVENT_OVER } from './flightPhysics.js';
import { stepFuel, stepHull, resetFuelHullWarnings } from './damageFuel.js';
import { timeBonus, winSummary } from './pilotRank.js';
import { createSceneRenderer } from './sceneRender.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const screens = {
  title: document.getElementById('screen-title'),
  paused: document.getElementById('screen-paused'),
  over: document.getElementById('screen-over'),
  win: document.getElementById('screen-win'),
};
const titleBest = document.getElementById('title-best');
const overScore = document.getElementById('over-score');
const winScore = document.getElementById('win-score');
const winDetail = document.getElementById('win-detail');

// One canyon per day: the terrain, the route and the wind for a day.
function buildDay(day) {
  const terrain = createTerrain(seed + day * 1000);
  const wind = createWind(seed, day);
  const missions = buildMissions(terrain, day);
  const state = createGameState(seed, day, terrain, missions, wind);
  return state;
}

let state = buildDay(1);
let renderer = createSceneRenderer(canvas, state);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function showOnly(name) {
  for (const key of Object.keys(screens)) {
    screens[key].hidden = key !== name;
  }
}

// One fixed step of the whole game, systems in order.
function stepWorld(input) {
  const events = stepPlane(state, input, STEP);
  const done = checkMissions(state.missions, state.plane);
  for (const m of done) {
    state.score += missionScore(m);
    if (m.kind === 'ring') {
      audio.ring();
      const left = state.missions.rings.filter((r) => !r.passed).length;
      state.showMessage(
        left === 0
          ? 'ALL GATES FLOWN — LAND ON THE FAR RUNWAY'
          : `GATE ${m.index + 1} CLEAR  +${missionScore(m)}`,
      );
    } else {
      audio.drop();
      state.showMessage(`MAIL DELIVERED TO ${m.label}  +${missionScore(m)}`);
    }
  }
  stepFuel(state, input, STEP);
  stepHull(state, input, STEP, state.flags.scrape, state.flags.hardLanding);
  resetFuelHullWarnings(state);
  return events;
}

function runShot(name) {
  const scene = stageShot(name, state, (dt, input) => stepWorld(input));
  let best = readBest();
  if (scene.screen === 'win') best = Math.max(best, state.score);
  showOnly(null);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, STEP, state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;

  function announce(message) {
    status.textContent = message;
  }

  function refreshTitle() {
    if (titleBest) {
      titleBest.textContent =
        best > 0 ? `BEST SCORE ${best} · DAY ${state.day}` : 'FIRST RUN — GOOD LUCK, PILOT';
    }
  }

  function startGame(day) {
    if (day !== state.day) {
      state = buildDay(day);
      renderer = createSceneRenderer(canvas, state);
    } else {
      state.reset();
    }
    accumulator = 0;
    screen = 'play';
    showOnly(null);
    audio.resume();
    announce('Playing. Fly the gates, drop the mail, land the runway.');
  }

  function endGame(won) {
    if (won) {
      state.score += CONFIG.course.landingBonus + timeBonus(state);
      const summary = winSummary(state);
      if (summary.total > best) {
        best = summary.total;
        saveBest(best);
      }
      screen = 'win';
      if (winScore) winScore.textContent = `SCORE ${summary.total} · BEST ${best}`;
      if (winDetail) {
        winDetail.textContent =
          `${summary.rank} · ${summary.medal} MEDAL — ${summary.blurb} ` +
          `Route ${state.score - CONFIG.course.landingBonus - timeBonus(state)} + landing ${CONFIG.course.landingBonus} ` +
          `+ time ${timeBonus(state)} + fuel ${summary.fuelBonus} + hull ${summary.hullBonus}. ` +
          `Press D for Day ${state.day + 1}: stronger wind, tighter clock.`;
      }
      showOnly('win');
      audio.win();
      announce(`Mission complete. Rank ${summary.rank}.`);
    } else {
      if (state.score > best) {
        best = state.score;
        saveBest(best);
      }
      screen = 'over';
      if (overScore) overScore.textContent = `SCORE ${state.score} · BEST ${best}`;
      showOnly('over');
      announce(`Mission failed. Score ${state.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.resume();
      if (screen === 'title' || screen === 'over' || screen === 'win') startGame(state.day);
      else if (screen === 'paused') {
        screen = 'play';
        showOnly(null);
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        showOnly('paused');
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        showOnly(null);
        announce('Playing.');
      }
    }
    audio.setMuted(input.isMuted());
  }

  function step() {
    if (screen === 'title') return;
    const control = input.control();
    const events = stepWorld(control);
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_LANDED) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'win') {
      // Day 2: a new canyon, stronger wind, tighter clock.
      if (window.__nextDay) {
        window.__nextDay = false;
        startGame(state.day + 1);
      }
    }
    if (screen === 'title' || screen === 'play') {
      if (screen === 'play') {
        accumulator += dt;
        while (accumulator >= STEP) {
          step();
          accumulator -= STEP;
          if (screen !== 'play') {
            accumulator = 0;
            break;
          }
        }
      }
      const p = state.plane;
      audio.setEngine(p.throttle, Math.max(0, Math.min(1, p.speed / 135)), p.onGround);
    }
    renderer.draw(screen, dt, time);
  }

  // D on the win screen starts the next day.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyD' && screen === 'win') window.__nextDay = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      showOnly('paused');
      announce('Paused.');
    }
  });

  window.addEventListener('resize', () => renderer.resize());

  refreshTitle();
  showOnly('title');
  announce('Red Rock Mail Run. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
