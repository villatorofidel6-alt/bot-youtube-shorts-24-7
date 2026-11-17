// mundo.js — el mundo 3D del estilo "caricatura" (personajes planos en un mundo 3D).
// Port de las piezas de la skill "shorts animados 3D" (MIT): tarjetas de personaje dibujadas en
// canvas y pegadas como planos al mundo (troop.ts Actor/Pool), multitud instanciada con atlas
// (crowd.ts), cielo pintado, hierba, colinas y nubes (world.ts / paint.ts). Todo paramétrico.
import * as THREE from 'three';
import { lightRig } from './engine.js';
import { Pen, bodyFront, bodySide, fxContact, fxShadow, mul, DEF_LIGHT, SOLDADO, clamp } from './toon.js';

export const SU = 0.00216;                                  // metros por unidad de diseño: 1000 u = 2.16 m
export const BODY = (() => {                                // plano 600x1000 con las suelas en y = 0
  const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU);
  g.translate(0, (975 - 500) * SU, 0);
  return g;
})();
const CARD = new THREE.PlaneGeometry(1, 1);

// ─── pool de texturas: un dibujo por pose distinta (misma idea que troop.ts Pool) ───
const POOL = new Map();
function texDe(key, w, h, k, draw) {
  const id = `${w}x${h}|${key}`;
  let t = POOL.get(id);
  if (!t) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
    draw(new Pen(g));
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    POOL.set(id, t);
  }
  return t;
}

// ─── tarjeta viva: un canvas que se REDIBUJA cada frame (héroe animado: boca, parpadeo, brazos) ───
export class TarjetaViva {
  constructor(k = 1.8, w = 600, h = 1000) {
    this.k = k; this.W = Math.round(w * k); this.H = Math.round(h * k);
    this.cv = document.createElement('canvas'); this.cv.width = this.W; this.cv.height = this.H;
    this.g = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.pen = new Pen(this.g);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.renderOrder = 1;
  }
  /** dibuja el cuerpo (frontal) y actualiza la textura; opts van directos a bodyFront */
  draw(o, opts = {}) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.W, this.H);
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    bodyFront(this.pen, o, opts);
    this.tex.needsUpdate = true;
  }
  /** cuerpo de lado (para caminar cruzando la pantalla) */
  drawSide(o, opts = {}) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.W, this.H);
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    bodySide(this.pen, o, opts);
    this.tex.needsUpdate = true;
  }
}

// ─── atajo: tarjeta estática (pose congelada) como textura ───
export const texCuerpo = (key, o, opts = {}, k = 0.8) =>
  texDe(key, Math.round(600 * k), Math.round(1000 * k), k, (p) => bodyFront(p, o, opts));

// ─── sombra de contacto bajo los pies ───
function texBlob(kind, col) {
  return texDe(`blob|${kind}|${col}`, kind === 'sombra' ? 128 : 128, kind === 'sombra' ? 256 : 128, 1,
    kind === 'sombra' ? (p) => fxShadow(p, col) : (p) => fxContact(p, col));
}
export function sombra(parent, x, z, sc = 1, tail = true) {
  const t = texBlob('sombra', 'rgba(30,26,40,0.5)');
  const m = new THREE.Mesh(CARD, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = 0;
  m.scale.set(0.72 * sc, tail ? 1.9 * sc : 0.9 * sc, 1);
  m.position.set(x, 0.02, z); m.renderOrder = 0;
  parent.add(m);
  return m;
}
export function polvo(parent, x, y, z, sc = 1) {
  const t = texDe('polvo', 128, 128, 1, (p) => {
    const g = p.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    gr.addColorStop(0, 'rgba(190,170,140,0.85)'); gr.addColorStop(0.6, 'rgba(180,160,130,0.4)'); gr.addColorStop(1, 'rgba(180,160,130,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.Mesh(CARD, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.scale.set(0.7 * sc, 0.7 * sc, 1); m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ─── atlas + multitud instanciada (port del concepto crowd.ts: un quad por soldado, billboard) ───
const TW = 160, TH = 267, K = TW / 600;
function atlasPose(variants, raise, outfitFn) {
  const cols = 4, rows = Math.ceil(variants / cols);
  const cv = document.createElement('canvas'); cv.width = cols * TW; cv.height = rows * TH;
  const g = cv.getContext('2d');
  for (let i = 0; i < variants; i++) {
    g.setTransform(K, 0, 0, K, (i % cols) * TW, Math.floor(i / cols) * TH);
    const ph = (i % 4) / 4;
    bodyFront(new Pen(g), outfitFn(i), { mode: 'march', ph, raise: raise ? 1 : 0, light: DEF_LIGHT, seed: (i % 7) + 1, expr: i % 3 ? 'grito' : 'neutral' });
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return { tex: t, cols, rows };
}

const CROWD_VS = `
attribute vec3 aPos; attribute float aS; attribute vec2 aTile; attribute float aPh;
uniform float uT, uBob, uFreq, uCols, uRows;
varying vec2 vUv; varying float vDep;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  float bob = uBob * (0.5 + 0.5 * sin(uT * uFreq + aPh * 6.2831));
  vec3 wp = aPos + vec3(0.0, bob, 0.0) + right * (position.x * aS) + vec3(0.0, position.y * aS, 0.0);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDep = -mv.z;
  gl_Position = projectionMatrix * mv;
  vec2 span = vec2(1.0 / uCols, 1.0 / uRows);
  vUv = vec2(aTile.x * span.x, 1.0 - (aTile.y + 1.0) * span.y) + vec2(uv.x * span.x, uv.y * span.y);
}`;
const CROWD_FS = `
uniform sampler2D uMap; uniform vec3 uTint, uFogC; uniform float uFogN, uFogF;
varying vec2 vUv; varying float vDep;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.5) discard;
  c.rgb *= uTint;
  c.rgb = mix(c.rgb, uFogC, smoothstep(uFogN, uFogF, vDep));
  gl_FragColor = c;
}`;

export function makeCrowd(scene, { n, variants = 8, raise = false, outfitFn = (i) => SOLDADO(i, {}) } = {}) {
  const atl = atlasPose(variants, raise, outfitFn);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = CARD.index; geo.attributes.position = CARD.attributes.position; geo.attributes.uv = CARD.attributes.uv;
  const pos = new Float32Array(n * 3), sc = new Float32Array(n), tile = new Float32Array(n * 2), ph = new Float32Array(n);
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.InstancedBufferAttribute(sc, 1));
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
  geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atl.tex }, uCols: { value: atl.cols }, uRows: { value: atl.rows },
      uT: { value: 0 }, uBob: { value: 0.045 }, uFreq: { value: 5.0 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uFogC: { value: new THREE.Color('#cfe3ee') },
      uFogN: { value: 30 }, uFogF: { value: 220 } },
    vertexShader: CROWD_VS, fragmentShader: CROWD_FS, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 1;
  const group = new THREE.Group(); group.add(mesh); scene.add(group);
  return {
    group, n, pos, sc, tile, ph, mat, atl,
    /** coloca la formación: filas x columnas desde (x0,z0) hacia -z, con jitter sembrado */
    formar({ filas = 6, cols = 12, x0 = null, z0 = -2.4, dx = 1.05, dz = 1.2, semilla = 1, esc = 1 } = {}) {
      const C = cols, R = filas, total = Math.min(n, C * R);
      const cx = x0 == null ? -((C - 1) * dx) / 2 : x0;
      for (let i = 0; i < total; i++) {
        const r = Math.floor(i / C), c = i % C;
        const j1 = (Math.sin(i * 127.1 + semilla * 311.7) * 43758.5453 % 1 + 1) % 1;
        const j2 = (Math.sin(i * 269.5 + semilla * 183.3) * 43758.5453 % 1 + 1) % 1;
        pos[i * 3] = cx + c * dx + (j1 - 0.5) * dx * 0.55;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = z0 - r * dz + (j2 - 0.5) * dz * 0.5;
        sc[i] = (1.62 + j1 * 0.16) * esc;
        tile[i * 2] = i % atl.cols; tile[i * 2 + 1] = i % atl.rows;
        ph[i] = j2;
      }
      geo.instanceCount = total;
      this.total = total;
      for (const a of ['aPos', 'aS', 'aTile', 'aPh']) geo.attributes[a].needsUpdate = true;
      return this;
    },
    actualizar(t, bob = null, freq = null) {
      mat.uniforms.uT.value = t;
      if (bob != null) mat.uniforms.uBob.value = bob;
      if (freq != null) mat.uniforms.uFreq.value = freq;
    },
    tinte(r, g, b) { mat.uniforms.uTint.value.setRGB(r, g, b); },
    niebla(col, n0, f0) { mat.uniforms.uFogC.value.set(col); mat.uniforms.uFogN.value = n0; mat.uniforms.uFogF.value = f0; },
  };
}

// ─── el escenario compartido: cielo pintado + hierba + colinas + árboles + nubes + luz ───
function texCielo(puntas) {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 1024;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  puntas.forEach(([c, y]) => gr.addColorStop(y, c));
  g.fillStyle = gr; g.fillRect(0, 0, 16, 1024);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texHierba(base, rayitas) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    g.strokeStyle = i % 3 ? rayitas : 'rgba(255,255,255,0.05)';
    g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 48);
  return t;
}
function texNube() {
  return texDe('nube', 256, 128, 1, (p) => {
    const g = p.g;
    for (const [x, y, r, a] of [[86, 74, 44, 0.95], [128, 60, 52, 0.95], [172, 76, 40, 0.95], [110, 82, 36, 0.9], [150, 84, 34, 0.9]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,252,246,${a})`); gr.addColorStop(0.7, `rgba(255,252,246,${a * 0.8})`); gr.addColorStop(1, 'rgba(255,252,246,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
  });
}

const HORAS = {
  dia: {
    cielo: texCielo([['#5fb1e8', 0], ['#8ec6f0', 0.45], ['#cfe6f2', 0.78], ['#e9f1e6', 1]]),
    niebla: '#cfe0e8', nieblaN: 34, nieblaF: 230,
    key: '#ffe8c8', keyI: 3.0, keyPos: [-2.5, 4.2, 3], hemiSky: '#eaf4ff', hemiSuelo: '#7a8a5a', hemiI: 0.95,
    suelo: '#6fae52', colinas: '#588f4a', arboles: '#3f7a3a', troncos: '#6b4a2a', nubes: '#ffffff', tinte: [1, 1, 1],
  },
  oro: {
    cielo: texCielo([['#cf9a6e', 0], ['#c0835c', 0.35], ['#a3684c', 0.62], ['#7a4e44', 0.85], ['#4e3a3e', 1]]),
    niebla: '#b48a6a', nieblaN: 26, nieblaF: 200,
    key: '#ffc68a', keyI: 3.3, keyPos: [-3.2, 3.0, 2.6], hemiSky: '#e0b090', hemiSuelo: '#6a5048', hemiI: 0.55,
    suelo: '#8a7a4a', colinas: '#6a5048', arboles: '#5a4a34', troncos: '#4a3426', nubes: '#e8d0b8', tinte: [1.05, 0.94, 0.84],
  },
};

export function mundo(E) {
  const scene = new THREE.Scene();
  const luz = lightRig(scene, {});
  const sueloTex = texHierba(HORAS.dia.suelo, 'rgba(0,0,0,0.06)');
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshLambertMaterial({ map: sueloTex, color: '#ffffff' }));
  suelo.rotation.x = -Math.PI / 2; scene.add(suelo);
  // colinas lejanas: cúpulas facetadas
  const colinas = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4, r = 120 + (i % 3) * 45;
    const m = new THREE.Mesh(new THREE.SphereGeometry(18 + (i % 4) * 9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: HORAS.dia.colinas, flatShading: true }));
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.scale.set(1.6 + (i % 3) * 0.5, 0.34 + (i % 2) * 0.14, 1.6 + (i % 4) * 0.4);
    scene.add(m); colinas.push(m);
  }
  // árboles redondos (copa cónica + tronco)
  const arboles = [], troncos = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.25, r = 26 + (i % 5) * 7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const copa = new THREE.Mesh(new THREE.ConeGeometry(1.5 + (i % 3) * 0.5, 3.4 + (i % 3) * 0.8, 9),
      new THREE.MeshLambertMaterial({ color: HORAS.dia.arboles, flatShading: true }));
    copa.position.set(x, 3.1, z); scene.add(copa); arboles.push(copa);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), new THREE.MeshLambertMaterial({ color: HORAS.dia.troncos }));
    tr.position.set(x, 0.8, z); scene.add(tr); troncos.push(tr);
  }
  // nubes
  const nubes = [];
  const nubeT = texNube();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(CARD, new THREE.MeshBasicMaterial({ map: nubeT, transparent: true, depthWrite: false, color: HORAS.dia.nubes }));
    m.scale.set(26 + i * 5, 13 + i * 2.4, 1);
    m.position.set(-60 + i * 32, 38 + (i % 3) * 9, -110 - i * 22);
    scene.add(m); nubes.push(m);
  }
  // loma para el rey
  const loma = new THREE.Mesh(new THREE.SphereGeometry(2.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: HORAS.dia.colinas, flatShading: true }));
  loma.position.set(0, -0.12, -1.6); loma.scale.set(1.5, 0.3, 1.2); loma.visible = false; scene.add(loma);

  let hora = null;
  const setHora = (h) => {
    const H = HORAS[h] || HORAS.dia;
    if (h !== hora) {
      hora = h;
      scene.background = H.cielo;
      scene.fog = new THREE.Fog(H.niebla, H.nieblaN, H.nieblaF);
      luz.key.color.set(H.key); luz.key.intensity = H.keyI; luz.key.position.set(...H.keyPos);
      scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(H.hemiSky); o.groundColor.set(H.hemiSuelo); o.intensity = H.hemiI; } });
      for (const m of colinas) m.material.color.set(H.colinas);
      for (const m of arboles) m.material.color.set(H.arboles);
      for (const m of troncos) m.material.color.set(H.troncos);
      for (const m of nubes) m.material.color.set(H.nubes);
    }
    return H;
  };
  setHora('dia');
  return { scene, luz, setHora, loma, suelo };
}
