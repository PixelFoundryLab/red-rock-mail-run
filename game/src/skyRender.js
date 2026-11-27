// Red Rock Mail Run: the sky. A gradient sunset dome with a low sun, warm
// directional light, hemisphere fill, distance fog and drifting cloud puffs.
// The dome follows the camera so the horizon never runs out.
import * as THREE from '../vendor/three.bundle.min.js';
import { CONFIG } from './config.js';
import { createRandom } from './random.js';

export function buildSky(scene, seed) {
  scene.fog = new THREE.Fog(0xe8b98a, 350, 2400);

  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-600, 380, 900);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9db8e8, 0x8a5a34, 1.1));

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(-0.45, 0.28, 0.68).normalize() } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir;
      void main() {
        float h = clamp(vDir.y, -0.25, 1.0);
        vec3 zenith = vec3(0.16, 0.32, 0.62);
        vec3 mid = vec3(0.55, 0.62, 0.85);
        vec3 horizon = vec3(1.0, 0.62, 0.32);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, zenith, smoothstep(0.2, 0.75, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.75, 0.4) * pow(s, 90.0) * 1.2;
        col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMat);
  scene.add(sky);

  // Cloud puffs, high over the mesas.
  const rand = createRandom(seed + 55);
  const T = CONFIG.terrain;
  const cloudSpots = [];
  for (let i = 0; i < 22; i += 1) {
    const bx = (rand() * 2 - 1) * 1000;
    const bz = T.zMin + rand() * (T.zMax - T.zMin);
    const by = 210 + rand() * 80;
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j += 1) {
      cloudSpots.push({
        x: bx + (rand() * 2 - 1) * 22,
        y: by + (rand() * 2 - 1) * 5,
        z: bz + (rand() * 2 - 1) * 12,
        s: 9 + rand() * 12,
      });
    }
  }
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 }),
    cloudSpots.length,
  );
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  cloudSpots.forEach((c, i) => {
    q.identity();
    sc.set(c.s, c.s * 0.45, c.s);
    m4.compose(new THREE.Vector3(c.x, c.y, c.z), q, sc);
    clouds.setMatrixAt(i, m4);
  });
  scene.add(clouds);

  return { sky };
}
