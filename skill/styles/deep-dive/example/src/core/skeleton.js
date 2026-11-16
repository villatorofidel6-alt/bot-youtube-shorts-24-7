// skeleton.js — esqueleto de cuerpo completo hecho con primitivas (rápido: nada de SDF al arrancar).
// Misma API de rig que Human: pose({ spine, head, shL, elL, shR, elR, hipL, knL, hipR, knR }) en grados y
// walk(ph, amt). Los pivots coinciden con Human (caderas y0.93, hombros ±0.2, rodillas -0.42) para reutilizar
// las mismas cámaras. barbell(): barra con discos rojos para las escenas de pesas.
import * as THREE from 'three';

const D = THREE.MathUtils.degToRad;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function barbell() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#C7D1D8', roughness: 0.28, metalness: 0.85 });
  const pm = new THREE.MeshStandardMaterial({ color: '#B8283A', roughness: 0.4, metalness: 0.2, emissive: '#5A0A14', emissiveIntensity: 0.45 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.34, 20), steel);
  bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [-1, 1]) for (const x of [0.5, 0.575]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 40), pm);
    p.rotation.z = Math.PI / 2; p.position.x = s * x; g.add(p);
  }
  return g;
}

export class Skeleton {
  constructor() {
    this.boneMat = new THREE.MeshStandardMaterial({ color: '#ECF8FF', emissive: '#7FDDF2', emissiveIntensity: 0.4, roughness: 0.45 });
    const dark = new THREE.MeshBasicMaterial({ color: '#04121B' });
    const add = (parent, geo, pos = [0, 0, 0], rot = null) => { const m = new THREE.Mesh(geo, this.boneMat); m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); return m; };
    const G = (parent, pos) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };

    this.group = new THREE.Group();
    this.hips = G(this.group, [0, 0.93, 0]);
    this.spine = G(this.hips, [0, 0.04, 0]);
    // columna (9 vértebras) + pelvis
    for (let i = 0; i < 9; i++) add(this.spine, new THREE.CylinderGeometry(0.02 - i * 0.0006, 0.023 - i * 0.0006, 0.036, 12), [0, 0.06 + i * 0.05, -0.075]);
    add(this.hips, new THREE.TorusGeometry(0.105, 0.022, 10, 36, Math.PI), [0, -0.05, 0.01], [Math.PI / 2 + 0.65, 0, 0]);
    // costillas + esternón + clavículas
    for (let i = 0; i < 7; i++) add(this.spine, new THREE.TorusGeometry(0.145 - i * 0.009, 0.008, 8, 40, Math.PI * 1.5), [0, 0.45 - i * 0.045, -0.015], [Math.PI / 2 + 0.28, 0, Math.PI * 0.72]);
    add(this.spine, new THREE.CapsuleGeometry(0.011, 0.17, 6, 10), [0, 0.32, 0.085]);
    for (const s of [-1, 1]) add(this.spine, new THREE.CapsuleGeometry(0.009, 0.13, 6, 10), [s * 0.085, 0.46, 0.05], [0, 0, Math.PI / 2 + s * 0.2]);
    // cabeza: cráneo + mandíbula + dientes + cuencas oscuras
    this.head = G(this.spine, [0, 0.58, 0]);
    const skull = add(this.head, new THREE.SphereGeometry(0.086, 28, 22), [0, 0.115, -0.005]); skull.scale.set(0.95, 1.08, 1.05);
    add(this.head, new THREE.BoxGeometry(0.098, 0.05, 0.09), [0, 0.028, 0.028]);
    add(this.head, new THREE.BoxGeometry(0.07, 0.018, 0.02), [0, 0.016, 0.058], [0.25, 0, 0]);
    for (const s of [-1, 1]) {
      const e = add(this.head, new THREE.SphereGeometry(0.021, 14, 12), [s * 0.036, 0.115, 0.052]); e.material = dark;
      const n = add(this.head, new THREE.SphereGeometry(0.012, 10, 8), [0, 0.062, 0.075]); n.material = dark; n.scale.set(0.7, 1.4, 0.5);
    }
    // brazos: húmero + cúbito + mano
    this.arm = {};
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'L' : 'R', sh = G(this.spine, [s * 0.2, 0.43, -0.005]);
      add(sh, new THREE.CapsuleGeometry(0.019, 0.2, 8, 14), [0, -0.13, 0]);
      const el = G(sh, [0, -0.27, 0]);
      add(el, new THREE.CapsuleGeometry(0.0125, 0.17, 8, 12), [0, -0.13, 0.004]);
      add(el, new THREE.SphereGeometry(0.026, 14, 10), [0, -0.3, 0.012]);
      this.arm[k] = { sh, el };
    }
    // piernas: fémur + tibia + peroné + pie
    this.leg = {};
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'L' : 'R', hip = G(this.hips, [s * 0.088, -0.03, 0]);
      add(hip, new THREE.CapsuleGeometry(0.023, 0.3, 8, 14), [0, -0.22, 0]);
      const kn = G(hip, [0, -0.42, 0.005]);
      add(kn, new THREE.CapsuleGeometry(0.016, 0.26, 8, 12), [0, -0.2, 0]);
      add(kn, new THREE.CapsuleGeometry(0.009, 0.22, 8, 10), [s * 0.024, -0.2, -0.004]);
      add(kn, new THREE.BoxGeometry(0.07, 0.03, 0.16), [0, -0.44, 0.045]);
      this.leg[k] = { hip, kn };
    }
    this.pose({});
  }
  /** mismos grados y convenciones que Human.pose */
  pose(q) {
    const r3 = (g, a = [0, 0, 0]) => g.rotation.set(D(a[0]), D(a[1]), D(a[2]));
    r3(this.spine, q.spine); r3(this.head, q.head);
    r3(this.arm.L.sh, [-(q.shL?.[0] ?? 0), q.shL?.[1] ?? 0, -(q.shL?.[2] ?? 6)]); this.arm.L.el.rotation.set(-D(q.elL ?? 10), 0, 0);
    r3(this.arm.R.sh, [-(q.shR?.[0] ?? 0), q.shR?.[1] ?? 0, q.shR?.[2] ?? 6]); this.arm.R.el.rotation.set(-D(q.elR ?? 10), 0, 0);
    r3(this.leg.L.hip, [-(q.hipL?.[0] ?? 0), q.hipL?.[1] ?? 0, -(q.hipL?.[2] ?? 2)]); this.leg.L.kn.rotation.set(D(q.knL ?? 2), 0, 0);
    r3(this.leg.R.hip, [-(q.hipR?.[0] ?? 0), q.hipR?.[1] ?? 0, q.hipR?.[2] ?? 2]); this.leg.R.kn.rotation.set(D(q.knR ?? 2), 0, 0);
    this.group.updateMatrixWorld(true);
  }
  /** caminar en el sitio, misma firma que Human.walk */
  walk(ph, amt = 1) {
    const s = Math.sin(ph) * amt;
    this.pose({ hipL: [s * 26, 0, 2], hipR: [-s * 26, 0, 2], knL: Math.max(0, -Math.sin(ph + 0.6)) * 40 * amt + 4, knR: Math.max(0, Math.sin(ph + 0.6)) * 40 * amt + 4, shL: [-s * 20, 0, 6], shR: [s * 20, 0, 6], elL: 18, elR: 18, spine: [3, s * 4, 0] });
    this.hips.position.y = 0.93 - Math.abs(Math.cos(ph)) * 0.012 * amt;
  }
  /** posición de la mano en coordenadas del mundo (para anclar la barra) */
  mano(k) { return this.arm[k].el.localToWorld(V3(0, -0.3, 0.012)); }
  /** intensidad del brillo del hueso (picos de esfuerzo) */
  brillo(v) { this.boneMat.emissiveIntensity = v; }
}
