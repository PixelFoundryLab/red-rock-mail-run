// Red Rock Mail Run: the scene. It wires the render modules (sky, terrain,
// plane, route) into one Three.js scene and owns the chase camera: behind
// and above the jet in flight, slow orbit around it on the title screen.
// The HUD is painted by hudInstruments.
import * as THREE from '../vendor/three.bundle.min.js';
import { CONFIG } from './config.js';
import { buildSky } from './skyRender.js';
import { buildTerrainMeshes } from './terrainRender.js';
import { buildPlaneModel, buildBlobShadow } from './planeModel.js';
import { buildRouteMeshes } from './ringRender.js';
import { createHud } from './hudInstruments.js';

const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createSceneRenderer(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);

  const { sky } = buildSky(scene, state.seed);
  buildTerrainMeshes(scene, state.terrain, state.seed);
  const plane = buildPlaneModel();
  scene.add(plane.group);
  const shadow = buildBlobShadow();
  scene.add(shadow);
  const route = buildRouteMeshes(scene, state.missions);
  const hud = createHud();
  hud.buildRouteStrip(state.missions.route);

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  let camInit = false;

  function updateCamera(dt, screen, time) {
    const p = state.plane;
    if (screen === 'title') {
      const a = time * 0.12;
      camPos.set(p.x + Math.sin(a) * 26, p.y + 9, p.z + Math.cos(a) * 26);
      camera.position.lerp(camPos, 1 - Math.exp(-dt * 2));
      camera.lookAt(p.x, p.y + 1, p.z);
      camera.fov = 58;
      camera.updateProjectionMatrix();
      return;
    }
    const hdg = p.heading * DEG;
    const pit = p.pitch * DEG;
    const fx = Math.sin(hdg) * Math.cos(pit);
    const fy = Math.sin(pit);
    const fz = -Math.cos(hdg) * Math.cos(pit);
    tmpV.set(p.x - fx * 13, p.y - fy * 13 + 4.5, p.z - fz * 13);
    const groundBelow = state.terrain.terrainHeight(tmpV.x, tmpV.z) + 2.5;
    if (tmpV.y < groundBelow) tmpV.y = groundBelow;
    if (!camInit) {
      camera.position.copy(tmpV);
      camInit = true;
    } else {
      camera.position.lerp(tmpV, 1 - Math.exp(-dt * 5));
    }
    camTarget.set(p.x + fx * 24, p.y + fy * 24 + 0.5, p.z + fz * 24);
    camera.lookAt(camTarget);
    const speedNorm = clamp(p.speed / CONFIG.plane.maxSpeed, 0, 1);
    const targetFov = 62 + speedNorm * 12;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
  }

  function draw(screen, dt, time) {
    const s = state;
    const p = s.plane;
    plane.group.position.set(p.x, p.y, p.z);
    plane.group.rotation.order = 'YXZ';
    plane.group.rotation.y = -p.heading * DEG;
    plane.group.rotation.x = p.pitch * DEG;
    plane.group.rotation.z = p.bank * DEG;
    plane.glowMat.opacity = 0.15 + p.throttle * 0.45 + (p.speed > 100 ? 0.2 : 0);

    const ground = s.terrain.terrainHeight(p.x, p.z);
    const agl = Math.max(0, p.y - ground);
    shadow.position.set(p.x, ground + 0.4, p.z);
    const shScale = clamp(1 + agl * 0.012, 1, 2.4);
    shadow.scale.set(7 * shScale, 3.5 * shScale, 1);
    shadow.material.opacity = clamp(0.34 - agl * 0.002, 0.05, 0.34);

    route.update(s.missions, time);
    updateCamera(dt, screen, time);
    hud.update(s, camera);
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { draw, resize, renderer, scene, camera };
}
