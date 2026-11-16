// sets.js — Tall Tale: mundo low-poly de leyenda. Cada set devuelve { scene, update() };
// se construyen UNA vez en gen.js. El suelo usa la MISMA función groundY(x, z) para el mesh,
// el sendero y la bestia: nada flota ni se hunde.
import * as THREE from 'three';

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...extra });
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t; }
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// ─── altura del terreno (la misma para mesh, sendero y actores) ───
export function groundY(x, z) {
  return 0.32 * Math.sin(x * 0.42) * Math.cos(z * 0.36) + 0.22 * Math.sin((x + z) * 0.61) - 0.08 * Math.sin(z * 1.7);
}
// ─── sendero serpenteante (curva Catmull-Rom sobre el terreno) ───
export function pathAt(u) {
  const P = PATH.getPoint(Math.min(1, Math.max(0, u)));
  return P;
}
let PATH = null;

// ═════════ EL MUNDO: terreno facetado, sendero de piedra, árboles, rocas, sol animable, bestia ═════════
export function terrain(E) {
  const scene = new THREE.Scene();
  scene.environment = E.envMap; scene.environmentIntensity = 0.35;
  scene.background = canvasTex(64, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7EC8E8'); gr.addColorStop(0.65, '#A8D8EA'); gr.addColorStop(1, '#F3E6C8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#BFD9E4', 20, 46);

  // luces: sol cálido animable (tormenta / amanecer) + cielo
  const sun = new THREE.DirectionalLight('#FFE7C4', 3.0);
  sun.position.set(9, 13, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#CFE8FF', '#5A4A32', 0.55); scene.add(hemi);
  const rim = new THREE.DirectionalLight('#FFE9B8', 0.7); rim.position.set(-7, 4, -6); scene.add(rim);

  // terreno facetado
  const geo = new THREE.PlaneGeometry(52, 52, 34, 34); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, groundY(x, z)); }
  geo.computeVertexNormals();
  const ground = shadowed(new THREE.Mesh(geo, std('#6E9B5A', 0.9))); scene.add(ground);

  // sendero: curva + losas de piedra
  const raw = [[-15, 15], [-8, 9], [-2, 4], [4, 1], [9, -3], [12, -9], [13, -16]];
  PATH = new THREE.CatmullRomCurve3(raw.map(([x, z]) => new THREE.Vector3(x, groundY(x, z) + 0.05, z)));
  const stoneM = std('#B59A6B', 0.95), stoneM2 = std('#A8895C', 0.95);
  for (let u = 0; u <= 1.0001; u += 0.03) {
    const p = pathAt(u);
    const st = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5 + (u * 791 % 1) * 0.22, 0.62, 0.09, 7), u % 0.06 < 0.03 ? stoneM : stoneM2));
    st.position.copy(p); st.rotation.y = (u * 977) % 6.28; st.scale.y = 1; scene.add(st);
  }

  // árboles (tronco + 2 conos) lejos del sendero
  const treeAt = (x, z, s) => {
    const g = new THREE.Group();
    const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.1 * s, 7), std('#7A5A3A', 0.9)));
    trunk.position.y = 0.55 * s; g.add(trunk);
    for (let i = 0; i < 2; i++) {
      const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry((1.15 - i * 0.35) * s, 1.3 * s, 7), std(i ? '#4E7A44' : '#5C8A4E', 0.9)));
      c.position.y = (1.25 + i * 0.75) * s; g.add(c);
    }
    g.position.set(x, groundY(x, z), z); scene.add(g); return g;
  };
  [[-17, 7, 1.25], [-13, 12, 0.9], [-5, 11, 1.1], [-9, 3, 0.85], [2, 8, 1.3], [8, 7, 0.95], [14, 3, 1.15], [16, -4, 1.0], [7, -9, 0.9], [15, -13, 1.2], [5, -14, 1.0], [-3, -11, 1.15], [-10, -6, 1.0], [-16, -2, 0.85], [-18, -9, 1.1]]
    .forEach(([x, z, s]) => treeAt(x, z, s));

  // rocas
  const rockAt = (x, z, s, r) => { const m = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * s, 0), std('#9A9186', 0.95))); m.position.set(x, groundY(x, z) + 0.28 * s, z); m.rotation.set(r, r * 1.7, r * 0.6); scene.add(m); };
  [[-6, 7, 0.8, 0.4], [6, 4, 0.6, 1.1], [11, -6, 0.9, 2.2], [-2, -8, 0.7, 0.9], [3, 9, 0.5, 1.6], [-12, 1, 0.75, 2.8]].forEach(([x, z, s, r]) => rockAt(x, z, s, r));

  // nubes que derivan lento (update anima)
  const cloudM = new THREE.MeshStandardMaterial({ color: '#F7F4EC', roughness: 1, flatShading: true });
  const clouds = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Group();
    for (const [dx, dz, s] of [[0, 0, 1.6], [1.4, 0.4, 1.1], [-1.3, 0.2, 1.0], [0.5, -0.5, 0.8]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 7, 5), cloudM); b.scale.y = 0.55; b.position.set(dx * 1.6, 0, dz * 1.6); c.add(b);
    }
    c.position.set(-14 + i * 9, 9.5 + (i % 2) * 1.6, -12 - (i % 3) * 4); clouds.add(c);
  }
  scene.add(clouds);

  // la BESTIA: torso achatado, púas, cuernos, ojo al rojo — anclada junto al sendero
  const beast = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.05, 8, 6), std('#6B4A3A', 0.85))); body.scale.set(1.25, 1.0, 1.05); body.position.y = 1.15; beast.add(body);
  for (let i = 0; i < 4; i++) { const sp = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 5), std('#D8CBB8', 0.6))); sp.position.set(-0.55 + i * 0.38, 2.05 - Math.abs(i - 1.5) * 0.12, 0); sp.rotation.z = 0.25 - i * 0.14; beast.add(sp); }
  const headG = new THREE.Group(); headG.position.set(0.65, 1.75, 0.2); beast.add(headG);
  const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.62, 0.85), std('#5F4032', 0.85))); headG.add(head);
  const jaw = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.8), std('#4E3328', 0.85))); jaw.position.set(0.02, -0.4, 0.02); headG.add(jaw);
  for (const s of [-1, 1]) {
    const horn = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), std('#E4D9C4', 0.55))); horn.position.set(s * 0.3, 0.42, 0.05); horn.rotation.z = s * 0.5; headG.add(horn);
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: '#FF4433' });
  const eyes = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeM); e.position.set(s * 0.24, 0.12, 0.44); headG.add(e); eyes.push(e); }
  const legs = [];
  for (const [sx, sz] of [[-0.55, 0.45], [0.55, 0.45], [-0.55, -0.45], [0.55, -0.45]]) {
    const l = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.34), std('#54382C', 0.85)));
    l.position.set(sx, 0.5, sz); l.geometry.translate(0, -0.4, 0); legs.push(l); beast.add(l);
  }
  const bpos = pathAt(0.86).clone().add(new THREE.Vector3(2.4, 0, -2.0));
  beast.position.set(bpos.x, groundY(bpos.x, bpos.z), bpos.z);
  const heroAt = pathAt(0.6); beast.rotation.y = Math.atan2(heroAt.x - bpos.x, heroAt.z - bpos.z);
  beast.scale.setScalar(0.001); beast.visible = false; scene.add(beast);   // gen.js la revela con pop

  const update = (t) => { clouds.children.forEach((c, i) => { c.position.x += 0.002 * (1 + i * 0.3); if (c.position.x > 20) c.position.x = -20; }); };
  return { scene, sun, hemi, rim, fog: scene.fog, pathAt, groundY, update, beast, bHead: headG, bJaw: jaw, bBody: body, bEyes: eyes };
}
