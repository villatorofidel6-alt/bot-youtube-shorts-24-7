// gen.js — Stick Story paramétrico: convierte plan.json en las tomas 2D del monigote.
// Cada "toma": { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde).
// Escenas: figura · habla · accion · obstaculo · caida · idea · duelo · final
// Anclas: ancla_etiqueta · ancla_texto · ancla_golpe (choque/caída) · ancla_idea
import { ctx, W, H, TAU, lerp, clamp, seg, eio, eob, rnd, rr, circle, ell, line, fillAll, bigText } from './lib.js';
import { L, Wd, T } from './timing.js';
import * as K from './kit.js';

const INK = '#22221F', PAPEL = '#F6F5EF', GRILLA = '#E3E1D5', ROJO = '#D62839', VERDE = '#2E8B57', AMAR = '#FFD43B';

// ─── pizarra de fondo con grilla tenue ───
function pizarra() {
  fillAll(PAPEL);
  ctx.strokeStyle = GRILLA; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
  for (let x = 60; x < W; x += 130) { ctx.beginPath(); ctx.moveTo(x, -100); ctx.lineTo(x, H + 100); ctx.stroke(); }
  for (let y = 80; y < H; y += 130) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(W + 100, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// ─── segmento parcial: de a hacia b, fracción f (0..1) ───
function segLine(a, b, f, w) {
  if (f <= 0) return;
  line([a, [lerp(a[0], b[0], Math.min(1, f)), lerp(a[1], b[1], Math.min(1, f))]], INK, w);
}

// ─── el MONIGOTE ───
// o = { x, y, s, aL, aR, lL, lR, lean, dy, bend, face, prog } — ángulos en radianes (0 = colgando)
// aL/aR: brazo izq/der · lL/lR: pierna izq/der · lean: inclinación del cuerpo · prog: trazado parcial (0..1)
export function stick(o) {
  const s = o.s || 1, p = o.prog == null ? 1 : clamp(o.prog);
  ctx.save(); ctx.translate(o.x, o.y + (o.dy || 0)); ctx.scale(s, s); ctx.rotate(o.lean || 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const f = (k) => clamp((p - k * 0.16) * 3.4);
  // cuerpo
  segLine([0, -224], [0, 60], f(0), 15);
  // cabeza
  if (f(1) > 0) {
    ctx.save(); ctx.scale(Math.min(1, f(1)), Math.min(1, f(1)));
    ctx.beginPath(); ctx.arc(0, -272, 46, 0, TAU); ctx.lineWidth = 13; ctx.strokeStyle = INK; ctx.stroke();
    const face = o.face || 'smile';
    circle(-15, -284, 6, INK); circle(15, -284, 6, INK);
    ctx.lineWidth = 7; ctx.strokeStyle = INK;
    if (face === 'o') { circle(0, -262, 12, INK); }
    else if (face === 'flat') { line([[-14, -258], [14, -258]], INK, 7); }
    else if (face === 'shock') { ctx.beginPath(); ctx.arc(0, -258, 16, 0, TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, -266, 15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    if (o.brow) line([[-24, -300 - o.brow * 10], [-6, -296 - o.brow * 10]], INK, 6), line([[6, -296 - o.brow * 10], [24, -300 - o.brow * 10]], INK, 6);
    ctx.restore();
  }
  // brazo: codo en ang desde "colgando", mano con doblez
  const arm = (sx, ang, fr, espejo) => {
    if (fr <= 0) return;
    const a = espejo ? -ang : ang, b = espejo ? -(o.bend ?? 0.35) : (o.bend ?? 0.35);
    const ex = Math.sin(a) * 96, ey = Math.cos(a) * 96;
    segLine([sx, -180], [sx + ex, -180 + ey], fr, 12);
    const hx = sx + ex + Math.sin(a + b) * 82, hy = -180 + ey + Math.cos(a + b) * 82;
    segLine([sx + ex, -180 + ey], [hx, hy], fr, 10);
    if (fr >= 1) circle(hx, hy, 8, INK);
  };
  arm(-24, o.aL ?? 0.12, f(2), true);
  arm(24, o.aR ?? 0.12, f(3), false);
  // pierna: cadera (±14, 60)
  const leg = (sx, ang, fr, espejo) => {
    if (fr <= 0) return;
    const a = espejo ? -ang : ang, b = espejo ? -0.12 : 0.12;
    const kx = Math.sin(a) * 100, ky = Math.cos(a) * 100;
    segLine([sx, 60], [sx + kx, 60 + ky], fr, 13);
    segLine([sx + kx, 60 + ky], [sx + kx + Math.sin(a + b) * 92, 60 + ky + Math.cos(a + b) * 92], fr, 11);
  };
  leg(-14, o.lL ?? 0.06, f(4), true);
  leg(14, o.lR ?? 0.06, f(5), false);
  ctx.restore();
}

// pose de carrera según fase ph
const runPose = (ph) => ({ aL: -Math.sin(ph) * 0.75 + 0.25, aR: Math.sin(ph) * 0.75 + 0.25, lL: Math.sin(ph) * 0.8, lR: -Math.sin(ph) * 0.8, dy: -Math.abs(Math.cos(ph)) * 16, lean: 0.14 });

// ─── burbuja de diálogo con texto envuelto ───
function burbuja(texto, x, y, sc = 1) {
  if (sc <= 0) return;
  const palabras = String(texto).split(' ');
  const lins = []; let cur = '';
  for (const w of palabras) {
    if ((cur + ' ' + w).trim().length > 15 && cur) { lins.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lins.push(cur);
  const wTxt = Math.max(...lins.map((l) => l.length)) * 26 + 70;
  const h = lins.length * 46 + 46;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineJoin = 'round';
  rr(-wTxt / 2, -h, wTxt, h, 34); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(6, 52); ctx.lineTo(26, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(2, 48); ctx.lineTo(20, -10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK; ctx.font = '800 36px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lins.forEach((l, i) => ctx.fillText(l, 0, -h + 46 + i * 46 + 14));
  ctx.restore();
}

export function buildShots(PLAN) {
  const S = [], CUES = [];
  const add = (o) => (S.push(o), o);
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.08);
  const R = (v, d) => (v == null ? d : v);
  const fin = (sh) => { const nx = PLAN.tomas[PLAN.tomas.indexOf(sh) + 1]; return nx ? cut(nx.linea) : T.dur; };
  const pop = (sh, st, key, def) => { const a = sh.params?.[`ancla_${key}`]; return a ? Math.max(0, Wd(a, sh.linea) - st) : def; };

  for (const sh of PLAN.tomas) {
    const st = sh.linea === 0 ? 0 : Math.max(cut(sh.linea), S[S.length - 1]?.at + 0.01 || 0);
    const d = fin(sh) - st;
    const P = sh.params || {};
    const esc = sh.escena;

    // 1 · figura — el monigote se traza a sí mismo + etiqueta
    if (esc === 'figura') {
      const pt = pop(sh, st, 'etiqueta', 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'el monigote se dibuja', draw(lt, dt, t) {
        pizarra();
        stick({ x: 540, y: 1150, s: 1.35, prog: eio(seg(lt, 0.15, 1.3)), face: 'smile' });
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 420, 58, INK, '#F5F2E8', eob(seg(lt, pt, pt + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + 1.35, 'pop', { gain: 0.55 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 2 · habla — burbuja con el texto sobre el monigote (ancla_texto)
    else if (esc === 'habla') {
      const at = pop(sh, st, 'texto', 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'burbuja de diálogo', draw(lt, dt, t) {
        pizarra();
        const p = eob(seg(lt, at, at + 0.35));
        stick({ x: 540, y: 1250, s: 1.3, aL: 0.5, aR: 0.5, dy: Math.sin(lt * 2) * 6, face: 'smile' });
        burbuja(P.texto || '¡...', 540, 900, p);
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 440, 56, INK, '#F5F2E8', eob(seg(lt, 0.25, 0.55)));
      } });
      cue(st, 'whoosh'); cue(st + at, 'pop', { gain: 0.6 });
    }

    // 3 · accion — el monigote corre (ciclo) con líneas de velocidad
    else if (esc === 'accion') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'corriendo', draw(lt, dt, t) {
        pizarra();
        const ph = lt * 9.5;
        stick({ x: 540, y: 1180, s: 1.35, ...runPose(ph), face: 'flat', brow: 0.5 });
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 4; i++) line([[900, 900 + i * 110], [1060 + (lt * 300 + i * 60) % 120, 900 + i * 110]], INK, 8);
        ctx.globalAlpha = 1;
        const tx = P.texto, pt = pop(sh, st, 'texto', 0.35);
        if (tx) K.pill(tx, 540, 480, 54, INK, '#F5F2E8', eob(seg(lt, pt, pt + 0.25)));
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1420, 54, INK, '#F5F2E8', eob(seg(lt, pt + 0.2, pt + 0.5)));
      } });
      cue(st, 'whoosh'); cue(st + 0.1, 'slide', { dur: Math.max(0.6, d - 0.2), gain: 0.6 });
      if (P.texto || P.etiqueta) cue(st + pop(sh, st, 'texto', 0.35), 'pop');
    }

    // 4 · obstaculo — el muro aparece y el monigote frena en seco (ancla_golpe)
    else if (esc === 'obstaculo') {
      const gp = pop(sh, st, 'golpe', d * 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'muro en el camino', draw(lt, dt, t) {
        pizarra();
        const muro = eio(seg(lt, 0.25, 0.75));
        ctx.save(); ctx.translate(870, 950); ctx.scale(muro, muro);
        rr(-80, -330, 160, 660, 16); ctx.fillStyle = '#DED9C8'; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.lineWidth = 6;
        for (let i = -5; i < 6; i++) { line([[-80, i * 60], [80, i * 60 - 40]], INK, 6); }
        ctx.globalAlpha = 1; ctx.restore();
        const fren = lt > gp ? eob(seg(lt, gp, gp + 0.3)) : 0;
        const ph = lt * 9.5 * (1 - fren);
        stick({ x: lerp(360, 560, eio(seg(lt, 0.2, gp))), y: 1180, s: 1.3,
          ...(ph > 0 ? runPose(ph) : {}), aL: lerp(runPose(ph).aL, 0.9, fren), aR: lerp(runPose(ph).aR, 0.9, fren),
          lean: lerp(runPose(ph).lean, -0.22, fren), dy: runPose(ph).dy * (1 - fren), face: fren > 0.5 ? 'shock' : 'flat', brow: fren > 0.5 ? 1 : 0.5 });
        if (fren > 0) K.burst(800, 1050, 1.0, Math.exp(-(lt - gp) * 6) * fren);
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 420, 56, ROJO, '#F7EDE0', eob(seg(lt, gp, gp + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + gp, 'thud', { gain: 0.75 });
      if (P.etiqueta) cue(st + pop(sh, st, 'golpe', d * 0.5), 'pop');
    }

    // 5 · caida — el monigote cae de espaldas y rebota (ancla_golpe)
    else if (esc === 'caida') {
      const gp = pop(sh, st, 'golpe', d * 0.45);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'caída de espaldas', draw(lt, dt, t) {
        pizarra();
        const cae = lt > gp ? eob(seg(lt, gp, gp + 0.55)) : 0;
        const reb = lt > gp ? Math.sin((lt - gp) * 18) * 0.09 * Math.exp(-(lt - gp) * 4) : 0;
        stick({ x: 540, y: 1180, s: 1.35, aL: lerp(0.3, 2.6, cae), aR: lerp(0.3, 2.9, cae), lL: lerp(0.1, 0.75, cae), lR: lerp(0.1, -0.2, cae),
          lean: lerp(-0.1, 1.42, cae) + reb, dy: lerp(0, 130, cae), face: cae > 0.6 ? 'o' : 'shock', brow: 1 });
        if (cae > 0) { K.burst(470, 1400, 1.1, Math.exp(-(lt - gp) * 5)); ctx.globalAlpha = 0.4 * Math.exp(-(lt - gp) * 2);
          for (let i = 0; i < 3; i++) ell(430 + i * 110, 1420, 60, 14, '#CFC9B4'); ctx.globalAlpha = 1; }
        const tx = P.texto, pt = pop(sh, st, 'texto', gp + 0.5);
        if (tx) burbuja(tx, 540, 620, eob(seg(lt, pt, pt + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + gp, 'plop', { gain: 0.8 }); cue(st + gp + 0.3, 'boing', { gain: 0.5 });
      if (P.texto) cue(st + pop(sh, st, 'texto', gp + 0.5), 'pop');
    }

    // 6 · idea — bombilla sobre la cabeza (ancla_idea) + texto
    else if (esc === 'idea') {
      const at = pop(sh, st, 'idea', d * 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'momento eureka', draw(lt, dt, t) {
        pizarra();
        stick({ x: 540, y: 1250, s: 1.3, aL: 0.15, aR: 0.15, dy: Math.sin(lt * 2.4) * 5, face: 'smile', brow: 0.6 });
        const bp = eob(seg(lt, at, at + 0.4));
        if (bp > 0) {
          ctx.save(); ctx.translate(540, 780); ctx.scale(bp, bp);
          ctx.strokeStyle = AMAR; ctx.lineCap = 'round'; ctx.lineWidth = 10;
          ctx.save(); ctx.rotate(t * 0.9);
          for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); line([[0, -84], [0, -112 - (i % 2) * 12]], AMAR, 10); }
          ctx.restore();
          circle(0, 0, 62, AMAR);
          rr(-24, 62, 48, 34, 8); ctx.fillStyle = '#8C8474'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
          line([[-18, -18], [18, -18]], '#B8901F', 6); line([[-14, 0], [14, 0]], '#B8901F', 6); line([[-10, 18], [10, 18]], '#B8901F', 6);
          ctx.restore();
        }
        const tx = P.texto, pt = pop(sh, st, 'texto', at + 0.4);
        if (tx) K.pill(tx, 540, 520, 54, INK, '#F5F2E8', eob(seg(lt, pt, pt + 0.3)));
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1460, 54, AMAR, INK, eob(seg(lt, at + 0.3, at + 0.6)));
      } });
      cue(st, 'whoosh'); cue(st + at, 'sparkle', { gain: 0.9 }); cue(st + at + 0.15, 'pop', { gain: 0.5 });
    }

    // 7 · duelo — dos monigotes cara a cara con chispa entre ellos
    else if (esc === 'duelo') {
      const at = pop(sh, st, 'golpe', d * 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'cara a cara', draw(lt, dt, t) {
        pizarra();
        stick({ x: 340, y: 1200, s: 1.25, aL: 0.9, aR: 1.4, lL: 0.5, lR: -0.25, lean: 0.1, face: 'flat', brow: 1 });
        stick({ x: 760, y: 1200, s: 1.25, aL: 1.4, aR: 0.9, lL: -0.25, lR: 0.5, face: 'o', brow: 1 });
        const fl = lt > at ? (0.55 + 0.45 * Math.sin(lt * 42)) : 0;
        if (fl > 0) {
          ctx.save(); ctx.globalAlpha = fl; ctx.strokeStyle = ROJO; ctx.lineWidth = 9; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(430, 1020);
          for (let i = 1; i <= 6; i++) ctx.lineTo(430 + i * 70, 1020 + (i % 2 ? -1 : 1) * (14 + rnd(i + lt * 7) * 26));
          ctx.stroke(); ctx.restore();
        }
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.35);
        if (et) K.pill(et, 540, 430, 60, ROJO, '#F7EDE0', eob(seg(lt, pt, pt + 0.3)));
        const tx = P.texto;
        if (tx) K.pill(tx, 540, 1520, 52, INK, '#F5F2E8', eob(seg(lt, at, at + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + at, 'alarm', { dur: Math.max(0.8, d - at), gain: 0.5 });
      if (P.etiqueta) cue(st + pop(sh, st, 'etiqueta', 0.35), 'pop');
    }

    // 8 · final — pose de victoria, check verde y cierre
    else if (esc === 'final') {
      const pt = pop(sh, st, 'etiqueta', 0.6);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'victoria', draw(lt, dt, t) {
        pizarra();
        const salt = Math.abs(Math.sin(lt * 2.6));
        stick({ x: 540, y: 1180, s: 1.35, aL: 2.55, aR: 2.55, bend: 0.12, lL: 0.12, lR: -0.12, dy: -salt * 36, face: 'smile', brow: 0.8 });
        const cp = eob(seg(lt, 0.3, 0.8));
        if (cp > 0) {
          ctx.save(); ctx.translate(540, 620); ctx.scale(cp, cp);
          circle(0, 0, 130, 'rgba(46,139,87,0.12)');
          ctx.lineWidth = 17; ctx.strokeStyle = VERDE; ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.stroke();
          line([[-50, 4], [-10, 46], [56, -42]], VERDE, 21);
          ctx.restore();
        }
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1350, 60, VERDE, '#F0F7EC', eob(seg(lt, pt, pt + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + 0.35, 'sparkle'); cue(st + 0.9, 'slam', { gain: 0.6 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
