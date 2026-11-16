// gen.js — Paper Atlas paramétrico: convierte plan.json en las tomas 2D del mapa.
// Cada "toma": { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde).
// Escenas: mapa · ruta · pin · zona · dato · sello · brujula · final
// Anclas: ancla_etiqueta · ancla_texto · ancla_x (momento del dato/pin/sello)
import { ctx, W, H, TAU, lerp, clamp, seg, eio, eob, rnd, rr, circle, ell, line, fillAll } from './lib.js';
import { L, Wd, T } from './timing.js';
import * as K from './kit.js';

// paleta propia del atlas (sobre la lib de inside-out, que solo da primitivas)
const PA = {
  papel: '#EFE4C9', papel2: '#E5D5AF', tinta: '#4A3B2A', tintaSuave: '#6B5A42',
  mar: '#B4D6E4', marOnda: '#8FB8CC', tierra: '#DCC79C', tierra2: '#CBB083',
  costa: '#7A6448', bosque: '#8FA977', mont: '#B09A72', ruta: '#C0392B',
  pin: '#C0392B', oro: '#B8862D', check: '#2E8B57',
};

// ─── la RUTA del mapa (puntos fijos del atlas) ───
const RUTA = [[280, 1430], [400, 1230], [470, 1080], [390, 940], [520, 800], [650, 700], [720, 560], [820, 470]];
const DEST = RUTA[RUTA.length - 1];

// longitud acumulada de la ruta
const CUM = [0];
for (let i = 1; i < RUTA.length; i++) CUM.push(CUM[i - 1] + Math.hypot(RUTA[i][0] - RUTA[i - 1][0], RUTA[i][1] - RUTA[i - 1][1]));
const TOTAL = CUM[CUM.length - 1];
const rutaPunto = (dist) => {
  const d = clamp(dist, 0, TOTAL); let i = 1;
  while (i < CUM.length - 1 && CUM[i] < d) i++;
  const k = (d - CUM[i - 1]) / ((CUM[i] - CUM[i - 1]) || 1);
  return [lerp(RUTA[i - 1][0], RUTA[i][0], k), lerp(RUTA[i - 1][1], RUTA[i][1], k)];
};

// ─── el MAPA base: pergamino, masas de tierra, decoración y ruta punteada hasta `k` (0..1) ───
function mapaBase(k = 0, t = 0) {
  fillAll(PA.mar);
  // pergamino de bordes (vigñeta cálida del papel)
  ctx.save();
  ctx.strokeStyle = PA.papel2; ctx.lineWidth = 90; ctx.globalAlpha = 0.55;
  ctx.strokeRect(-90, -90, W + 180, H + 180); ctx.restore();
  // ondas del mar
  ctx.strokeStyle = PA.marOnda; ctx.globalAlpha = 0.35; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const y = 160 + i * 118 + Math.sin(t * 0.7 + i) * 6, x0 = ((i * 397) % 500) - 120;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + 140, y - 12, x0 + 280, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // masas de tierra (blobs deterministas)
  const blob = (pts, fill, stroke) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const nx = i === 0 ? pts[pts.length - 1] : pts[i - 1];
      const mx = (x + nx[0]) / 2, my = (y + nx[1]) / 2;
      i === 0 ? ctx.moveTo(mx, my) : ctx.quadraticCurveTo(nx[0], nx[1], mx, my);
    });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 9; ctx.strokeStyle = stroke; ctx.stroke();
  };
  blob([[180, 1180], [140, 980], [260, 820], [430, 760], [560, 860], [600, 1060], [500, 1260], [330, 1330]], PA.tierra, PA.costa);
  blob([[560, 640], [620, 480], [780, 380], [940, 420], [1000, 560], [940, 700], [780, 720]], PA.tierra2, PA.costa);
  blob([[760, 1240], [820, 1120], [960, 1100], [1020, 1240], [950, 1380], [820, 1360]], PA.tierra, PA.costa);
  // bosque y montañas
  ctx.fillStyle = PA.bosque;
  for (let i = 0; i < 9; i++) ell(300 + rnd(i) * 220, 900 + rnd(i + 5) * 280, 34, 24, PA.bosque, rnd(i) * 3);
  for (let i = 0; i < 6; i++) {
    const mx = 640 + rnd(i + 9) * 260, my = 470 + rnd(i + 3) * 120;
    ctx.beginPath(); ctx.moveTo(mx - 46, my + 34); ctx.lineTo(mx, my - 44); ctx.lineTo(mx + 46, my + 34); ctx.closePath();
    ctx.fillStyle = PA.mont; ctx.fill(); ctx.strokeStyle = PA.costa; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 14, my - 12); ctx.lineTo(mx, my - 44); ctx.lineTo(mx + 14, my - 12); ctx.closePath();
    ctx.fillStyle = '#F3F0E6'; ctx.fill();
  }
  // la ruta punteada hasta k
  ctx.strokeStyle = PA.ruta; ctx.fillStyle = PA.ruta;
  const hasta = k * TOTAL;
  for (let d = 0; d <= hasta; d += 30) {
    const [x, y] = rutaPunto(d);
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
  }
  if (k >= 1) { ctx.beginPath(); ctx.moveTo(DEST[0] - 30, DEST[1] - 30); ctx.lineTo(DEST[0] + 30, DEST[1] + 30); ctx.moveTo(DEST[0] + 30, DEST[1] - 30); ctx.lineTo(DEST[0] - 30, DEST[1] + 30); ctx.lineWidth = 10; ctx.stroke(); }
  // brújula de esquina
  ctx.save(); ctx.translate(870, 1640); ctx.globalAlpha = 0.9;
  circle(0, 0, 92, 'rgba(255,255,255,0.55)');
  ctx.lineWidth = 6; ctx.strokeStyle = PA.tinta; ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -74); ctx.lineTo(16, 0); ctx.lineTo(0, 20); ctx.lineTo(-16, 0); ctx.closePath();
  ctx.fillStyle = PA.ruta; ctx.fill();
  ctx.font = '900 40px Inter'; ctx.fillStyle = PA.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -110);
  ctx.restore();
  // grano del papel
  ctx.globalAlpha = 0.05; ctx.fillStyle = PA.tinta;
  for (let i = 0; i < 90; i++) ctx.fillRect(rnd(i * 3.1) * W, rnd(i * 7.7) * H, 3, 3);
  ctx.globalAlpha = 1;
}

// ─── pin de mapa: cabeza redonda + cola ───
function pin(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, -44); ctx.lineTo(-16, -44); ctx.closePath(); ctx.fillStyle = PA.pin; ctx.fill();
  circle(0, -58, 30, PA.pin); circle(-8, -66, 9, 'rgba(255,255,255,0.75)');
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

    // 1 · mapa — el atlas entero con pan lento y etiqueta del mapa
    if (esc === 'mapa') {
      const pt = pop(sh, st, 'etiqueta', 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'atlas completo', cam: [540, 880], draw(lt, dt, t) {
        ctx.save(); ctx.translate(Math.sin(lt * 0.5) * 12, Math.cos(lt * 0.4) * 8);
        mapaBase(0, t);
        ctx.restore();
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 340, 62, PA.tinta, '#F3EAD2', eob(seg(lt, pt, pt + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + 0.15, 'slide', { dur: Math.max(0.6, d - 0.3), gain: 0.45 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 2 · ruta — la ruta punteada se dibuja hasta el destino
    else if (esc === 'ruta') {
      const tx = P.texto, pt = pop(sh, st, 'texto', d * 0.55);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'trazando la ruta', cam: [540, 950], draw(lt, dt, t) {
        mapaBase(eio(seg(lt, 0.2, d - 0.35)), t);
        const [hx, hy] = rutaPunto(eio(seg(lt, 0.2, d - 0.35)) * TOTAL);
        K.burst(hx, hy, 0.7, 0.5 + 0.3 * Math.sin(lt * 9));
        if (tx) K.pill(tx, 540, 1500, 56, PA.tinta, '#F3EAD2', eob(seg(lt, pt, pt + 0.25)));
      } });
      cue(st, 'whoosh'); cue(st + 0.2, 'slide', { dur: Math.max(0.8, d - 0.4), gain: 0.55 });
      cue(st + d - 0.4, 'sparkle');
      if (tx) cue(st + pt, 'pop');
    }

    // 3 · pin — el pin cae sobre el destino y estalla
    else if (esc === 'pin') {
      const at = pop(sh, st, 'x', d * 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'pin del destino', cam: [720, 700], draw(lt, dt, t) {
        mapaBase(1, t);
        const cae = eob(seg(lt, at, at + 0.4));
        if (lt < at) pin(DEST[0], DEST[1] - 520, 0.9);
        else pin(DEST[0], DEST[1] - (1 - cae) * 40, 0.9 + cae * 0.35);
        if (lt > at && lt < at + 0.5) K.burst(DEST[0], DEST[1], 1.1, Math.exp(-(lt - at) * 6));
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', at + 0.35);
        if (et) K.tag(et, DEST[0] + 250, DEST[1] - 330, DEST[0] + 40, DEST[1] - 110, 56, eob(seg(lt, pt, pt + 0.25)));
      } });
      cue(st, 'whoosh'); cue(st + at, 'thud', { gain: 0.7 });
      if (P.etiqueta) cue(st + pop(sh, st, 'etiqueta', at + 0.35), 'pop');
    }

    // 4 · zona — círculo punteado que pulsa alrededor del punto
    else if (esc === 'zona') {
      const at = pop(sh, st, 'etiqueta', 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'zona marcada', cam: [700, 760], draw(lt, dt, t) {
        mapaBase(1, t);
        const r = 150 * eob(seg(lt, at, at + 0.45)) * (1 + 0.05 * Math.sin(lt * 6));
        if (r > 2) {
          ctx.save(); ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 60;
          ctx.lineWidth = 9; ctx.strokeStyle = PA.ruta;
          ctx.beginPath(); ctx.arc(DEST[0], DEST[1], r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha = 0.09; ctx.fillStyle = PA.ruta; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
        }
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1330, 58, PA.ruta, '#F7EDE0', eob(seg(lt, at + 0.2, at + 0.5)));
      } });
      cue(st, 'whoosh'); if (P.etiqueta) cue(st + pop(sh, st, 'etiqueta', 0.4), 'pop');
    }

    // 5 · dato — el número/texto del atlas entra grande (ancla_x)
    else if (esc === 'dato') {
      const at = pop(sh, st, 'x', d * 0.4);
      const num = `${P.numero ?? ''}${P.numero && P.texto ? ' ' : ''}${P.texto ?? ''}`.trim();
      add({ id: sh.id, at: st, linea: sh.linea, note: 'dato del atlas', cam: [540, 900], draw(lt, dt, t) {
        ctx.save(); ctx.translate(Math.sin(lt * 0.4) * 8, 0);
        mapaBase(1, t); ctx.restore();
        const shake = lt > at ? Math.sin(lt * 70) * 7 * Math.exp(-(lt - at) * 6) : 0;
        ctx.save(); ctx.translate(shake, 0);
        K.pill(num, 540, 960, 86, 'rgba(46,36,24,0.9)', PA.oro, eob(seg(lt, at, at + 0.3)));
        ctx.restore();
      } });
      cue(st, 'whoosh'); cue(st + at, 'slam', { gain: 0.7 });
    }

    // 6 · sello — la estampa roja cae con golpe (ancla_x)
    else if (esc === 'sello') {
      const at = pop(sh, st, 'x', d * 0.45);
      const txt = R(P.sello, 'OFICIAL');
      add({ id: sh.id, at: st, linea: sh.linea, note: 'estampa del atlas', cam: [540, 900], draw(lt, dt, t) {
        mapaBase(1, t);
        const p = lt < at ? 0 : eob(clamp((lt - at) / 0.3));
        const sc = lerp(2.1, 1, p), rot = lerp(-0.35, -0.14, p);
        const shake = lt > at + 0.05 ? Math.sin(lt * 60) * 6 * Math.exp(-(lt - at) * 7) : 0;
        ctx.save(); ctx.translate(540 + shake, 950); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = 0.16 + p * 0.7;
        circle(0, 0, 200, 'none'); ctx.lineWidth = 14; ctx.strokeStyle = PA.pin;
        ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.stroke();
        ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 168, 0, TAU); ctx.stroke();
        ctx.fillStyle = PA.pin;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * TAU / 5;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 134, Math.sin(a) * 134, 11, 0, TAU); ctx.fill();
        }
        ctx.font = '900 64px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      } });
      cue(st, 'whoosh'); cue(st + at, 'slam', { gain: 0.85 }); cue(st + at + 0.1, 'thud', { gain: 0.5 });
    }

    // 7 · brujula — la rosa de los vientos y la aguja que se asienta
    else if (esc === 'brujula') {
      const at = pop(sh, st, 'etiqueta', d * 0.45);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'brújula centrando', cam: [540, 880], draw(lt, dt, t) {
        ctx.save(); ctx.globalAlpha = 0.35; mapaBase(0.4, t); ctx.globalAlpha = 1;
        ctx.translate(540, 900);
        circle(0, 0, 330, 'rgba(255,255,255,0.65)');
        ctx.lineWidth = 12; ctx.strokeStyle = PA.tinta; ctx.beginPath(); ctx.arc(0, 0, 330, 0, TAU); ctx.stroke();
        ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 280, 0, TAU); ctx.stroke();
        for (let i = 0; i < 16; i++) { ctx.save(); ctx.rotate(i * TAU / 16); line([[0, -330], [0, i % 4 ? -296 : -266]], PA.tinta, i % 4 ? 5 : 9); ctx.restore(); }
        // estrella de 4 puntas
        ctx.fillStyle = PA.tinta;
        for (const [dx, dy, big] of [[0, -1, 1], [1, 0, 0], [0, 1, 0], [-1, 0, 0]]) {
          ctx.beginPath(); ctx.moveTo(dx * (big ? 240 : 150), dy * (big ? 240 : 150));
          ctx.quadraticCurveTo(dy * 34, dx * 34, -dx * 60, -dy * 60); ctx.closePath(); ctx.fill();
        }
        // aguja con wobble que se asienta en el ancla
        const wob = lt < at ? Math.sin(lt * 11) * (1.35 * Math.exp(-lt * 1.4) + 0.18) : Math.sin((lt - at) * 26) * 0.2 * Math.exp(-(lt - at) * 9);
        ctx.save(); ctx.rotate(wob);
        ctx.beginPath(); ctx.moveTo(0, -240); ctx.lineTo(26, 0); ctx.lineTo(0, 34); ctx.lineTo(-26, 0); ctx.closePath();
        ctx.fillStyle = PA.ruta; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 240); ctx.lineTo(26, 0); ctx.lineTo(0, -34); ctx.lineTo(-26, 0); ctx.closePath();
        ctx.fillStyle = '#F3EAD2'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = PA.tinta; ctx.stroke();
        ctx.restore();
        circle(0, 0, 26, PA.tinta); circle(-7, -7, 7, 'rgba(255,255,255,0.6)');
        ctx.font = '900 52px Inter'; ctx.fillStyle = PA.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('NORTE', 0, -386);
        ctx.restore();
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1520, 58, PA.tinta, '#F3EAD2', eob(seg(lt, at, at + 0.3)));
      } });
      cue(st, 'whoosh'); for (let z = 0.35; z < d - 0.3; z += 0.5) cue(st + z, 'tock', { gain: 0.5 });
      if (P.etiqueta) cue(st + at, 'pop');
    }

    // 8 · final — ruta completa, check verde y cierre del mapa
    else if (esc === 'final') {
      const pt = pop(sh, st, 'etiqueta', 0.6);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'cierre del atlas', cam: [540, 900], draw(lt, dt, t) {
        ctx.save(); const z = lerp(1.06, 1, eio(clamp(lt / d)));
        ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
        mapaBase(1, t); ctx.restore();
        const cp = eob(seg(lt, 0.3, 0.75));
        if (cp > 0) {
          ctx.save(); ctx.translate(540, 950); ctx.scale(cp, cp);
          circle(0, 0, 150, 'rgba(46,139,87,0.14)');
          ctx.lineWidth = 20; ctx.strokeStyle = PA.check; ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke();
          line([[-58, 6], [-12, 54], [64, -48]], PA.check, 24);
          ctx.restore();
        }
        if (lt > 0.75 && lt < 1.5) K.burst(540, 950, 1.2, Math.exp(-(lt - 0.75) * 4));
        const et = P.etiqueta;
        if (et) K.pill(et, 540, 1280, 62, PA.check, '#F0F7EC', eob(seg(lt, pt, pt + 0.3)));
      } });
      cue(st, 'whoosh'); cue(st + 0.35, 'sparkle'); cue(st + 0.8, 'sparkle', { gain: 0.7 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
