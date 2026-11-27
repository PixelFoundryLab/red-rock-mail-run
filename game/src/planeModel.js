// Red Rock Mail Run: the mail plane. A low-poly jet drawn entirely in code
// — vector fuselage, swept wings, tail fin, glass canopy, wingtip lights and
// an afterburner glow — plus the soft blob shadow that grounds it on the
// canyon floor. One style, no emoji, no borrowed art.
import * as THREE from '../vendor/three.bundle.min.js';

export function buildPlaneModel() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xff8c1a, metalness: 0.35, roughness: 0.45 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, metalness: 0.2, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd9382b, metalness: 0.3, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.4 });

  // Fuselage: body, nose cone, tail cone.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.5, 12), yellow);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.6, 12), yellow);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.55;
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 12), yellow);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 4.1;
  g.add(tail);
  // Red mail stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 5.4), red);
  stripe.position.set(0, 0.28, -0.4);
  g.add(stripe);

  // Glass canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: 0x1a2a4a, shininess: 140, specular: 0x88aaff }),
  );
  canopy.scale.set(1, 0.7, 1.9);
  canopy.position.set(0, 0.45, -1.1);
  g.add(canopy);

  // Wings, tailplane and fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.16, 2.2), white);
  wing.position.set(0, -0.1, 0.7);
  g.add(wing);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.3), white);
  tailplane.position.set(0, 0.15, 3.4);
  g.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), red);
  fin.position.set(0, 0.85, 3.4);
  g.add(fin);

  // Engine nozzle and afterburner glow (brightens with throttle).
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 10), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 4.5;
  g.add(nozzle);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.25 });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), glowMat);
  glow.position.z = 4.96;
  g.add(glow);

  // Wingtip navigation lights: red left, green right.
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tipL.position.set(-5.5, -0.05, 0.7);
  g.add(tipL);
  const tipR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  tipR.position.set(5.5, -0.05, 0.7);
  g.add(tipR);

  return { group: g, glowMat };
}

// The soft shadow ellipse that follows the plane over the ground.
export function buildBlobShadow() {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(7, 3.5, 1);
  return shadow;
}
