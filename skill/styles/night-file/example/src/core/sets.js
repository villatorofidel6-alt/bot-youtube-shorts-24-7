// sets.js — Night File: estudio oscuro con escritorio y lámpara + macro de documento.
// Cada set devuelve { scene, update() }; se construyen UNA vez en gen.js (buildShots).
import * as THREE from 'three';

const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; }
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// ═════════ ESTUDIO: escritorio, lámpara de brazo, corcho con polaroids y hilo rojo ═════════
export function office(E) {
  const scene = new THREE.Scene();
  scene.environment = E.envMap; scene.environmentIntensity = 0.1;
  scene.background = canvasTex(64, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0D1118'); gr.addColorStop(1, '#05070B'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#06090E', 5, 14);
  scene.add(new THREE.HemisphereLight('#2B3A4E', '#05070B', 0.35));
  const rim = new THREE.DirectionalLight('#3D5A80', 0.5); rim.position.set(2.5, 3, 2); scene.add(rim);

  const wood = canvasTex(1024, 1024, (g, w, h) => { for (let i = 0; i < 8; i++) { const l = 46 + (i * 29) % 16; g.fillStyle = `rgb(${l},${l - 8},${l - 14})`; g.fillRect(0, i * h / 8, w, h / 8); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, i * h / 8, w, 3); } }, [5, 5]);
  const floor = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(16, 16), std('#ffffff', 0.6, { map: wood }))); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(16, 5, 0.2), std('#161B22', 0.95))); back.position.set(0, 2.5, -2.4); scene.add(back);

  // tablero de corcho con 4 polaroids + hilo rojo entre ellas
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.06), std('#ffffff', 0.85, { map: canvasTex(512, 340, (g, w, h) => { g.fillStyle = '#96754C'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 2600; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 14; g.strokeRect(0, 0, w, h); }) })));
  board.position.set(0.2, 1.95, -2.28); scene.add(board);
  const marco = std('#3A2E1E', 0.5);
  for (const [w, h, x, y] of [[2.8, 0.1, 0.2, 2.85], [2.8, 0.1, 0.2, 1.05], [0.1, 1.9, -1.15, 1.95], [0.1, 1.9, 1.55, 1.95]]) { const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), marco)); b.position.set(x, y, -2.3); scene.add(b); }
  const FOTOS = [[-0.75, 2.2], [0.35, 2.35], [1.05, 1.85], [-0.25, 1.55]];
  for (const [fx, fy] of FOTOS) {
    const card = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), std('#E8E2D2', 0.7)));
    card.position.set(fx, fy, -2.24); card.rotation.z = (fx * 7 + fy) % 0.5 - 0.25; scene.add(card);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.17), std('#242A33', 0.9));
    inner.position.set(0, 0.032, 0.004); card.add(inner);
  }
  const hiloMat = new THREE.MeshStandardMaterial({ color: '#B3222E', roughness: 0.5 });
  const hilo = (a, b) => { const A = new THREE.Vector3(a[0], a[1], -2.22), B = new THREE.Vector3(b[0], b[1], -2.22); const dir = B.clone().sub(A); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, dir.length(), 6), hiloMat); m.position.copy(A).addScaledVector(dir, 0.5); m.lookAt(B); m.rotateX(Math.PI / 2); scene.add(m); };
  hilo(FOTOS[0], FOTOS[1]); hilo(FOTOS[1], FOTOS[3]); hilo(FOTOS[1], FOTOS[2]);

  // escritorio
  const top = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 1.15), std('#ffffff', 0.6, { map: wood })));
  top.position.set(0, 0.76, -0.75); scene.add(top);
  for (const [x, z] of [[-1.15, -1.2], [1.15, -1.2], [-1.15, -0.3], [1.15, -0.3]]) { const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.74, 0.09), std('#46351F', 0.7))); leg.position.set(x, 0.37, z); scene.add(leg); }

  // lámpara de brazo + foco cálido (gen.js anima lamp.intensity)
  const metal = new THREE.MeshStandardMaterial({ color: '#2E3338', roughness: 0.4, metalness: 0.6 });
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 24), metal)); base.position.set(-0.9, 0.81, -0.55); scene.add(base);
  const arm1 = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 10), metal)); arm1.position.set(-0.9, 1.05, -0.55); arm1.rotation.z = 0.35; scene.add(arm1);
  const arm2 = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 10), metal)); arm2.position.set(-0.78, 1.32, -0.55); arm2.rotation.z = -1.15; scene.add(arm2);
  const head = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 24, 1, true), metal)); head.position.set(-0.62, 1.4, -0.55); head.rotation.z = 0.7; scene.add(head);
  const lamp = new THREE.SpotLight('#FFD9A0', 90, 9, 0.62, 0.55, 1.5);
  lamp.position.set(-0.6, 1.38, -0.55); lamp.target.position.set(0.15, 0.78, -0.75);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0004;
  scene.add(lamp, lamp.target);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFE7BF' })); glow.position.copy(lamp.position); scene.add(glow);

  // carpeta manila (tapa animable con pivote en el lomo) + papeles + taza
  const manila = std('#C9A55C', 0.75);
  const folder = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.45), manila)); folder.position.set(0.15, 0.8, -0.75); scene.add(folder);
  const lidGeo = new THREE.BoxGeometry(0.62, 0.012, 0.45); lidGeo.translate(0.31, 0, 0);
  const lid = shadowed(new THREE.Mesh(lidGeo, manila)); lid.position.set(-0.16, 0.82, -0.75); lid.rotation.z = 0.5; scene.add(lid);
  const papelM = std('#EDE6D3', 0.85);
  for (let i = 0; i < 3; i++) { const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.006, 0.36), papelM)); p.position.set(0.72, 0.8 + i * 0.008, -1.0); p.rotation.y = (i - 1) * 0.18; scene.add(p); }
  const mug = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 20), std('#7A3038', 0.5))); mug.position.set(-0.35, 0.87, -0.45); scene.add(mug);

  // sello de madera (gen.js lo deja caer)
  const stamp = new THREE.Group();
  const sBase = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), std('#22262C', 0.6)));
  const sHandle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.08, 12), std('#3A2A1A', 0.5)));
  sHandle.position.y = 0.055; stamp.add(sBase, sHandle); stamp.position.set(0.85, 0.87, -0.5); scene.add(stamp);

  return { scene, lamp, glow, lid, stamp, update() {} };
}

// ═════════ MACRO DE DOCUMENTO: hoja bajo el foco (dos páginas para el paso de página) ═════════
export function deskPaper(E) {
  const scene = new THREE.Scene();
  scene.environment = E.envMap; scene.environmentIntensity = 0.08;
  scene.background = new THREE.Color('#070A0F');
  scene.add(new THREE.HemisphereLight('#33404E', '#05070B', 0.25));
  const desk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 3), std('#4A3A26', 0.65))); desk.position.set(0, -0.05, 0); scene.add(desk);
  const makeTex = () => canvasTex(1024, 1450, (g, w, h) => {
    g.fillStyle = '#EFE7D4'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,90,50,0.08)'; g.fillRect(0, 0, w, 60);
    g.fillStyle = '#3B3A36';
    for (let r = 0; r < 15; r++) { g.globalAlpha = 0.14; g.fillRect(110, 120 + r * 82, 560 + ((r * 97) % 300), 26); g.globalAlpha = 1; }
    g.strokeStyle = 'rgba(60,50,30,0.25)'; g.strokeRect(40, 40, w - 80, h - 80);
  });
  const hoja = (tex) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.77), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true, opacity: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, 0); scene.add(m); return m; };
  const paperA = hoja(makeTex());
  const paperB = hoja(makeTex()); paperB.visible = false; paperB.position.set(0, 0.012, -2);
  const spot = new THREE.SpotLight('#FFE3B8', 70, 8, 0.7, 0.6, 1.4);
  spot.position.set(0, 1.6, 0.35); spot.target.position.set(0, 0, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot, spot.target);
  return { scene, paperA, paperB, update() {} };
}
