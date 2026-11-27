// Red Rock Mail Run: the pilot's record. Score, time bonus, rank and
// medals: the numbers a run is judged by, and the reason to fly it again.
// Rank is earned, not bought: it weighs rings and drops, the clock, and how
// much fuel and hull the pilot brings home.
import { CONFIG } from './config.js';

export const RANKS = [
  { min: 0, name: 'ROOKIE', blurb: 'The canyon forgives beginners. Once.' },
  { min: 6000, name: 'BUSH PILOT', blurb: 'Steady hands, steady throttle.' },
  { min: 11000, name: 'CANYON ACE', blurb: 'The outposts know your engine note.' },
  { min: 16000, name: 'LEGEND OF RED ROCK', blurb: 'They will tell this run for years.' },
];

export function timeBonus(state) {
  // Later days pay the time bonus out faster: the clock matters more.
  const perSecond = CONFIG.course.timeBonusPerSecond * (1 + (state.day - 1) * 0.25);
  return Math.max(0, CONFIG.course.timeBonusStart - Math.floor(state.time) * perSecond);
}

// Rank for a finished run, from the score plus what the pilot brings home.
export function rankFor(state) {
  const fh = state.fuelHull;
  const bonus = Math.round(fh.fuel * 12) + Math.round(fh.hull * 8);
  const total = state.score + bonus;
  let rank = RANKS[0];
  for (const r of RANKS) if (total >= r.min) rank = r;
  return { rank, total, fuelBonus: Math.round(fh.fuel * 12), hullBonus: Math.round(fh.hull * 8) };
}

// Medal for the clock alone: gold needs a fast, clean run. The bar tightens
// each day, so the same canyon demands more tomorrow.
export function medalFor(state) {
  const tighten = (state.day - 1) * 20;
  if (state.time <= 240 - tighten) return 'GOLD';
  if (state.time <= 330 - tighten) return 'SILVER';
  return 'BRONZE';
}

// One line for the win screen.
export function winSummary(state) {
  const { rank, total, fuelBonus, hullBonus } = rankFor(state);
  const medal = medalFor(state);
  return {
    rank: rank.name,
    blurb: rank.blurb,
    medal,
    total,
    score: state.score,
    timeBonus: timeBonus(state),
    fuelBonus,
    hullBonus,
  };
}
