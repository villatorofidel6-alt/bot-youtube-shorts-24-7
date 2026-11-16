// gen.js — Night File paramétrico: convierte plan.json en las tomas 3D del expediente.
// Cada "toma": { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde).
// Escenas: caso · hablando · documento · foto · hilo · dato · girar · apagon · final
// Anclas soportadas: ancla_etiqueta · ancla_texto · ancla_x · ancla_apagon
import * as THREE from 'three';
import { W, H, ctx, clamp, lerp, seg, eo, eio, eob } from './lib.js';
import { L, Wd, T } from './timing.js';
import { camera } from './engine.js';
import { label, pill, blackout } from './look2d.js';
import * as SETS from './sets.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);
function screen(p, cam) { const v = p.clone().project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }

// ─── fábrica de tomas ───
export function buildShots(PLAN, E) {
  const S = [], CUES = [];
  const add = (o) => (S.push(o), o);
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.08);
  const R = (v, d) => (v == null ? d : v);
  const fin = (sh) => { const nx = PLAN.tomas[PLAN.tomas.indexOf(sh) + 1]; return nx ? cut(nx.linea) : T.dur; };
  const pop = (sh, st, key, def) => {
    const a = sh.params?.[`ancla_${key}`];
    return a ? Math.max(0, Wd(a, sh.linea) - st) : def;
  };

  const cam = camera(30);
  const KLOOK = { aperture: 0.004, maxblur: 0.012, bloom: 0.3, bloomThreshold: 0.5, vignette: 0.55, warm: 0.05 };

  // ── el mundo (se construye UNA vez) ──
  const OF = SETS.office(E), DP = SETS.deskPaper(E);
  let turno = 0;
  const CARPETA = V3(0.15, 0.84, -0.75);
  const FOTO = V3(-0.75, 2.2, -2.24);
  const officeRender = (focus, extra = {}) => E.render(OF.scene, cam, { ...KLOOK, focus, ...extra });
  const paperRender = (focus, extra = {}) => E.render(DP.scene, cam, { ...KLOOK, focus, ...extra });

  for (const sh of PLAN.tomas) {
    const st = sh.linea === 0 ? 0 : Math.max(cut(sh.linea), S[S.length - 1]?.at + 0.01 || 0);
    const d = fin(sh) - st;
    const P = sh.params || {};
    const esc = sh.escena;

    // 1 · caso — la carpeta se abre bajo la lámpara + etiqueta del expediente
    if (esc === 'caso') {
      const pt = pop(sh, st, 'etiqueta', 0.6);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'carpeta abriéndose', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = lerp(0, 1.65, eio(seg(lt, 0.15, 1.0)));
        OF.lamp.intensity = 90 + Math.sin(lt * 9) * 4; OF.glow.visible = true;
        cam.position.copy(lerpV(V3(0.1, 1.75, 0.7), V3(-0.05, 1.45, 0.28), eio(lt / d)));
        cam.lookAt(CARPETA);
        officeRender(cam.position.distanceTo(CARPETA)); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 380, eob(seg(lt, pt, pt + 0.3)), '#FFB65C');
      } });
      cue(st, 'whoosh'); cue(st + 0.95, 'thud', { gain: 0.5 }); cue(st + pt, 'pop');
    }

    // 2 · hablando — plano medio del escritorio con la carpeta abierta; pill opcional
    else if (esc === 'hablando') {
      const pt = pop(sh, st, 'texto', 0.3);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'escritorio a media altura', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = 1.65; OF.lamp.intensity = 90 + Math.sin(lt * 7) * 3; OF.glow.visible = true;
        cam.position.copy(lerpV(V3(0.45, 1.35, 0.35), V3(0.2, 1.15, 0.05), eio(lt / d)));
        cam.lookAt(0.1, 0.85, -0.75);
        officeRender(0.55); blit();
        const tx = P.texto;
        if (tx) pill(tx, 540, 1450, eob(seg(lt, pt, pt + 0.25)), '#FFB65C');
      } });
      cue(st, 'whoosh'); if (P.texto) cue(st + pt, 'pop', { gain: 0.5 });
    }

    // 3 · documento — macro de la hoja: líneas de máquina de escribir apareciendo
    else if (esc === 'documento') {
      const nLin = R(P.lineas, 5), paso = Math.max(0.28, (d - 0.6) / nLin);
      const pt = pop(sh, st, 'etiqueta', 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'máquina de escribir', draw(lt, dt, t, blit) {
        DP.paperA.visible = true; DP.paperB.visible = false; DP.paperA.position.set(0, 0.012, 0);
        cam.position.set(0.16 * Math.sin(lt * 0.6), 1.35 - 0.12 * eio(lt / d), 0.55);
        cam.lookAt(0, 0, 0);
        paperRender(0.85, { warm: 0.07 }); blit();
        const hechos = Math.min(nLin, Math.floor(lt / paso));
        for (let r = 0; r < hechos; r++) {
          const wd = 300 + ((r * 137) % 260);
          ctx.globalAlpha = 0.85; ctx.fillStyle = '#2E2C28';
          ctx.fillRect(540 - wd / 2, 620 + r * 74, wd, 16); ctx.globalAlpha = 1;
        }
        if (Math.sin(lt * 18) > 0) { ctx.fillStyle = '#2E2C28'; ctx.fillRect(540 - 130, 620 + hechos * 74, 90, 16); }
        const et = P.etiqueta;
        if (et) pill(et, 540, 1330, eob(seg(lt, pt, pt + 0.25)), '#FFB65C');
      } });
      cue(st, 'whoosh');
      for (let k = 0; k < nLin; k++) cue(st + 0.25 + k * paso, 'tock', { gain: 0.5 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 4 · foto — zoom a una polaroid del tablero, flash al ancla
    else if (esc === 'foto') {
      const fl = pop(sh, st, 'etiqueta', d * 0.45);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'zoom a polaroid', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = 1.65; OF.lamp.intensity = 90; OF.glow.visible = true;
        cam.position.copy(lerpV(V3(0.5, 1.7, 0.6), V3(FOTO.x + 0.05, FOTO.y, -1.35), eio(lt / d)));
        cam.lookAt(FOTO);
        officeRender(0.5); blit();
        if (lt > fl - 0.05 && lt < fl + 0.35) {
          ctx.fillStyle = `rgba(255,255,255,${0.9 * Math.max(0, 1 - (lt - fl + 0.05) * 4)})`;
          ctx.fillRect(0, 0, W, H);
        }
        const et = P.etiqueta;
        if (et) pill(et, 540, 330, eob(seg(lt, fl, fl + 0.3)), '#FFB65C');
      } });
      cue(st, 'whoosh'); cue(st + fl, 'pop', { gain: 0.7 });
    }

    // 5 · hilo — la cámara recorre el hilo rojo entre dos fotos del tablero
    else if (esc === 'hilo') {
      const A = V3(-0.75, 2.2, -2.2), B = V3(0.35, 2.35, -2.2);
      const pt = pop(sh, st, 'etiqueta', 0.3);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'recorriendo el hilo rojo', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = 1.65; OF.lamp.intensity = 90; OF.glow.visible = true;
        const u = eio(seg(lt, 0.2, d - 0.2));
        const M = A.clone().lerp(B, u);
        cam.position.copy(M.clone().add(V3(0.15, 0.12, 0.9 - 0.35 * u)));
        cam.lookAt(M);
        officeRender(0.6); blit();
        const [sx, sy] = screen(M, cam);
        ctx.strokeStyle = '#E0303C'; ctx.lineWidth = 7; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 40, sy + 30); ctx.stroke(); ctx.globalAlpha = 1;
        const et = P.etiqueta;
        if (et) label(et, 540, 350, sx, sy, eob(seg(lt, pt, pt + 0.25)));
      } });
      cue(st, 'slide', { dur: Math.max(0.6, d - 0.3), gain: 0.5 }); if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 6 · dato — el sello golpea el número sobre el escritorio
    else if (esc === 'dato') {
      const sl = pop(sh, st, 'x', d * 0.45);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'sello: número', draw(lt, dt, t, blit) {
        const shake = lt > sl ? Math.sin(lt * 80) * 8 * Math.max(0, 1 - (lt - sl) * 5) : 0;
        ctx.save(); ctx.translate(shake, shake * 0.6);
        OF.lid.rotation.z = 1.65; OF.lamp.intensity = 90; OF.glow.visible = true;
        OF.stamp.position.y = 0.81 + (lt > sl ? 0.06 * Math.exp(-(lt - sl) * 7) : 0.06 + Math.sin(lt * 3) * 0.01);
        OF.stamp.rotation.x = lt > sl ? -0.45 * Math.exp(-Math.max(0, lt - sl) * 8) : 0;
        cam.position.copy(lerpV(V3(0.4, 1.5, 0.5), V3(0.25, 1.2, 0.2), eio(lt / d)));
        cam.lookAt(0.15, 0.8, -0.75);
        officeRender(0.6); blit();
        const num = `${P.numero ?? ''}${P.numero && P.texto ? ' ' : ''}${P.texto ?? ''}`.trim();
        pill(num, 540, 1000, eob(seg(lt, sl, sl + 0.28)), '#FF6B5C', 'rgba(10,12,16,0.85)', 88);
        ctx.restore();
      } });
      cue(st, 'whoosh'); cue(st + sl, 'slam', { gain: 0.8 }); cue(st + sl + 0.1, 'thud', { gain: 0.5 });
    }

    // 7 · girar — pasa de página: una hoja sale hacia abajo y otra entra desde arriba
    else if (esc === 'girar') {
      const va = turno % 2 === 0, entra = va ? DP.paperB : DP.paperA, sale = va ? DP.paperA : DP.paperB;
      turno++;
      const t1 = Math.min(d - 0.25, 1.0);
      const pt = Math.max(t1 + 0.1, pop(sh, st, 'etiqueta', t1 + 0.1));
      add({ id: sh.id, at: st, linea: sh.linea, note: 'pasa de página', draw(lt, dt, t, blit) {
        const u = eio(seg(lt, 0.12, t1));
        entra.visible = true; entra.position.set(0, 0.012, lerp(-2.0, 0, u));
        sale.position.set(0, 0.012, lerp(0, 1.5, u));
        cam.position.set(0.1 * Math.sin(lt * 0.8), 1.32, 0.5); cam.lookAt(0, 0, 0);
        paperRender(0.8); blit();
        if (u >= 1) sale.visible = false;
        const et = P.etiqueta;
        if (et) pill(et, 540, 1350, eob(seg(lt, pt, pt + 0.25)), '#FFB65C');
      } });
      cue(st, 'whoosh'); if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 8 · apagon — la lámpara parpadea y muere; todo a negro
    else if (esc === 'apagon') {
      const off = pop(sh, st, 'apagon', d * 0.55);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'parpadeo y apagón', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = 1.65;
        const f = lt < off ? (Math.sin(lt * 30) > -0.6 ? 1 : 0.25) : 0;
        OF.lamp.intensity = 90 * f; OF.glow.visible = f > 0;
        cam.position.copy(lerpV(V3(0.2, 1.5, 0.55), V3(0.05, 1.3, 0.25), eio(lt / d)));
        cam.lookAt(CARPETA);
        officeRender(0.6); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 430, eob(seg(lt, 0.2, 0.45)), '#FF8A6B');
        blackout(seg(lt, off, off + 0.8));
      } });
      cue(st, 'whoosh'); cue(st + off, 'thud', { gain: 0.8 });
    }

    // 9 · final — la carpeta se cierra y cae el sello rojo de cierre
    else if (esc === 'final') {
      const pt = pop(sh, st, 'etiqueta', 0.8);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'cierre del expediente', draw(lt, dt, t, blit) {
        OF.lid.rotation.z = lerp(1.65, 0, eio(seg(lt, 0.1, 0.7)));
        OF.lamp.intensity = 90; OF.glow.visible = true;
        cam.position.copy(lerpV(V3(0.3, 1.45, 0.5), V3(0.12, 1.15, 0.15), eio(lt / d)));
        cam.lookAt(CARPETA);
        officeRender(0.5); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 1250, eob(seg(lt, pt, pt + 0.3)), '#7CF29A');
        const su = eob(seg(lt, pt + 0.2, pt + 0.5));
        if (su > 0) { ctx.save(); ctx.translate(540, 800); ctx.rotate(-0.18); ctx.scale(su, su);
          ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2);
          ctx.lineWidth = 16; ctx.strokeStyle = '#C0392B'; ctx.stroke();
          ctx.font = '900 56px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#C0392B'; ctx.fillText(R(P.sello, 'CASO CERRADO'), 0, 0); ctx.restore(); }
      } });
      cue(st, 'whoosh'); cue(st + 0.75, 'thud', { gain: 0.6 }); cue(st + 1.4, 'slam', { gain: 0.7 });
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
