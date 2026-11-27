// Red Rock Mail Run: the route as the player sees it. Glowing gates hung
// over the valley (cyan for the next one, green once flown, dim for the
// rest) and the three outposts — a few sun-baked buildings, a windsock and
// a mail flag — where the mail drops happen.
import * as THREE from '../vendor/three.bundle.min.js';
import { nextMission } from './missionList.js';

export function buildRouteMeshes(scene, missions) {
  const ringMats = {
    next: new THREE.MeshBasicMaterial({ color: 0x25e6ff }),
    future: new THREE.MeshBasicMaterial({ color: 0x6a8a99, transparent: true, opacity: 0.55 }),
    passed: new THREE.MeshBasicMaterial({ color: 0x39d353 }),
  };
  const ringMeshes = missions.rings.map((ring) => {
    const grp = new THREE.Group();
    grp.position.set(ring.x, ring.y, ring.z);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(ring.nx, ring.ny, ring.nz).normalize());
    const torus = new THREE.Mesh(new THREE.TorusGeometry(ring.radius, 1.1, 10, 40), ringMats.future);
    grp.add(torus);
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius, 2.4, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x25e6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.visible = false;
    grp.add(glow);
    scene.add(grp);
    return { grp, torus, glow };
  });

  // Outposts: adobe huts, a water tower, a windsock and a red mail flag.
  const adobe = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const roof = new THREE.MeshLambertMaterial({ color: 0x8a4a2a });
  const metal = new THREE.MeshLambertMaterial({ color: 0x7a8894 });
  const flagMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const outpostMeshes = missions.drops.map((drop) => {
    const grp = new THREE.Group();
    grp.position.set(drop.x, drop.y, drop.z);
    const hut1 = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 8), adobe);
    hut1.position.set(-4, 2.5, 0);
    grp.add(hut1);
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 4), roof);
    roof1.position.set(-4, 6.5, 0);
    roof1.rotation.y = Math.PI / 4;
    grp.add(roof1);
    const hut2 = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), adobe);
    hut2.position.set(6, 2, 4);
    grp.add(hut2);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.4, 4), roof);
    roof2.position.set(6, 5.2, 4);
    roof2.rotation.y = Math.PI / 4;
    grp.add(roof2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 6), metal);
    tower.position.set(10, 4.5, -5);
    grp.add(tower);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), metal);
    tank.position.set(10, 10, -5);
    grp.add(tank);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 11, 6), metal);
    pole.position.set(-11, 5.5, -4);
    grp.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2), flagMat);
    flag.position.set(-9.2, 10, -4);
    flag.material.side = THREE.DoubleSide;
    grp.add(flag);
    scene.add(grp);
    return { grp, flag };
  });

  // A faint gold disc on the ground marks each drop zone from the air.
  const dropDiscs = missions.drops.map((drop) => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(drop.radius, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc23e, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(drop.x, drop.y + 0.6, drop.z);
    scene.add(disc);
    return disc;
  });

  function update(missions, time) {
    const next = nextMission(missions);
    ringMeshes.forEach((rm, i) => {
      const ring = missions.rings[i];
      if (ring.passed) {
        rm.torus.material = ringMats.passed;
        rm.glow.visible = false;
      } else if (ring === next) {
        rm.torus.material = ringMats.next;
        rm.glow.visible = true;
        const pulse = 1 + Math.sin(time * 4) * 0.06;
        rm.glow.scale.set(pulse, pulse, 1);
      } else {
        rm.torus.material = ringMats.future;
        rm.glow.visible = false;
      }
    });
    outpostMeshes.forEach((om, i) => {
      const drop = missions.drops[i];
      om.flag.visible = !drop.passed;
      om.flag.rotation.y = Math.sin(time * 2 + i) * 0.3;
      dropDiscs[i].visible = !drop.passed;
      dropDiscs[i].material.opacity = drop.passed ? 0 : 0.18 + Math.sin(time * 3) * 0.06;
    });
  }

  return { update };
}
