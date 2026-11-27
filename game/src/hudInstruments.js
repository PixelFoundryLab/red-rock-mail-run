// Red Rock Mail Run: the instruments. Every number the pilot flies by,
// read off the state and painted into the DOM: altitude, speed, heading,
// score, route progress, lives, throttle, fuel, hull, wind, the artificial
// horizon, the next-job pointer and the route strip. Text is big and
// high-contrast so it still reads when the screenshot is shrunk to 768 px.
import * as THREE from '../vendor/three.bundle.min.js';
import { CONFIG } from './config.js';
import { nextMission, routeProgress } from './missionList.js';

const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    alt: $('hud-alt'),
    spd: $('hud-spd'),
    hdg: $('hud-hdg'),
    score: $('hud-score'),
    ring: $('hud-ring'),
    lives: $('hud-lives'),
    timer: $('hud-timer'),
    day: $('hud-day'),
    fuelFill: $('hud-fuel-fill'),
    fuelText: $('hud-fuel-text'),
    hullFill: $('hud-hull-fill'),
    hullText: $('hud-hull-text'),
    wind: $('hud-wind'),
    throttleFill: $('hud-throttle-fill'),
    horizonInner: $('hud-horizon-inner'),
    msg: $('hud-msg'),
    ringMarker: $('hud-ring-marker'),
    ringDist: $('hud-ring-dist'),
    routeStrip: $('hud-route-strip'),
    missionNext: $('hud-mission-next'),
  };

  // Build the route strip once: one box per job on the route, in order.
  let stripBoxes = [];
  function buildRouteStrip(route) {
    if (!el.routeStrip) return;
    el.routeStrip.innerHTML = '';
    stripBoxes = route.map((m) => {
      const box = document.createElement('span');
      box.className = 'route-box';
      box.textContent = m.kind === 'ring' ? String(m.index + 1) : m.label.split(' ')[1][0];
      box.title = m.label;
      el.routeStrip.appendChild(box);
      return box;
    });
  }

  const tmpV = new THREE.Vector3();

  function update(state, camera) {
    const s = state;
    const p = s.plane;
    const aglFt = Math.max(0, Math.round((p.y - s.terrain.terrainHeight(p.x, p.z)) * 3.281));
    const mslFt = Math.max(0, Math.round(p.y * 3.281));
    if (el.alt) el.alt.textContent = `${aglFt} FT AGL · ${mslFt} MSL`;
    if (el.spd) el.spd.textContent = `${Math.round(p.speed * 1.944)} KT`;
    const hdg = ((Math.round(p.heading) % 360) + 360) % 360;
    if (el.hdg) el.hdg.textContent = `${String(hdg).padStart(3, '0')}° ${DIRS[Math.round(hdg / 22.5) % 16]}`;
    if (el.score) el.score.textContent = String(s.score).padStart(6, '0');
    const mission = nextMission(s.missions);
    if (el.ring) {
      el.ring.textContent = mission ? `${mission.label} · ${s.missions.route.filter((m) => m.passed).length}/${s.missions.route.length}` : 'FINAL APPROACH';
    }
    if (el.lives) el.lives.textContent = `LIVES ${Math.max(0, s.lives)}`;
    if (el.timer) {
      const t = Math.floor(s.time);
      el.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
    if (el.day) el.day.textContent = `DAY ${s.day}`;
    const fh = s.fuelHull;
    if (el.fuelFill) {
      el.fuelFill.style.width = `${Math.round(fh.fuel)}%`;
      el.fuelFill.style.background = fh.fuel > 50 ? '#2fae6e' : fh.fuel > 25 ? '#ffd23e' : '#ff4a3a';
    }
    if (el.fuelText) el.fuelText.textContent = `FUEL ${Math.round(fh.fuel)}%`;
    if (el.hullFill) {
      el.hullFill.style.width = `${Math.round(fh.hull)}%`;
      el.hullFill.style.background = fh.hull > 60 ? '#2fae6e' : fh.hull > 35 ? '#ffd23e' : '#ff4a3a';
    }
    if (el.hullText) el.hullText.textContent = `HULL ${Math.round(fh.hull)}%`;
    const wind = s.wind.windAt(s.time);
    if (el.wind) el.wind.textContent = `WIND ${Math.round(wind.speed * 1.944)} KT ${DIRS[Math.round(wind.heading / 22.5) % 16]}`;
    if (el.throttleFill) el.throttleFill.style.width = `${Math.round(p.throttle * 100)}%`;
    if (el.horizonInner) {
      el.horizonInner.style.transform = `rotate(${-p.bank}deg) translateY(${p.pitch * 2.2}px)`;
    }
    if (el.msg) {
      el.msg.textContent = s.time < s.messageUntil ? s.message : '';
      el.msg.style.opacity = s.time < s.messageUntil ? '1' : '0';
    }
    // Route strip: done, current, todo.
    if (stripBoxes.length === 0 && s.missions.route.length > 0) buildRouteStrip(s.missions.route);
    stripBoxes.forEach((box, i) => {
      const m = s.missions.route[i];
      box.className = `route-box${m.passed ? ' done' : m === mission ? ' current' : ''}`;
    });
    if (el.missionNext) {
      el.missionNext.textContent = mission
        ? `NEXT: ${mission.label}${mission.kind === 'drop' ? ' — FLY LOW OVER THE OUTPOST' : ' — FLY THROUGH THE GATE'}`
        : 'NEXT: LAND ON THE FAR RUNWAY';
    }
    // Pointer to the next job: a marker at its screen position, or an arrow
    // at the screen edge when it is off-screen.
    if (el.ringMarker && mission) {
      tmpV.set(mission.x, mission.y, mission.z).project(camera);
      const behind = tmpV.z > 1;
      let nx = tmpV.x;
      let ny = tmpV.y;
      if (behind) {
        nx = -nx;
        ny = -ny;
      }
      const sx = (nx * 0.5 + 0.5) * window.innerWidth;
      const sy = (-ny * 0.5 + 0.5) * window.innerHeight;
      const dist = Math.round(Math.hypot(mission.x - p.x, mission.y - p.y, mission.z - p.z));
      const margin = 46;
      const cxp = clamp(sx, margin, window.innerWidth - margin);
      const cyp = clamp(sy, margin, window.innerHeight - margin);
      const offscreen = sx < margin || sx > window.innerWidth - margin || sy < margin || sy > window.innerHeight - margin || behind;
      el.ringMarker.style.left = `${cxp}px`;
      el.ringMarker.style.top = `${cyp}px`;
      el.ringMarker.style.opacity = '1';
      const ang = (Math.atan2(sy - cyp, sx - cxp) * 180) / Math.PI;
      el.ringMarker.style.transform = `translate(-50%, -50%) rotate(${offscreen ? ang : 0}deg)`;
      el.ringMarker.textContent = offscreen ? '➤' : '◎';
      if (el.ringDist) {
        el.ringDist.style.left = `${cxp}px`;
        el.ringDist.style.top = `${cyp + 26}px`;
        el.ringDist.style.opacity = '1';
        el.ringDist.textContent = `${dist} m · ${mission.label}`;
      }
    } else if (el.ringMarker) {
      el.ringMarker.style.opacity = '0';
      if (el.ringDist) el.ringDist.style.opacity = '0';
    }
  }

  return { update, buildRouteStrip };
}
