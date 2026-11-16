// gen.js — Inside Out paramétrico: convierte plan.json (escrito por el guionista) en la lista de tomas.
// Cada "toma" del plan: { id, linea, escena, cam?, zoom?, params }. El corte cae justo antes de esa línea
// (cut(i) = L(i) - 0.08) y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea.
// Escenas: hablando · viaje · estomago · dibujo · mito · intestino · crono · lluvia · bloqueo · final · peligro
import { ctx, C, W, H, TAU, lerp, clamp, seg, eo, eio, eob, rnd, bigText } from './lib.js';
import { L, Le, Wd, T } from './timing.js';
import * as K from './kit.js';

const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']+/g, '');   // igual que timing.js: las anclas deben coincidir palabra a palabra

// ─── OBJETOS paramétricos (mismo look flat del kit: un color, un borde, un brillo) ───
const OBJ = {
  chicle: (x, y, s, r = 0, sx = 1, sy = 1) => K.gum(x, y, s, r, sx, sy),
  moneda(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.arc(0, 0, 44 * s, 0, TAU); ctx.fillStyle = '#E9C46A'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#C98A1C'; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 30 * s, 0, TAU); ctx.fillStyle = '#F6D98A'; ctx.fill(); ctx.fillStyle = '#C98A1C'; ctx.font = `900 ${44 * s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('€', 0, 2 * s); ctx.restore(); },
  iman(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.arc(0, 20 * s, 46 * s, Math.PI, TAU); ctx.lineTo(-46 * s, -46 * s); ctx.lineTo(-22 * s, -46 * s); ctx.lineTo(-22 * s, 18 * s); ctx.arc(0, 20 * s, 22 * s, TAU, Math.PI, true); ctx.lineTo(22 * s, -46 * s); ctx.lineTo(46 * s, -46 * s); ctx.lineTo(46 * s, 20 * s); ctx.arc(0, 20 * s, 46 * s, 0, Math.PI, false); ctx.closePath(); ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(); rr(-48 * s, -70 * s, 30 * s, 26 * s, 4); ctx.fillStyle = C.white; ctx.fill(); rr(18 * s, -70 * s, 30 * s, 26 * s, 4); ctx.fill(); ctx.restore(); },
  bateria(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); rr(-40 * s, -60 * s, 80 * s, 120 * s, 12); ctx.fillStyle = '#3A7BD5'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke(); rr(-16 * s, -76 * s, 32 * s, 18 * s, 4); ctx.fillStyle = '#C9A13B'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = C.yellow; ctx.font = `900 ${64 * s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', 0, 2 * s); ctx.restore(); },
  hueso(x, y, s, r = 0, xr = false) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); const c = xr ? C.cyan : '#F2E6CF'; line([[-70 * s, 0], [70 * s, 0]], c, 30 * s); for (const sd of [-1, 1]) { circle(sd * 70 * s, -22 * s, 24 * s, c); circle(sd * 70 * s, 22 * s, 24 * s, c); } ctx.restore(); },
  cerebro(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.ellipse(0, 0, 90 * s, 70 * s, 0, 0, TAU); ctx.fillStyle = C.pink; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.pinkDark; ctx.stroke(); ctx.strokeStyle = C.pinkDark; ctx.lineWidth = 8; ctx.lineCap = 'round'; for (const [px, py, w] of [[-40, -30, 40], [10, -35, 45], [-45, 15, 40], [15, 20, 50], [-20, 45, 30]]) { ctx.beginPath(); ctx.moveTo(px * s, py * s); ctx.quadraticCurveTo((px + w / 2) * s, (py - 20) * s, (px + w) * s, py * s); ctx.stroke(); } line([[6 * s, -66 * s], [26 * s, -110 * s]], C.pinkDark, 16 * s); ctx.restore(); },
  pastilla(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.arc(-26 * s, 0, 26 * s, Math.PI / 2, Math.PI * 1.5); ctx.lineTo(26 * s, -26 * s); ctx.arc(26 * s, 0, 26 * s, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#C9C2B5'; ctx.stroke(); ctx.save(); ctx.beginPath(); ctx.arc(-26 * s, 0, 26 * s, Math.PI / 2, Math.PI * 1.5); ctx.lineTo(0, -26 * s); ctx.lineTo(0, 26 * s); ctx.closePath(); ctx.fillStyle = C.pink; ctx.fill(); ctx.restore(); ctx.restore(); },
  gota(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.moveTo(0, -60 * s); ctx.bezierCurveTo(50 * s, 10 * s, 40 * s, 60 * s, 0, 60 * s); ctx.bezierCurveTo(-40 * s, 60 * s, -50 * s, 10 * s, 0, -60 * s); ctx.closePath(); ctx.fillStyle = C.cyan; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#2AA3C4'; ctx.stroke(); ell(-16 * s, 10 * s, 14 * s, 20 * s, C.white, -0.4); ctx.restore(); },
  bacteria(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.ellipse(0, 0, 70 * s, 44 * s, 0, 0, TAU); ctx.fillStyle = '#6DB36A'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#4E8A4C'; ctx.stroke(); circle(-22 * s, -8 * s, 9 * s, C.white); circle(-22 * s, -8 * s, 4 * s, C.ink); circle(18 * s, 10 * s, 9 * s, C.white); circle(18 * s, 10 * s, 4 * s, C.ink); ctx.strokeStyle = '#4E8A4C'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const [a, l] of [[0.6, 50], [-0.4, 46], [2.2, 40]]) { const px = Math.cos(a) * 70 * s, py = Math.sin(a) * 44 * s; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Math.cos(a) * l * s, py + Math.sin(a) * l * s, px + Math.cos(a + 0.8) * l * s, py + Math.sin(a + 0.5) * l * s); ctx.stroke(); } ctx.restore(); },
  nota(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); rr(-56 * s, -56 * s, 112 * s, 112 * s, 6); ctx.fillStyle = '#FFD43B'; ctx.fill(); ctx.strokeStyle = '#E0B42A'; ctx.lineWidth = 4; ctx.stroke(); line([[-34 * s, -18 * s], [34 * s, -18 * s]], '#B8860B', 6 * s); line([[-34 * s, 8 * s], [34 * s, 8 * s]], '#B8860B', 6 * s); line([[-34 * s, 34 * s], [10 * s, 34 * s]], '#B8860B', 6 * s); ctx.restore(); },
  pelo(x, y, s, r = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    for (const [a, l] of [[-0.7, 70], [-0.25, 95], [0.2, 80], [0.65, 60]]) { ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.quadraticCurveTo(a * 60 * s, 10 * s, a * 45 * s, (10 + l) * s); ctx.stroke(); }
    circle(0, -14 * s, 12 * s, '#2B2620'); ctx.restore(); },
  corazon: (x, y, s, r = 0, beat = 1) => K.heart(x, y, s, beat),
  reloj: (x, y, s, r = 0, ang = 0) => K.stopwatch(x, y, s, ang),
};
const obj = (nombre) => OBJ[nombre] || OBJ.chicle;

// ─── fábrica de tomas ───
export function buildShots(PLAN) {
  const S = [], CUES = [];
  const add = (o) => (S.push(o), o);
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.08);
  const R = (v, d) => (v == null ? d : v);                // param con default
  const dur = (sh) => fin(sh) - cut(sh.linea);            // duración de la toma (hasta el corte de la siguiente)
  const fin = (sh) => { const nx = PLAN.tomas[PLAN.tomas.indexOf(sh) + 1]; return nx ? cut(nx.linea) : T.dur; };

  // palabras del texto de la línea (sin signos): anclas por defecto
  const pal = (ln) => (PLAN.lineas[ln] ? PLAN.lineas[ln].texto : '').replace(/[¿?¡!.,;:]/g, '').split(/\s+/).filter(Boolean);
  const palN = (ln) => pal(ln).map(norm);

  const escenas = {
    // el héroe reacciona en su habitación; opcional: objeto en mano, texto grande, shock
    hablando(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const cara = R(p.cara, 'smile'), ojos = R(p.ojos, 'n'), brazo = R(p.brazo, 'down');
      const bo = R(p.objeto, null), bt = R(p.texto, null);
      const aT = bt ? Wd(R(p.ancla_texto, palN(ln)[0] || ''), ln) - st : null;
      const shock = R(p.choque, false) ? (p.ancla_choque ? Wd(p.ancla_choque, ln) - st : 0.4) : null;
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 820]), zoom: R(sh.zoom, 0.06), note: p.nota || 'héroe reacciona',
        draw(lt) {
          K.room();
          const arm = brazo === 'mouth' ? K.armPose(K.ARM.down, K.ARM.mouth, eio(seg(lt, 0, 0.3))) : K.ARM[brazo] || K.ARM.down;
          const shx = shock != null && lt > shock ? Math.sin(lt * 70) * 6 * Math.max(0, 1 - (lt - shock) * 2) : 0;
          K.man({ x: 540 + shx, y: 1180, s: R(p.escala, 1.6), arm,
            holding: bo && lt < 0.5 ? (x, y) => obj(bo)(x, y, 0.55, 0.3) : null,
            mouth: cara, chew: cara === 'chew' ? Math.abs(Math.sin(lt * 14)) : 0, eyes: ojos, brow: shock != null && lt > shock ? 1 : R(p.cejas, 0.2), smirk: cara === 'smirk' });
          if (bt != null && aT != null && lt > aT && lt < aT + 0.9) bigText(bt, 830, 560, 92, C.white, -0.18, eob(seg(lt, aT, aT + 0.15)));
          if (shock != null) K.shockLines(540, 625, 300, clamp((lt - shock) * 5) || 0);
        } });
      cue(st, 'whoosh'); if (bt) cue(st + aT, 'pop', { gain: 0.6 });
    },

    // rayos-X del cuerpo: el objeto baja de la boca al estómago; ancla_llegada = palabra en que llega
    viaje(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const lleg = p.ancla_llegada ? Wd(p.ancla_llegada, ln) - st + 0.15 : 0.7;
      const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 1050]), zoom: R(sh.zoom, 0.3), note: p.nota || 'rayos-X: el objeto baja al estómago',
        draw(lt, d, t) {
          K.xray(t);
          const [gx, gy] = K.foodAt(eio(seg(lt, 0.15, lleg)));
          const pulse = lt > lleg ? Math.max(0, Math.sin((lt - lleg) * 8)) * Math.exp(-(lt - lleg) * 1.5) : 0;
          K.man({ x: 540, y: 1120, s: R(p.escala, 1.5), xray: true, mouth: 'o', eyes: 'wide', brow: 1, inside: [gx, gy, lt * 2], pulse });
        } });
      cue(st, 'whoosh'); cue(st + 0.2, 'slide', { dur: Math.max(0.3, lleg - 0.2) }); cue(st + lleg, 'plop');
    },

    // dentro del estómago: el objeto flota y el ácido lo trabaja; opcional etiqueta
    estomago(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const work = p.ancla_acido ? Wd(p.ancla_acido, ln) - st : null;
      const et = R(p.etiqueta, null), aE = et ? Wd(p.ancla_etiqueta, ln) - st : null;
      const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 900]), zoom: R(sh.zoom, 0.06), note: p.nota || 'dentro del estómago',
        draw(lt, d, t) {
          K.insideStomach(t, R(p.acido, work != null ? 1 : 0.4));
          const bob = Math.sin(lt * 2.4) * 18;
          o(540, 820 + bob, R(p.escala, 3.4), Math.sin(lt * 1.7) * 0.12);
          if (work != null && lt > work) { ctx.save(); ctx.globalAlpha = clamp((lt - work) * 4);
            for (let i = 0; i < 10; i++) { const ang = i / 10 * Math.PI * 2 + lt, r1 = 190 + Math.sin(lt * 12 + i) * 12;
              ctx.strokeStyle = C.yellow; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath();
              ctx.moveTo(540 + Math.cos(ang) * r1, 820 + bob + Math.sin(ang) * r1 * 0.7); ctx.lineTo(540 + Math.cos(ang) * (r1 + 50), 820 + bob + Math.sin(ang) * (r1 + 50) * 0.7); ctx.stroke(); }
            ctx.restore(); }
          if (et) K.tag(et, 540, 500, 540, 700 + bob, 66, lt > aE ? eob(seg(lt, aE, aE + 0.3)) : 0);
        } });
      cue(st, 'whoosh'); cue(st, 'bubbles', { dur: Math.max(1, dur(sh)) }); if (work != null) cue(st + work, 'sizzle', { dur: 1.0 }); if (et) cue(st + aE, 'pop');
    },

    // primer plano del objeto sobre fondo de rayos-X, con etiqueta
    dibujo(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const et = R(p.etiqueta, null), aE = et ? Wd(p.ancla_etiqueta, ln) - st : null;
      const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 820]), zoom: R(sh.zoom, 0.1), note: p.nota || 'primer plano del objeto',
        draw(lt, d, t) {
          K.xray(t);
          const bob = Math.sin(lt * 2) * 10;
          o(540, 820 + bob, R(p.escala, 3.2), Math.sin(lt * 1.3) * 0.08);
          if (et) K.pill(et, 540, 430, 52, C.ink, C.white, aE != null && lt > aE ? eob(seg(lt, aE, aE + 0.3)) : eob(seg(lt, 0.1, 0.4)));
        } });
      cue(st, 'whoosh'); if (et) cue(st + (aE ?? 0.15), 'pop');
    },

    // órgano en primer plano: corazón/cerebro/estómago latiendo; ancla_levantar = palabra del golpe fuerte
    organo(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const ORG = { corazon: (x, y, s, b) => K.heart(x, y, s, b), cerebro: (x, y, s) => OBJ.cerebro(x, y, s, 0), estomago: (x, y, s, b) => K.stomach(x, y, s, b) };
      const org = ORG[p.organo] || ORG.corazon;
      const defE = { corazon: 1.3, cerebro: 2.6, estomago: 2.6 }[p.organo] || 1.3;
      const lev = p.ancla_levantar ? Wd(p.ancla_levantar, ln) - st : null;
      const et = R(p.etiqueta, null), aE = et ? Wd(p.ancla_etiqueta, ln) - st : null;
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 800]), zoom: R(sh.zoom, 0.08), note: p.nota || `órgano: ${R(p.organo, 'corazon')}`,
        draw(lt) {
          ctx.fillStyle = C.bg; ctx.fillRect(-300, -300, W + 600, H + 600);
          const k = lev != null && lt > lev ? 1 + Math.abs(Math.sin((lt - lev) * 7)) * 0.35 : 1;
          const beat = lev != null && lt > lev ? Math.abs(Math.sin((lt - lev) * 7)) : 0.45 + 0.35 * Math.abs(Math.sin(lt * 2.6));
          const bob = Math.sin(lt * 2.2) * 12;
          org(540, 800 + bob, R(p.escala, defE), k * beat);
          if (et) K.pill(et, 540, 430, 52, C.ink, C.white, aE != null && lt > aE ? eob(seg(lt, aE, aE + 0.3)) : eob(seg(lt, 0.1, 0.4)));
        } });
      cue(st, 'whoosh'); cue(st + 0.1, 'thud', { gain: 0.7 }); if (et) cue(st + (aE ?? 0.15), 'pop');
    },

    // mito derrotado: un número + palabra bajan y una X roja cae en la palabra ancla
    mito(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const slam = Wd(R(p.ancla_x, palN(ln)[1] || palN(ln)[0] || ''), ln) - st - 0.05;
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 800]), zoom: R(sh.zoom, 0.06), note: p.nota || 'calendario cae, X roja',
        draw(lt) {
          ctx.fillStyle = C.bg; ctx.fillRect(-300, -300, W + 600, H + 600);
          const shake = lt > slam ? Math.sin(lt * 90) * 18 * Math.max(0, 1 - (lt - slam) * 4) : 0;
          ctx.save(); ctx.translate(shake, 0);
          const drop = eob(seg(lt, 0, 0.45));
          K.calendar(540, lerp(-400, 780, drop), 1, R(p.numero, '7'), R(p.texto, 'AÑOS'), lerp(-0.25, -0.04, drop));
          if (lt > slam) { const pr = seg(lt, slam, slam + 0.2); K.redX(540, 780, lerp(1.9, 1, eo(pr)), clamp(pr * 3)); }
          ctx.restore();
        } });
      cue(st, 'whoosh'); cue(st + 0.4, 'thud'); cue(st + slam + 0.1, 'slam');
    },

    // el objeto recorre el intestino serpenteante (rayos-X)
    intestino(sh) {
      const p = sh.params || {}, st = cut(sh.linea);
      const gut = K.makeGut(); const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 760]), zoom: R(sh.zoom, 0.06), note: p.nota || 'el objeto recorre el intestino',
        draw(lt, d, t) {
          K.xray(t); gut.draw();
          const u = eio(seg(lt, 0.1, d - 0.1)), [x, y, a] = gut.at(u);
          ctx.save(); ctx.globalAlpha = 0.35; for (let i = 1; i < 6; i++) { const q = gut.at(Math.max(0, u - i * 0.012)); ctx.beginPath(); ctx.arc(q[0], q[1], 10 - i, 0, 7); ctx.fillStyle = C.cyan; ctx.fill(); } ctx.restore();
          o(x, y, R(p.escala, 1.25), a);
        } });
      cue(st, 'whoosh'); cue(st + 0.1, 'slide', { dur: Math.max(0.5, fin(sh) - st - 0.2), gain: 0.6 });
    },

    // cronómetro + contador de DÍA N + el objeto sale disparado en la palabra ancla_salida
    crono(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const out = Wd(R(p.ancla_salida, palN(ln)[0] || ''), ln) - st - 0.1, shrink = Math.max(0.6, out - 0.45);
      const dias = R(p.dias, ['DÍA 1', 'DÍA 2', 'DÍA 3']); const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 760]), zoom: R(sh.zoom, 0.06), note: p.nota || 'cronómetro y días pasando',
        draw(lt) {
          ctx.fillStyle = C.bg; ctx.fillRect(-300, -300, W + 600, H + 600);
          const k = eio(seg(lt, shrink, shrink + 0.35));
          K.stopwatch(lerp(540, 250, k), lerp(720, 560, k), lerp(1, 0.55, k), lt * 14);
          const day = Math.min(dias.length, 1 + Math.floor(lt / (shrink / dias.length)));
          K.pill(dias[day - 1], lerp(540, 250, k), lerp(1130, 820, k), lerp(70, 48, k), C.ink, C.white, lt < 0.25 ? eob(seg(lt, 0, 0.25)) : 1);
          if (lt > out) { const pr = seg(lt, out, out + 0.75), gx = lerp(380, 1300, eio(pr)); o(gx, 1010, R(p.escala, 2.2), 0, 1.25, 0.85); K.speedLines(gx - 60, 1010, 1 - pr * 0.6); }
        } });
      cue(st, 'whoosh'); for (let i = 1; i < dias.length; i++) cue(st + i * shrink / dias.length, 'tock'); cue(st + out, 'zip');
    },

    // muchos objetos caen al estómago en rayos-X
    lluvia(sh) {
      const p = sh.params || {}, st = cut(sh.linea);
      const o = obj(R(p.objeto, 'chicle')), n = R(p.n, 14), d0 = fin(sh) - st;
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 820]), zoom: R(sh.zoom, 0.06), note: p.nota || 'lluvia de objetos al estómago',
        draw(lt, d, t) {
          K.xray(t);
          const top = K.stomachTop(560, 780, 3.0);
          ctx.strokeStyle = C.pink; ctx.lineWidth = 70; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(top[0] + 10, -100); ctx.lineTo(top[0], top[1] + 30); ctx.stroke();
          K.stomach(560, 780, 3.0);
          const step = Math.min(0.08, (d0 - 0.6) / n);
          for (let i = 0; i < n; i++) {
            const pr = seg(lt, i * step, i * step + 0.45); if (pr <= 0) continue;
            const tx = 470 + (rnd(i) - 0.5) * 260 + (i > n * 0.5 ? 40 : 0), ty = 990 - Math.floor(i / 5) * 55 - rnd(i + 3) * 20;
            o(lerp(470, tx, eo(pr)), lerp(-80, ty, eob(pr)), R(p.escala, 1.1), rnd(i + 7) * 3 + pr);
          }
        } });
      const step = Math.min(0.08, (d0 - 0.6) / n);
      cue(st, 'whoosh'); for (let i = 0; i < n; i += 2) cue(st + i * step + 0.4, 'plop', { gain: 0.5 });
    },

    // peligro: el objeto forma un tapón en el intestino; anillo rojo + warning en la palabra ancla
    bloqueo(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const warn = Wd(R(p.ancla_aviso, palN(ln)[0] || ''), ln) - st - 0.1;
      const o = obj(R(p.objeto, 'chicle')), et = R(p.etiqueta, null);
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 820]), zoom: R(sh.zoom, 0.06), note: p.nota || 'tapón: peligro',
        draw(lt, d, t) {
          K.xray(t); K.gutTube(820, t);
          for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(120 + i * 24 + Math.sin(t * 3 + i) * 4, 760 + rnd(i) * 120, 16 + rnd(i + 2) * 10, 0, 7); ctx.fillStyle = C.yellow; ctx.fill(); }
          const pr = Math.sin(lt * 7) * 0.5 + 0.5;
          ctx.beginPath(); ctx.arc(560, 820, 190 + pr * 30, 0, 7); ctx.strokeStyle = C.red; ctx.globalAlpha = 0.35 + 0.5 * pr; ctx.lineWidth = 18; ctx.stroke(); ctx.globalAlpha = 1;
          for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2; o(560 + Math.cos(ang) * 60 + Math.sin(t * 20 + i) * 3, 820 + Math.sin(ang) * 50, 1.25, ang); }
          o(560, 820, 1.3, 0.4);
          if (et) K.tag(et, 540, 450, 540, 560, 60, eob(seg(lt, 0.1, 0.4)));
          K.warning(560, et ? 620 : 450, lt > warn ? eob(seg(lt, warn, warn + 0.3)) * (1 + pr * 0.06) : 0);
        } });
      cue(st, 'whoosh'); cue(st + warn, 'alarm', { dur: Math.max(0.8, fin(sh) - st - warn) });
    },

    // cierre: el héroe mira a cámara, dedo en alto; opcional pill final
    final(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const et = R(p.etiqueta, null), aE = et ? Wd(p.ancla_etiqueta, ln) - st : null;
      const grin = p.ancla_sonrisa ? Wd(p.ancla_sonrisa, ln) - st : 0.4;
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 760]), zoom: R(sh.zoom, 0.06), note: p.nota || 'cierre: dedo en alto',
        draw(lt) {
          K.room();
          const pr = eio(seg(lt, 0, 0.5));
          K.man({ x: 540, y: 1290, s: R(p.escala, 2.0), arm: K.armPose(K.ARM.down, K.ARM.point, pr), finger: lt > 0.35 ? Math.sin(lt * 11) * 0.35 : 0, mouth: lt > grin ? 'grin' : 'smirk', brow: 0.3, smirk: true });
          if (et) K.pill(et, 540, 520, 56, C.ink, C.white, aE != null && lt > aE ? eob(seg(lt, aE, aE + 0.3)) : eob(seg(lt, 0.3, 0.55)));
        } });
      cue(st, 'whoosh'); cue(st + (aE ?? grin), 'pop', { gain: 0.6 });
    },

    // peligro puro: fondo rayos-X, warning grande + X roja sobre el objeto
    peligro(sh) {
      const p = sh.params || {}, st = cut(sh.linea), ln = sh.linea;
      const warn = Wd(R(p.ancla_aviso, palN(ln)[0] || ''), ln) - st;
      const o = obj(R(p.objeto, 'chicle'));
      add({ id: sh.id, at: st, cam: R(sh.cam, [540, 820]), zoom: R(sh.zoom, 0.1), note: p.nota || 'peligro: X roja + warning',
        draw(lt, d, t) {
          K.xray(t);
          o(540, 840, R(p.escala, 3), Math.sin(lt * 2) * 0.1);
          K.warning(540, 430, eob(seg(lt, 0.15, 0.45)) * (1 + Math.sin(lt * 6) * 0.05));
          const pr = clamp((lt - warn) / 0.25);
          if (pr > 0) K.redX(540, 840, lerp(2.4, 1.1, eo(pr)), 1);
        } });
      cue(st, 'whoosh'); cue(st + warn, 'slam'); cue(st + warn + 0.05, 'alarm', { dur: Math.max(0.6, fin(sh) - st - warn), gain: 0.6 });
    },
  };

  for (const sh of PLAN.tomas) {
    const fn = escenas[sh.escena];
    if (!fn) throw new Error(`escena desconocida '${sh.escena}' (toma ${sh.id})`);
    fn(sh);
  }
  return { shots: S, cues: CUES };
}

// helpers de dibujo a nivel módulo (mismas firmas que lib.js usa internamente)
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function line(pts, col, wd) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.stroke(); }
function circle(x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
function ell(x, y, rx, ry, col, rot = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
