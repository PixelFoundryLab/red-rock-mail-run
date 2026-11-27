// Red Rock Mail Run: the terrain as the player sees it. The heightfield
// mesh with strata-coloured vertices, the river ribbon, the two runways with
// their markings, and instanced trees, rocks and a windsock — all seeded,
// so the same canyon looks the same every run.
import * as THREE from '../vendor/three.bundle.min.js';
import { CONFIG } from './config.js';
import { createNoise } from './noise.js';
import { createRandom } from './random.js';

// Ground colour by height and strata banding: sand in the valley, banded
// red rock on the canyon walls, pale mesa with scrub on top.
function terrainColor(x, z, h, fbm) {
  const c = new THREE.Color();
  const sand = new THREE.Color(0xd9b380);
  const wet = new THREE.Color(0x9a7a52);
  const rockA = new THREE.Color(0xb85c38);
  const rockB = new THREE.Color(0x7e3b26);
  const mesa = new THREE.Color(0xc98d5f);
  const scrub = new THREE.Color(0x6b7a44);
  const pale = new THREE.Color(0xd8a878);
  if (h < 13) {
    c.copy(sand).lerp(wet, Math.max(0, Math.min(0.7, (13 - h) / 6)));
  } else if (h < 55) {
    const band = 0.5 + 0.5 * Math.sin(h * 0.35 + fbm(x * 0.02, z * 0.02, 2) * 2.2);
    c.copy(rockA).lerp(rockB, band * 0.7);
  } else if (h < 120) {
    const band = 0.5 + 0.5 * Math.sin(h * 0.3 + fbm(x * 0.03, z * 0.03, 2) * 2.5);
    c.copy(rockB).lerp(mesa, band * 0.55);
  } else if (h < 175) {
    c.copy(mesa);
    const s = fbm(x * 0.008 + 3.1, z * 0.008 + 9.4, 2);
    if (s > 0.18) c.lerp(scrub, Math.max(0, Math.min(0.75, (s - 0.18) * 2.2)));
  } else {
    c.copy(pale).lerp(mesa, Math.max(0, Math.min(0.5, (h - 175) / 60)));
  }
  c.offsetHSL(0, 0, fbm(x * 0.15, z * 0.15, 1) * 0.06);
  return c;
}

function makeRunway(terrain, cx, z, length, width) {
  const g = new THREE.Group();
  const floorY = CONFIG.terrain.floorHeight;
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(cx, floorY + 0.25, z);
  g.add(asphalt);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let d = -length / 2 + 25; d < length / 2 - 15; d += 30) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(cx, floorY + 0.32, z + d);
    g.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let s = -1; s <= 1; s += 1) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(cx + s * 12, floorY + 0.32, z + end * (length / 2 - 10));
      g.add(bar);
    }
  }
  return g;
}

export function buildTerrainMeshes(scene, terrain, seed) {
  const T = CONFIG.terrain;
  const R = CONFIG.runways;
  const noise = createNoise(seed);

  // The heightfield.
  const geo = new THREE.PlaneGeometry(T.halfX * 2, T.zMax - T.zMin, T.segmentsX, T.segmentsZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zCentre = (T.zMin + T.zMax) / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i) + zCentre;
    const h = terrain.terrainHeight(wx, wz);
    pos.setY(i, h);
    const c = terrainColor(wx, wz, h, (x, z, o) => noise.fbm(x, z, o));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.position.z = zCentre;
  scene.add(ground);

  // The river: a turquoise ribbon following the valley centreline.
  const riverPts = [];
  for (let z = T.zMax; z >= T.zMin; z -= 40) riverPts.push(z);
  const riverPos = new Float32Array(riverPts.length * 2 * 3);
  const riverIdx = [];
  riverPts.forEach((z, i) => {
    const cx = terrain.centrelineX(z);
    riverPos.set([cx - 9, 7.8, z, cx + 9, 7.8, z], i * 6);
    if (i > 0) {
      const a = (i - 1) * 2;
      riverIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.BufferAttribute(riverPos, 3));
  riverGeo.setIndex(riverIdx);
  riverGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(riverGeo, new THREE.MeshLambertMaterial({ color: 0x2f8fb0, transparent: true, opacity: 0.85 })));

  // Both runways.
  scene.add(makeRunway(terrain, terrain.centrelineX(R.start.z), R.start.z, R.start.length, R.start.width));
  scene.add(makeRunway(terrain, terrain.centrelineX(R.finish.z), R.finish.z, R.finish.length, R.finish.width));

  // Windsock by the start runway.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  sockPole.position.set(terrain.centrelineX(R.start.z) + R.start.width / 2 + 8, T.floorHeight + 4.5, R.start.z + 40);
  scene.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 3.2, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7f2a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(terrain.centrelineX(R.start.z) + R.start.width / 2 + 9.6, T.floorHeight + 8.6, R.start.z + 40);
  scene.add(sock);

  // Trees and rocks, instanced and seeded.
  const rand = createRandom(seed + 99);
  const treeSpots = [];
  for (let i = 0; i < 900 && treeSpots.length < 260; i += 1) {
    const x = (rand() * 2 - 1) * 1000;
    const z = T.zMin + rand() * (T.zMax - T.zMin);
    const h = terrain.terrainHeight(x, z);
    const off = Math.abs(x - terrain.centrelineX(z));
    const onRunway =
      (Math.abs(z - R.start.z) < R.start.length / 2 + 25 || Math.abs(z - R.finish.z) < R.finish.length / 2 + 25) &&
      off < R.start.width / 2 + 18;
    if (h < 45 && off > 24 && off < 300 && !onRunway) treeSpots.push({ x, z, h, s: 0.7 + rand() * 0.9 });
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.4, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3d5a2e }),
    treeSpots.length,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.8, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    treeSpots.length,
  );
  treeSpots.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    sc.set(t.s, t.s, t.s);
    m4.compose(new THREE.Vector3(t.x, t.h + 4.5 * t.s, t.z), q, sc);
    trees.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, t.h + 0.9 * t.s, t.z), q, sc);
    trunks.setMatrixAt(i, m4);
  });
  scene.add(trees);
  scene.add(trunks);

  const rockSpots = [];
  for (let i = 0; i < 700 && rockSpots.length < 170; i += 1) {
    const x = (rand() * 2 - 1) * 900;
    const z = T.zMin + rand() * (T.zMax - T.zMin);
    const h = terrain.terrainHeight(x, z);
    const off = Math.abs(x - terrain.centrelineX(z));
    if (h > 22 && h < 195 && off > 80 && off < 650) rockSpots.push({ x, z, h, s: 2 + rand() * 6, r: rand() * Math.PI });
  }
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0x8a7a6a }),
    rockSpots.length,
  );
  rockSpots.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(r.r, r.r * 2, 0));
    sc.set(r.s, r.s * 0.7, r.s);
    m4.compose(new THREE.Vector3(r.x, r.h + r.s * 0.3, r.z), q, sc);
    rocks.setMatrixAt(i, m4);
  });
  scene.add(rocks);
}
