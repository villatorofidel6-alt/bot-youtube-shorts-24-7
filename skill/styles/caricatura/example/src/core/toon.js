// toon.js — personajes planos de caricatura sobre Canvas2D (puerto fiel de toon.ts de la skill
// "shorts animados 3D", MIT, LuisPa / Mr omi). Espacio de diseño 600 x 1000, suelas en y=975,
// adultos de 3.5 cabezas. Contorno ciruela grueso-fino (grueso lejos de la luz), crecientes pintadas.
// Mismas constantes medidas: cabeza H/W 0.94, corona 1.75 / mandíbula 2.3, ojos a 26u, boca 20u abajo.
export const INK = '#241726';
export const SKIN = '#ffe2c2';
const WHITE = '#ffffff';
const MOUTH = '#5a1e28';
const TONGUE = '#e86e78';
const SH_SKIN = [0.96, 0.86, 0.84];   // ratio sombra/lit medido en cabezas de piel
const SH_CLOTH = [0.64, 0.66, 0.74];  // torsos: lado lit -> lado lejos ~0.65
const SH_FELT = [0.62, 0.62, 0.7];

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const rad = (d) => d * D2R;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mul = (c, m) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v, k) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c, k) => mul(c, [k, k, k]);
export const mix = (a, b, t) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
const rnd = (seed, k) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
export const rotPts = (pts, a, cx, cy) => {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
};
const rotAbout = (q, a, c) => rotPts([q], a, c[0], c[1])[0];
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const curve = (a, k, b, n = 10) => {
  const c = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = 1 - t; out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]); }
  return out;
};

// ─── Pen ───
export class Pen {
  constructor(g) { this.g = g; this.ol = 12; this.rot = null; }
  P(x, y) {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts, close) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  poly(pts, fill, ol) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
  }
  ell(cx, cy, rx, ry, fill, ol, a0 = 0, a1 = 360, rot = 0) { this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol); }
  stroke(pts, w, fill = INK) {
    const g = this.g;
    g.lineCap = 'round'; g.lineJoin = 'round';
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  band(pts, fill, w, rim, cap = 'butt') {
    const g = this.g; g.lineCap = cap; g.lineJoin = 'round';
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = 'round';
  }
  arc(cx, cy, rx, ry, a0, a1, w, fill = INK) {
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx, cy, r, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, TAU); this.g.fillStyle = fill; this.g.fill();
  }
  clip(pts, fn) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  shadedFill(pts, base, shadow, light, R, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(r0 / r1, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  gradFill(pts, base, shadow, light, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  inkRing(pts, w0, thick, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out = [], inn = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill('evenodd');
  }
}
const ellPts = (cx, cy, rx, ry, a0 = 0, a1 = 360, rot = 0, n = 48) => {
  const r = rad(rot), pts = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};
export const taper = (p, a, b, wa, wb, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ─── contornos ───
export const blobPts = (cx, cy, B, n = 72) => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * TAU);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};
export const headBlob = (seed, a = 118, facing = 0) => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});
export const thickAngle = (light) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
export const DEF_LIGHT = rad(-120);

// ─── caras ───
export const EXPRESIONES = ['neutral', 'serio', 'sonrisa', 'risa', 'silbido', 'nervioso', 'shock', 'alivio', 'abierta', 'aturdido', 'dolor', 'grito'];
const FACE = {
  neutral: { eye: ['lid', 'lid'], brow: [0, -1], mouth: 'dash' },
  serio: { eye: ['lid', 'lid'], brow: [3, -2], mouth: 'frown' },
  sonrisa: { eye: ['happy', 'happy'], brow: [-3, -3], mouth: 'grin' },
  risa: { eye: ['squeeze', 'squeeze'], brow: [-4, -4], mouth: 'laugh' },
  silbido: { eye: ['dash', 'dash'], brow: [-2, -4], mouth: 'o' },
  nervioso: { eye: ['small', 'small'], brow: [-3, 2], mouth: 'wave' },
  shock: { eye: ['shock', 'shock'], brow: [-7, -6], mouth: 'O' },
  alivio: { eye: ['happy', 'happy'], brow: [-2, 1], mouth: 'smileWide' },
  abierta: { eye: ['happy', 'happy'], brow: [-2, 1], mouth: 'grin' },
  aturdido: { eye: ['spiral', 'spiral'], brow: [-3, 2], mouth: 'wave' },
  dolor: { eye: ['squeeze', 'lid'], brow: [-3, 2], mouth: 'teeth' },
  grito: { eye: ['lid', 'lid'], brow: [6, -3], mouth: 'O' },
};
const halfLid = (k) => (k === 'dot' || k === 'small' ? 'lid' : k === 'lid' ? 'slit' : k === 'shock' ? 'shockHalf' : k);
const eyeKind = (k, lid) => (lid >= 1 && k !== 'happy' && k !== 'squeeze' && k !== 'spiral' ? 'dash' : lid > 0 ? halfLid(k) : k);
const lidOf = (b) => (b === true ? 1 : Number(b) || 0);

const eye = (p, kind, x, ey, u, side, look, skin) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  switch (kind) {
    case 'dot': p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case 'small': p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case 'lid': p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case 'slit': p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case 'happy': p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case 'dash': p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case 'squeeze': p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case 'shock': case 'shockHalf':
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === 'shockHalf') { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};
const dmouth = (p, mx, y, rx, ry, u, tongue = false) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};
const mouth = (p, kind, mx, my, u, k = 1) => {
  const mw = 4 * u;
  switch (kind) {
    case 'dash': p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case 'frown': p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case 'smirk': p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case 'smile': p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case 'smileWide': p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case 'grin': dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case 'laugh': dmouth(p, mx, my, 16 * u * k, 11 * u, u, true); break;
    case 'o': p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case 'O': p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 3.2 * u); break;
    case 'wave': { const s = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case 'teeth':
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], WHITE, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
  }
};
const faceFront = (p, cx, cy, W, expr, facing, look, lid, brim, skin, moustache, stout = false) => {
  const u = W / 100, F = FACE[expr] || FACE.neutral, fx = cx + 7 * u * facing;
  const ex = (F.eye[0] === 'shock' ? 12 : 13) * u, ey = cy;
  for (const side of [-1, 1]) {
    const x = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x, ey, u, side, look, skin);
    const [dI, dO] = F.brow, by = ey - (brim ? 17 : 20) * u;
    if (kind === 'shock' || kind === 'shockHalf') p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u;
  mouth(p, F.mouth, mx, my, u);
  if (moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (stout ? 19 : 15) * u, cy + (stout ? 10.5 : 15) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === 'nervioso') p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, '#9fd4ff', 2 * u);
};
const faceSide = (p, hx, hy, W, expr, lid, brim, skin, moustache, stout = false) => {
  const u = W / 100, F = FACE[expr] || FACE.neutral, ex = hx + 27 * u, ey = hy;
  const kind = eyeKind(F.eye[1], lid);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === 'shock' || kind === 'shockHalf') p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 5 * u, 2.5 * u);
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  mouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62);
  if (moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (stout ? 11.5 : 16) * u], stout ? 5.5 * u : 4.5 * u, 1.6 * u, moustache);
  if (expr === 'nervioso') p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, '#9fd4ff', 2 * u);
};

// ─── sombreros ───
const BONNET = '#e9cf8f', BONNET_BRIM = '#d6b46a';
const hatBehind = (p, o, H, cx, hc, light, thick, ow, side) => {
  if (o.hat !== 'bonnet') return;
  const bb = blobPts(cx - (side ? 12 : 0) * (H.a / 50), hc - 0.07 * 2 * H.b, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
  p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
  p.inkRing(bb, ow * 0.85, thick);
};
const hatOn = (p, o, hp, H, cx, hc, light, seed, facing, side) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5));
  const R = (pts) => rotPts(pts, a, cx, hc);
  const sag = (yb, wb) => {
    const base = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  if (o.hat === 'shako' || o.hat === 'shako_tall') {
    const tall = o.hat === 'shako_tall', yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, '#3a3d47', '#24262d', light, wt, 0.4);
    if (tall) p.clip(body, () => p.band(R([[cx - wt - 5 * u, yb - ht + 0.07 * HH], [cx + wt + 5 * u, yb - ht + 0.07 * HH]]), '#e8c45a', 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    if (side) {
      p.poly(R([[cx + 36 * u, yb - 1 * u], [cx + 60 * u, yb + 8 * u], [cx + 34 * u, yb + 6 * u]]), '#16171b', 2.5 * u);
      const [tx, ty] = R([[cx + 24 * u, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, '#2b7a4b', 2.5 * u);
    } else {
      const [px, py] = R([[cx + 3 * u * facing, yb + 3 * u]])[0];
      p.ell(px, py, 34 * u, 0.045 * HH, '#16171b', 2.5 * u, 0, 180, (a * 180) / Math.PI);
      const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
      p.ell(bx, by, 7 * u, 6 * u, tall ? '#e8c45a' : '#c9ccd2', 2 * u, 0, 360, (a * 180) / Math.PI);
      p.arc(bx, by, 3.5 * u, 2.8 * u, 200, 500, 1.6 * u);
      const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
      p.ell(tx, ty, 7 * u, 7 * u, '#2b7a4b', 2.5 * u);
    }
  } else if (o.hat === 'cap' || o.hat === 'hair') {
    const cut = crown + (o.hat === 'cap' ? 0.3 : 0.42) * HH;
    const keep = (x, y) => y < cut || (side && o.hat === 'hair' && x < cx - 6 * u && y < hc + 0.42 * H.b);
    const n = hp.length, startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03]);
    if (arc.length < 3) return;
    if (o.hat === 'hair') {
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    const col = o.hat === 'cap' ? o.cap : o.hair;
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
    if (o.hat === 'hair') {
      const s = side ? -1 : facing || 1;
      p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
    }
    if (o.hat === 'cap') {
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const s = facing || (rnd(seed, 21) < 0.5 ? -1 : 1), [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, (a * 180) / Math.PI);
      }
    }
  } else if (o.hat === 'tophat') {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W, col = '#2e2a36';
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.jacket, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, '#1d1b22', ow, 0, 360, (a * 180) / Math.PI);
  } else if (o.hat === 'greek' || o.hat === 'greek_gold' || o.hat === 'persian') {
    const greek = o.hat !== 'persian', gold = o.hat === 'greek_gold';
    const col = greek ? (gold ? '#e9b949' : '#c98f3e') : o.cap ?? '#d9c27a';
    const cut = crown + (greek ? 0.36 : 0.3) * HH;
    const n = hp.length, keep = (y) => y < cut;
    const startIdx = Math.max(0, hp.findIndex(([, y], i) => keep(y) && !keep(hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([, y]) => keep(y))
      .map(([x, y]) => [cx + (x - cx) * 1.07, hc + (y - hc) * 1.07]);
    if (arc.length < 3) return;
    if (greek) {
      const crest = gold ? '#d8323a' : '#b8322f';
      const [tx, ty] = R([[cx, crown - 0.15 * HH]])[0];
      p.ell(tx, ty, (gold ? 15 : 11) * u, (gold ? 0.3 : 0.24) * HH, crest, ow * 0.8, 0, 360, (a * 180) / Math.PI);
    } else {
      const [tx, ty] = R([[cx + 5 * u * (facing || 1), crown - 0.02 * HH]])[0];
      p.ell(tx, ty, 0.3 * W, 0.15 * HH, col, ow * 0.8, 0, 360, (a * 180) / Math.PI + 8 * (facing || 1));
    }
    for (const s of [-1, 1]) {
      const flap = greek
        ? R([[cx + s * 0.4 * W, cut - 6 * u], [cx + s * 0.53 * W, cut - 2 * u], [cx + s * 0.5 * W, cut + 0.24 * HH], [cx + s * 0.38 * W, cut + 0.2 * HH]])
        : R([[cx + s * 0.4 * W, cut - 6 * u], [cx + s * 0.55 * W, cut], [cx + s * 0.52 * W, hc + 0.8 * H.b], [cx + s * 0.39 * W, hc + 0.74 * H.b]]);
      p.poly(flap, mul(col, greek ? [0.86, 0.84, 0.82] : [0.92, 0.9, 0.9]), ow * 0.8);
    }
    p.shadedFill(arc, col, mul(col, SH_FELT), light, H.a, 0.35);
    p.poly(arc, null, ow);
    if (greek) p.clip(arc, () => p.band(R([[cx - 0.6 * W, cut - 0.05 * HH], [cx + 0.6 * W, cut - 0.05 * HH]]), shade(col, 0.8), 0.06 * HH, 1.2 * u));
  } else if (o.hat === 'crown') {
    const yb = crown + 0.2 * HH, ht = 0.5 * HH, wb = 0.36 * W, wt = 0.38 * W, col = '#e8c45a', top = [];
    for (let i = 0; i <= 6; i++) {
      const x0 = cx - wt + (i * 2 * wt) / 7, x1 = cx - wt + ((i + 1) * 2 * wt) / 7, y = yb - ht - (i % 2 ? 0 : 0.1 * HH);
      top.push([x0, y], [x1, y]);
    }
    const body = R([...sag(yb, wb).reverse(), ...top]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.16 * HH], [cx + wt + 4 * u, yb - 0.16 * HH]]), '#2f5fae', 0.08 * HH, 1 * u));
    p.poly(body, null, ow);
    for (const k of [-2, -1, 0, 1, 2]) { const [gx, gy] = R([[cx + k * 0.13 * W, yb - 0.16 * HH]])[0]; p.dot(gx, gy, 3.2 * u, k % 2 ? '#d8323a' : '#f7f3ea'); }
  } else if (o.hat === 'bonnet') {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  }
};

// ─── cuerpos ───
const BUILD = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
};
const footStroke = (p, a, b, w, col) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};

export const bodyFront = (p, o, opts = {}) => {
  const { phase = 0, expr = 'neutral', mode = 'march', look = 0, blink = false, lift = 60, prop = null, tilt = 0, headTilt = 0, wave,
    light = DEF_LIGHT, facing = 0, seed = 1, raise = 0 } = opts;
  const Bd = BUILD[o.build ?? 'adult'], skin = o.skin ?? SKIN, lid = lidOf(blink);
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const tall = (1 + Bd.torso + Bd.legs) * HH, sole = 975;
  const bob = mode === 'march' ? 0.025 * tall * Math.cos(2 * TAU * phase) : mode === 'stroll' ? 0.015 * tall * Math.cos(2 * TAU * phase) : 0;
  const torsoBot = mode === 'sit' ? sole - 0.2 * HH : sole - Bd.legs * HH + bob;
  const chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots;
  const legW = 5.8 * u, footW = 7.5 * u;
  // piernas + pies
  p.rot = null;
  if (mode === 'sit') {
    for (const side of [-1, 1]) {
      const h = [300 + side * 15 * u, hipY], k = [300 + side * 36 * u, hipY + 0.2 * HH], f = [300 + side * 44 * u, sole - 8 * u];
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], footW, footCol);
    }
  } else if (mode === 'fall') {
    const legs = [
      [[300 - 15 * u, hipY], [300 - 46 * u, hipY + 0.5 * HH], [300 - 70 * u, hipY + 0.72 * HH]],
      [[300 + 15 * u, hipY], [300 + 50 * u, hipY + 0.45 * HH], [300 + 76 * u, hipY + 0.22 * HH]],
    ];
    legs.forEach(([h, k, f], i) => {
      p.stroke(curve(h, k, f), legW, legCol);
      footStroke(p, f, [f[0] + (i ? 14 : -14) * u, f[1] + (i ? -6 : 4) * u], footW, footCol);
    });
  } else if (o.dress) {
    for (const side of [-1, 1]) {
      const fx = 300 + side * 12 * u, fy = sole - 4 * u;
      p.stroke([[fx, sole - 0.4 * HH], [fx + side * u, fy]], legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 12 * u, fy + u], footW, footCol);
    }
  } else {
    const L = mode === 'march' ? lift * 1.25 : mode === 'stroll' ? lift * 0.55 : 0;
    for (const [side, ph] of [[-1, 0], [1, 0.5]]) {
      const up = Math.max(0, Math.sin(TAU * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
      const k = [(hx + fx) / 2 + side * (1.5 * u + up * 0.16), (hipY + fy) / 2 - up * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), legW, legCol);
      footStroke(p, [fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u], footW, footCol);
    }
  }
  // cuerpo superior: rota sobre la cadera (inclinación + vaivén)
  const sway = mode === 'march' ? 1.6 * Math.sin(TAU * phase) : mode === 'stroll' ? 1.0 * Math.sin(TAU * phase) : 0;
  const A = tilt + sway;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const dress = !!o.dress && mode !== 'sit' && mode !== 'fall';
  const T = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: o.build === 'stout' ? 0.17 : 0.12,
    asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side) => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const hang = (side, fwd) => {
    const S = sh(side), ex = tcx + side * (1.12 * T.a + 4 * u);
    const hx = ex + side * 3 * u - side * 6 * u * Math.max(0, fwd) + side * 4 * u * Math.max(0, -fwd);
    return [S, [ex, S[1] + 0.48 * HH], [hx, chin + 1.04 * HH - Math.abs(fwd) * 9 * u]];
  };
  const sw = mode === 'march' || mode === 'stroll' ? Math.sin(TAU * phase) : 0;
  const rz = clamp(raise, 0, 1);
  const R0 = lerp2([300 + 47 * u, torsoBot + 0.12 * HH], [300 + 62 * u, chin - 0.12 * HH], rz);
  const R1 = o.spear ? lerp2([300 + 62 * u, 46], [300 + 132 * u, 14], rz) : [300 + 64 * u, crown - 0.32 * HH];
  const rifle = (!!o.rifle || !!o.spear) && (mode === 'march' || mode === 'stand' || mode === 'stroll');
  const arms = [];
  if (mode === 'sit') for (const side of [-1, 1]) {
    if (side === 1 && Array.isArray(prop)) {
      const S = sh(1), k = clamp(prop[1], 0, 1);
      const E = lerp2([tcx + 1.1 * T.a + 10 * u, S[1] - 0.15 * HH], [tcx + 1.2 * T.a + 10 * u, S[1] + 0.3 * HH], k);
      const Hd = lerp2([tcx + 1.15 * T.a + 14 * u, S[1] - 0.55 * HH], [tcx + 1.45 * T.a + 22 * u, S[1] + 0.35 * HH], k);
      arms.push({ pts: [S, E, Hd], front: true });
    } else arms.push({ pts: [sh(side), [tcx + side * (1.1 * T.a + 6 * u), sh(side)[1] + 0.4 * HH], [tcx + side * (1.2 * T.a + 10 * u), torsoBot + 0.04 * HH]], front: false });
  }
  else if (mode === 'fall') for (const side of [-1, 1]) arms.push({ pts: [sh(side), [tcx + side * (1.15 * T.a + 12 * u), sh(side)[1] - 0.25 * HH], [tcx + side * (1.3 * T.a + 24 * u), sh(side)[1] - 0.68 * HH]], front: false });
  else {
    arms.push({ pts: prop === 'shako' ? hang(-1, 0) : hang(-1, -sw), front: false });
    if (rifle) {
      const G = lerp2(R0, R1, 0.1);
      arms.push({ pts: [sh(1), lerp2([tcx + 1.12 * T.a + 5 * u, sh(1)[1] + 0.45 * HH], [tcx + 1.4 * T.a + 14 * u, sh(1)[1] + 0.02 * HH], rz), G], front: false });
    } else if (wave !== undefined) {
      const S = sh(1);
      arms.push({ pts: [S, [tcx + 1.1 * T.a + 10 * u + 3 * u * wave, S[1] - 0.22 * HH], [tcx + 1.18 * T.a + 16 * u + 12 * u * wave, S[1] - 0.6 * HH]], front: false });
    } else arms.push({ pts: hang(1, sw), front: false });
  }
  const drawArm = (a) => { p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol); p.dot(a.pts[2][0], a.pts[2][1], 5.5 * u); };
  if (rifle && o.spear) {
    p.band([R0, R1], '#8a5a34', 3.8 * u, 1.3 * u, 'round');
    const [x, y] = R1, dx = (R1[0] - R0[0]) / Math.hypot(R1[0] - R0[0], R1[1] - R0[1]);
    p.poly([[x - 6 * u, y + 16 * u], [x + dx * 40, y - 24 * u], [x + 6 * u, y + 16 * u], [x, y + 22 * u]], '#d9a441', 1.6 * u);
  } else if (rifle) {
    p.band([R0, R1], '#7a4b2a', 5 * u, 1.5 * u, 'round');
    p.band([lerp2(R0, R1, 0.6), R1], '#8d949c', 2.4 * u, 1.2 * u, 'round');
  }
  if (o.cape && mode !== 'sit' && mode !== 'fall') {
    const S0 = sh(-1), S1 = sh(1), cp = [[S0[0] - 8 * u, S0[1] - 4 * u], [S1[0] + 8 * u, S1[1] - 4 * u],
      [tcx + 1.55 * T.a, sole - 0.32 * HH], [tcx + 0.4 * T.a, sole - 0.22 * HH], [tcx - 0.5 * T.a, sole - 0.26 * HH], [tcx - 1.6 * T.a, sole - 0.34 * HH]];
    p.gradFill(cp, o.cape, mul(o.cape, SH_CLOTH), light);
    p.inkRing(cp, ow, thick);
  }
  if (o.sword && mode !== 'sit') {
    const s0 = [tcx - 0.75 * T.a, torsoBot - 0.2 * HH];
    p.band([s0, [s0[0] - Math.sin(rad(25)) * 0.8 * HH, s0[1] + Math.cos(rad(25)) * 0.8 * HH]], '#c9ccd2', 3 * u, 1.2 * u, 'round');
  }
  for (const a of arms) if (!a.front) drawArm(a);
  if (dress) {
    const D = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0.03 * facing, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, o.dress, mul(o.dress, SH_CLOTH), light);
    p.inkRing(dp, ow, thick);
    const Sw = { a: 0.37 * W, b: 0.3 * HH, nTop: 2.2, nBot: 2.4, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: seed + 8 };
    const sp = blobPts(300, chin + 0.12 * HH, Sw);
    p.gradFill(sp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.inkRing(sp, ow * 0.9, thick);
  } else {
    p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
    p.clip(tp, () => {
      if (o.belt) {
        for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt, 5.5 * u, 1.8 * u);
        const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
        p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], '#d9dde0', 1.5 * u);
      }
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      for (let i = 0; i < 4; i++) {
        const y = chin + 0.12 * HH + i * 0.2 * HH;
        if (o.sash && Math.abs(y - (torsoBot - 0.32 * HH)) < 0.08 * HH) continue;
        p.dot(tcx + 2 * u * facing, y, 2.2 * u + 0.8 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
      }
    });
    if (o.sash) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
    p.inkRing(tp, ow, thick);
    if (o.shield) {
      const r = 0.95 * T.a, sx = tcx - 0.42 * T.a, sy = tcy + 0.05 * T.b, cp = [];
      for (let i = 0; i < 56; i++) { const t = (i / 56) * TAU; cp.push([sx + r * Math.cos(t), sy + r * Math.sin(t)]); }
      p.shadedFill(cp, o.shield, mul(o.shield, SH_CLOTH), light, r);
      p.inkRing(cp, ow, thick);
      p.arc(sx, sy, 0.8 * r, 0.8 * r, 0, 360, 1.6 * u, shade(o.shield, 0.7));
      for (let k = 0; k < 8; k++) { const t = (k / 8) * TAU; p.stroke([[sx + 0.16 * r * Math.cos(t), sy + 0.16 * r * Math.sin(t)], [sx + 0.55 * r * Math.cos(t), sy + 0.55 * r * Math.sin(t)]], 3 * u, '#f3d57a'); }
      p.dot(sx, sy, 0.15 * r, '#f3d57a');
    }
  }
  for (const a of arms) if (a.front) {
    drawArm(a);
    const [hx, hy] = a.pts[2];
    if (prop === 'icecream') {
      p.poly([[hx - 8 * u, hy - 12 * u], [hx + 8 * u, hy - 12 * u], [hx, hy + 7 * u]], '#e0a35a', 1.8 * u);
      p.ell(hx, hy - 19 * u, 11 * u, 10 * u, '#f7c6d9', 2.2 * u);
      p.dot(hx, hy, 5.5 * u);
    } else if (Array.isArray(prop) && prop[0] === 'sword') {
      const ang = rad(-25 + 60 * clamp(prop[1], 0, 1));
      const Rh = (pts) => rotPts(pts, ang, hx, hy);
      p.band(Rh([[hx, hy - 8 * u], [hx, hy - 105 * u]]), '#e3e7ec', 9 * u, 1.8 * u, 'butt');
      p.poly(Rh([[hx - 4.5 * u, hy - 105 * u], [hx, hy - 122 * u], [hx + 4.5 * u, hy - 105 * u]]), '#e3e7ec', 1.8 * u);
      p.band(Rh([[hx - 13 * u, hy - 8 * u], [hx + 13 * u, hy - 8 * u]]), '#e8c45a', 4 * u, 1.4 * u, 'round');
      p.band(Rh([[hx, hy + 9 * u], [hx, hy - 6 * u]]), '#6b3f22', 4.5 * u, 1.4 * u, 'round');
      p.dot(hx, hy, 5.5 * u);
    }
  }
  if (prop === 'shako') {
    const [hx, hy] = arms[0].pts[2];
    p.poly([[hx - 14 * u, hy + 3 * u], [hx + 14 * u, hy + 3 * u], [hx + 16 * u, hy + 30 * u], [hx - 16 * u, hy + 30 * u]], '#3a3d47', 2.2 * u);
    p.ell(hx, hy + 31 * u, 3.5 * u, 3.5 * u, '#2b7a4b', 1.5 * u);
    p.dot(hx, hy, 5.5 * u);
  }
  // cabeza: rota con el cuerpo + su propia inclinación sobre el mentón
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  hatBehind(p, o, H, 300, hc, light, thick, ow, false);
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.beard) p.ell(300 + 2 * u * facing, hc + 0.88 * H.b, 0.27 * W, 0.2 * HH, o.beard, ow * 0.8);
  hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
  const brim = !!o.hat && o.hat !== 'hair' && o.hat !== 'bonnet' && o.hat !== 'cap';
  faceFront(p, 300, hc, W, expr, facing, look, lid, brim, skin, o.moustache, o.build === 'stout');
  p.rot = null;
};

// ─── vista de lado (caminando hacia la derecha) ───
export const bodySide = (p, o, opts = {}) => {
  const { phase = 0, expr = 'neutral', mode = 'march', blink = false, stomp = 1, pose = 0, stride = 1, light = DEF_LIGHT, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? 'adult'], skin = o.skin ?? SKIN, lid = lidOf(blink);
  const H = { ...headBlob(seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u;
  const legLen = (Bd.legs + 0.12) * HH - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots;
  const legs = [];
  let hipY = ankY - legLen * 0.995, lean = 0, nearFwd = 0;
  if (mode === 'march') {
    const S = 370 * stride, liftH = Math.max(22, 40 + 70 * (stomp - 1));
    const st = (ph) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5;
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(TAU * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - 0.035 * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]])
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    lean = 4 + 3 * Math.cos(2 * TAU * phase);
    nearFwd = nL.x / (S / 2);
  } else if (mode === 'push') {
    hipY = ankY - 0.87 * legLen;
    legs.push({ ank: [300 - 0.5 * legLen, ankY], pitch: rad(-8), near: false }, { ank: [300 + 0.32 * legLen, ankY], pitch: 0, near: true });
    lean = 14 * pose;
  } else {
    legs.push({ ank: [300 - 4 * u, ankY], pitch: 0, near: false }, { ank: [300 + 4 * u, ankY], pitch: 0, near: true });
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH, hc = chin - H.b, crown = hc - H.b, hip = [300, hipY];
  p.rot = null;
  const ik = (hip0, ank, l1a, l2a) => {
    const dx = ank[0] - hip0[0], dy = ank[1] - hip0[1], d = clamp(Math.hypot(dx, dy), 1, l1a + l2a - 0.01);
    const A = Math.acos(clamp((l1a * l1a + d * d - l2a * l2a) / (2 * l1a * d), -1, 1)), k = Math.atan2(dy, dx) - A;
    return [hip0[0] + l1a * Math.cos(k), hip0[1] + l1a * Math.sin(k)];
  };
  for (const L of legs) {
    const knee = ik(hip, L.ank, l1, l2);
    const hp0 = [300 + (L.near ? 0 : -5 * u), hipY];
    p.stroke([hp0, knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + 13 * u * c, L.ank[1] + 13 * u * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const T = { a: (o.build === 'stout' ? 0.36 : 0.31) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5, egg: 0.1, asym: 0.06,
    rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const armCol = mix(o.jacket, INK, 0.5), farArm = mix(o.jacket, INK, 0.68);
  const S = [tcx + 0.05 * T.a, chin + 0.14 * HH], aLen = 0.95 * HH;
  const swingArm = (ang) => {
    const e = [S[0] + Math.sin(ang) * aLen * 0.5, S[1] + Math.cos(ang) * aLen * 0.5], a2 = ang + rad(16) * Math.sign(ang || 1);
    return [S, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };
  let near, far;
  if (mode === 'push') {
    const reach = 0.55 * HH + 0.45 * HH * pose;
    const hN = [S[0] + reach, S[1] + 0.06 * HH];
    near = [S, [(S[0] + hN[0]) / 2, (S[1] + hN[1]) / 2 + 0.06 * HH], hN];
    far = [S, [(S[0] + hN[0]) / 2 - 4 * u, (S[1] + hN[1]) / 2 - 0.02 * HH], [hN[0] - 6 * u, hN[1] - 0.08 * HH]];
  } else {
    near = swingArm(rad(-30) * nearFwd);
    far = mode === 'march' ? swingArm(rad(30) * nearFwd) : null;
  }
  if (far) { p.stroke(curve(far[0], far[1], far[2]), 5.2 * u, farArm); p.dot(far[2][0], far[2][1], 5.5 * u); }
  p.gradFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.belt) p.band([[tcx - 0.65 * T.a, chin - 0.05 * HH], [tcx + 0.75 * T.a, torsoBot - 0.1 * HH]], o.belt, 5.5 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (!o.dress) for (let i = 0; i < 3; i++) { const y = chin + 0.16 * HH + i * 0.24 * HH; p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7)); }
  });
  p.inkRing(tp, ow, thick);
  p.stroke(curve(near[0], near[1], near[2]), 5.2 * u, armCol); p.dot(near[2][0], near[2][1], 5.5 * u);
  const hx = 300 + 4 * u;
  hatBehind(p, o, H, hx, hc, light, thick, ow, true);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true);
  const brim = !!o.hat && o.hat !== 'hair' && o.hat !== 'bonnet' && o.hat !== 'cap';
  faceSide(p, hx, hc, W, expr, lid, brim, skin, o.moustache, o.build === 'stout');
  p.rot = null;
};

// ─── efectos 2D para el mundo: sombra alargada (128x256) y contacto bajo los pies (128x128) ───
export const fxShadow = (p, col) => {
  const g = p.g, gr = g.createRadialGradient(64, 86, 0, 64, 86, 62);
  gr.addColorStop(0, col); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(64, 86); g.scale(1, 2.0); g.translate(-64, -86);
  g.fillStyle = gr; g.beginPath(); g.arc(64, 86, 62, 0, Math.PI * 2); g.fill(); g.restore();
};
export const fxContact = (p, col) => {
  const g = p.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 58);
  gr.addColorStop(0, col); gr.addColorStop(0.62, col.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(64, 64); g.scale(1, 0.62); g.translate(-64, -64);
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.restore();
};

// ─── vestuarios predefinidos ───
export const SKINS = [SKIN, '#f5c9a0', '#ecd0b6', '#c99067'];
export const RIFLEMAN = { jacket: '#357650', pants: '#3d4440', boots: INK, hat: 'shako', belt: '#f1efe6', buttons: '#d9dde0', rifle: true };
export const OFFICER = { ...RIFLEMAN, hat: 'shako_tall', buttons: '#e8c45a', sash: '#c0353a', sword: true, moustache: '#4a3020', rifle: false, belt: null, build: 'stout' };
export const KID = { jacket: '#f08a2c', pants: '#3b5b9a', boots: '#f4f1ea', hat: 'cap', cap: '#e2453c', build: 'kid' };
export const PARENT = { jacket: '#7b5ac9', pants: '#3b3f52', boots: '#5a3b2a', hat: 'hair', hair: '#5a3b2a' };
export const SOLDADO = (v = 0, extra = {}) => {
  const o = { ...RIFLEMAN, skin: SKINS[v % 4], spear: true, shield: '#b03a2e' };
  if (v % 4 === 1) o.moustache = '#4a3426';
  if (v % 4 === 3) o.moustache = '#2a201a';
  return { ...o, ...extra };
};
export const PUEBLANO = (v = 0, extra = {}) => {
  const coats = ['#3f6fb5', '#8c3b4a', '#5d7a3a', '#b5653f', '#2f5f6a', '#7b5ac9'];
  const o = { jacket: coats[v % 6], pants: '#3b3f52', boots: '#4a3426', skin: SKINS[v % 4] };
  return v % 2 ? { ...o, hat: 'bonnet', dress: ['#d9a441', '#c25a7a', '#5a8fc2'][v % 3], ...extra } : { ...o, hat: 'tophat', ...extra };
};
export const REY = (v = 0, extra = {}) => ({ jacket: '#c0353a', pants: '#7a2a34', boots: INK, hat: 'greek_gold', cape: '#b58b3a', sash: '#e8c45a', beard: '#5a4632', skin: SKINS[v % 4], sword: true, ...extra });
