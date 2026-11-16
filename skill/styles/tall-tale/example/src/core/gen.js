// gen.js — Tall Tale paramétrico: convierte plan.json en las tomas 3D de la leyenda.
// Cada "toma": { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde).
// Escenas: mundo · heroe · camina · bestia · choque · giro · tormenta · final
// Anclas: ancla_etiqueta · ancla_texto · ancla_x (momento del impacto)
import * as THREE from 'three';
import { W, H, ctx, lerp, seg, eio, eob, clamp } from './lib.js';
import { L, Wd, T } from './timing.js';
import { camera } from './engine.js';
import { Human } from './human.js';
import { label, pill } from './look2d.js';
import * as SETS from './sets.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);

export function buildShots(PLAN, E) {
  const S = [], CUES = [];
  const add = (o) => (S.push(o), o);
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.08);
  const R = (v, d) => (v == null ? d : v);
  const fin = (sh) => { const nx = PLAN.tomas[PLAN.tomas.indexOf(sh) + 1]; return nx ? cut(nx.linea) : T.dur; };
  const pop = (sh, st, key, def) => { const a = sh.params?.[`ancla_${key}`]; return a ? Math.max(0, Wd(a, sh.linea) - st) : def; };
  const proj = (v) => { const q = v.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };

  const cam = camera(30);
  const LOOK = { aperture: 0.004, maxblur: 0.012, bloom: 0.3, bloomThreshold: 0.72, vignette: 0.42, warm: 0.05 };

  // ── el mundo y sus actores (se construyen UNA vez) ──
  const M = SETS.terrain(E);
  const hero = new Human({ shirt: '#C9562E', pants: '#3B3530' });
  M.scene.add(hero.group);
  const BEA = M.beast, BHEAD = M.bHead, BJAW = M.bJaw, SUN = M.sun, HEMI = M.hemi, FOG = M.fog;
  const clearHero = () => { hero.pose({}); hero.hips.position.y = 0.93; };
  // estado limpio del mundo por frame: las tomas que animan sol/niebla lo pisan después
  const resetWorld = () => { SUN.intensity = 3.0; SUN.color.set('#FFE7C4'); HEMI.intensity = 0.55; FOG.color.set('#BFD9E4'); FOG.near = 20; FOG.far = 46; };
  const facePath = (u) => { const a = M.pathAt(Math.max(0, u - 0.02)), b = M.pathAt(Math.min(1, u + 0.02)); hero.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); };
  const headAt = (u, y = 1.55) => M.pathAt(u).clone().add(V3(0, y, 0));
  const HU0 = 0.18, HU1 = 0.6;                                   // posiciones del héroe por escena
  const breath = (lt) => ({ head: [2 + 2 * Math.sin(lt * 1.6), -3 + 2 * Math.sin(lt * 0.9), 0], spine: [1 + 1.5 * Math.sin(lt * 1.6), 0, 0] });
  const beastStands = (lt, bobA = 0.08) => { BEA.visible = true; BEA.scale.setScalar(1); BEA.rotation.x = 0; BEA.position.y = M.groundY(BEA.position.x, BEA.position.z) + Math.abs(Math.sin(lt * 3)) * bobA; };

  const render = (focus, extra = {}) => E.render(M.scene, cam, { ...LOOK, focus, ...extra });

  for (const sh of PLAN.tomas) {
    const st = sh.linea === 0 ? 0 : Math.max(cut(sh.linea), S[S.length - 1]?.at + 0.01 || 0);
    const d = fin(sh) - st;
    const P = sh.params || {};
    const esc = sh.escena;

    // 1 · mundo — plano aéreo del valle: el sendero y el horizonte
    if (esc === 'mundo') {
      const pt = pop(sh, st, 'etiqueta', 0.5);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'plano aéreo del valle', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t);
        cam.position.copy(lerpV(V3(-14, 10.5, 17), V3(-6, 7.5, 11), eio(lt / d)));
        cam.lookAt(-2, 0.5, 2);
        render(18); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 400, eob(seg(lt, pt, pt + 0.3)), '#FFD43B', 'rgba(24,26,20,0.8)', 66);
      } });
      cue(st, 'whoosh'); cue(st + 0.2, 'slide', { dur: Math.max(0.6, d - 0.3), gain: 0.5 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 2 · heroe — plano medio del héroe parado en el sendero
    else if (esc === 'heroe') {
      const hp = headAt(HU0);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'héroe a cámara', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero(); beastStands(lt, 0.05);
        hero.pose(breath(lt));
        hero.group.position.copy(M.pathAt(HU0)); facePath(HU0);
        hero.group.rotation.y += Math.PI;                      // de frente a cámara
        cam.position.copy(lerpV(hp.clone().add(V3(1.9, 1.5, 2.2)), hp.clone().add(V3(1.0, 1.4, 1.1)), eio(lt / d)));
        cam.lookAt(hp);
        render(cam.position.distanceTo(hp)); blit();
        const tx = P.texto, pt = pop(sh, st, 'texto', 0.3);
        if (tx) pill(tx, 540, 1420, eob(seg(lt, pt, pt + 0.25)), '#FFE9B8', 'rgba(24,26,20,0.8)', 60);
      } });
      cue(st, 'whoosh'); if (P.texto) cue(st + pop(sh, st, 'texto', 0.3), 'pop', { gain: 0.5 });
    }

    // 3 · camina — el héroe recorre el sendero, cámara que lo acompaña
    else if (esc === 'camina') {
      const u0 = R(P.desde, 0.22), u1 = u0 + R(P.avance, 0.26);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'caminando el sendero', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero(); beastStands(lt, 0.05);
        const u = lerp(u0, u1, eio(seg(lt, 0.1, d - 0.15)));
        hero.walk(lt * 6.4, 1);
        hero.group.position.copy(M.pathAt(u)); facePath(u + 0.03);
        const behind = M.pathAt(Math.max(0, u - 0.05));
        cam.position.copy(lerpV(behind.clone().add(V3(2.6, 2.3, 2.6)), behind.clone().add(V3(1.7, 1.8, 1.9)), eio(lt / d)));
        const hp = headAt(u);
        cam.lookAt(hp);
        render(cam.position.distanceTo(hp)); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.35);
        if (et) { const [lx, ly] = proj(hp); label(et, 250, 500, lx, ly - 60, eob(seg(lt, pt, pt + 0.25))); }
      } });
      cue(st, 'whoosh'); cue(st + 0.1, 'slide', { dur: Math.max(0.6, d - 0.2), gain: 0.55 });
      if (P.etiqueta) cue(st + pop(sh, st, 'etiqueta', 0.35), 'pop');
    }

    // 4 · bestia — la bestia se revela junto al sendero (plano bajo, ojo al rojo)
    else if (esc === 'bestia') {
      const rv = pop(sh, st, 'etiqueta', 0.5);
      const bhp = BEA.position.clone().add(V3(0, 1.6, 0));
      add({ id: sh.id, at: st, linea: sh.linea, note: 'la bestia se revela', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero();
        hero.pose({ ...breath(lt), spine: [4, 0, 0], head: [0, -14, 0] });
        hero.group.position.copy(M.pathAt(HU1)); facePath(0.75);
        const ap = eob(seg(lt, rv, rv + 0.45));
        BEA.visible = true; BEA.scale.setScalar(Math.max(0.001, ap)); BEA.rotation.x = 0;
        const roar = clamp(seg(lt, rv + 0.2, rv + 0.8));
        BHEAD.rotation.x = -roar * 0.28;
        BJAW.rotation.x = roar * 0.55;
        BEA.position.y = M.groundY(BEA.position.x, BEA.position.z) + Math.abs(Math.sin(lt * 3)) * 0.12 * roar;
        cam.position.copy(lerpV(M.pathAt(HU1).clone().add(V3(-0.4, 0.9, 2.4)), M.pathAt(HU1).clone().add(V3(-0.2, 1.1, 1.6)), eio(lt / d)));
        cam.lookAt(bhp);
        render(cam.position.distanceTo(bhp), { bloom: 0.5 }); blit();
        const et = P.etiqueta;
        if (et) label(et, 300, 380, bhp.x, 420, eob(seg(lt, rv + 0.1, rv + 0.35)));
      } });
      cue(st, 'whoosh'); cue(st + rv, 'slam', { gain: 0.8 }); cue(st + rv + 0.05, 'alarm', { dur: Math.max(0.8, d - rv) });
    }

    // 5 · choque — el héroe carga y el impacto manda la bestia atrás
    else if (esc === 'choque') {
      const imp = pop(sh, st, 'x', d * 0.45);
      const u0 = 0.62, u1 = 0.76;
      add({ id: sh.id, at: st, linea: sh.linea, note: 'carga e impacto', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero();
        const run = clamp(seg(lt, 0.1, imp));
        const u = lerp(u0, u1, eio(run));
        hero.walk(lt * 10.5, 1);
        hero.group.position.copy(M.pathAt(u)); facePath(u + 0.02);
        beastStands(lt, 0.1);
        const kb = lt > imp ? Math.exp(-(lt - imp) * 6) : 0;
        BEA.rotation.x = -kb * 0.38; BEA.position.y += kb * 0.3;
        const sk = lt > imp ? Math.sin((lt - imp) * 42) * 14 * Math.exp(-(lt - imp) * 7) : 0;
        cam.position.copy(M.pathAt(u + 0.16).clone().add(V3(1.5, 1.35, 2.1)).add(V3(sk, sk * 0.5, 0)));
        const focus = BEA.position.clone().add(V3(0, 1.2, 0));
        cam.lookAt(focus);
        render(cam.position.distanceTo(focus), { bloom: 0.55 }); blit();
        if (lt > imp - 0.03 && lt < imp + 0.4) { ctx.fillStyle = `rgba(255,255,240,${0.75 * Math.max(0, 1 - (lt - imp + 0.03) * 3.4)})`; ctx.fillRect(0, 0, W, H); }
        const et = P.etiqueta;
        if (et) pill(et, 540, 380, eob(seg(lt, imp, imp + 0.3)), '#FF6B5C', 'rgba(20,16,12,0.85)', 72);
      } });
      cue(st, 'whoosh'); cue(st + imp, 'slam', { gain: 0.9 }); cue(st + imp + 0.08, 'thud', { gain: 0.6 });
    }

    // 6 · giro — órbita rápida alrededor del duelo (el giro de la historia)
    else if (esc === 'giro') {
      const C0 = BEA.position.clone().lerp(M.pathAt(0.74), 0.5).add(V3(0, 1.3, 0));
      const pt = pop(sh, st, 'etiqueta', 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'órbita del duelo', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero();
        hero.pose({ hipL: [6, 0, 8], hipR: [-6, 0, 8], shL: [12, 0, 22], shR: [12, 0, 22], elL: 28, elR: 28, head: [-4, 8, 0] });
        hero.group.position.copy(M.pathAt(0.74)); facePath(0.85);
        beastStands(lt, 0.1);
        BJAW.rotation.x = 0.15 + 0.2 * Math.sin(lt * 5);
        const a = 0.9 + eio(seg(lt, 0.15, d - 0.2)) * Math.PI * 1.9;
        cam.position.set(C0.x + Math.cos(a) * 3.4, C0.y + 0.5, C0.z + Math.sin(a) * 3.4);
        cam.lookAt(C0);
        render(3.4, { bloom: 0.45 }); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 1350, eob(seg(lt, pt, pt + 0.25)), '#FFE9B8', 'rgba(24,26,20,0.8)', 64);
      } });
      cue(st, 'whoosh'); for (let z = 0.3; z < d - 0.3; z += 0.75) cue(st + z, 'zip', { gain: 0.45 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 7 · tormenta — el sol muere, llueve, el héroe resiste
    else if (esc === 'tormenta') {
      const pt = pop(sh, st, 'etiqueta', 0.4);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'la tormenta cae', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero(); beastStands(lt, 0.08);
        const k = eio(seg(lt, 0.2, d - 0.4));
        SUN.intensity = lerp(3.0, 0.55, k); HEMI.intensity = lerp(0.55, 0.3, k);
        FOG.color.set('#BFD9E4').lerp(new THREE.Color('#4E5A64'), k); FOG.near = lerp(20, 9, k); FOG.far = lerp(46, 22, k);
        hero.pose({ spine: [10 * k, 0, 0], head: [10 * k, -6, 0], shL: [10, 0, 14], shR: [10, 0, 14], hipL: [4, 0, 6], hipR: [-4, 0, 6] });
        hero.group.position.copy(M.pathAt(0.66)); facePath(0.8);
        cam.position.copy(lerpV(M.pathAt(0.66).clone().add(V3(2.2, 2.0, 2.8)), M.pathAt(0.66).clone().add(V3(1.3, 1.5, 1.9)), eio(lt / d)));
        const hp = headAt(0.66);
        cam.lookAt(hp);
        render(cam.position.distanceTo(hp), { warm: -0.06 * k, bloom: 0.4 }); blit();
        ctx.strokeStyle = 'rgba(205,225,240,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
          const x = ((i * 971) % 1080) * (0.94 + (i % 3) * 0.02);
          const y = ((lt * 1150 + i * 173) % (H + 220)) - 110;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 16, y + 70); ctx.stroke();
        }
        const et = P.etiqueta;
        if (et) pill(et, 540, 420, eob(seg(lt, pt, pt + 0.25)), '#FF8A6B', 'rgba(10,14,20,0.85)', 68);
      } });
      cue(st, 'whoosh'); cue(st + 0.2, 'alarm', { dur: Math.max(0.8, d - 0.3), gain: 0.55 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    // 8 · final — vuelve el sol; el héroe vence y el valle respira
    else if (esc === 'final') {
      const pt = pop(sh, st, 'etiqueta', 0.7);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'amanecer del vencedor', draw(lt, dt, t, blit) {
        resetWorld(); M.update(t); clearHero();
        const dawn = eio(seg(lt, 0.3, d - 0.3));
        SUN.intensity = lerp(0.8, 3.5, dawn); HEMI.intensity = lerp(0.3, 0.6, dawn);
        FOG.color.set('#4E5A64').lerp(new THREE.Color('#D8E8F0'), dawn);
        const jump = Math.abs(Math.sin(lt * 2.2)) * 0.22;
        hero.pose({ shL: [0, 0, 130], shR: [0, 0, 130], elL: 8, elR: 8, head: [-6, 0, 0], spine: [-4, 0, 0] });
        hero.hips.position.y = 0.93 + jump * 0.3;
        hero.group.position.copy(M.pathAt(0.7)); facePath(0.8);
        hero.group.rotation.y += Math.PI * 0.65;                 // 3/4 hacia cámara
        BEA.visible = false;
        cam.position.copy(lerpV(M.pathAt(0.7).clone().add(V3(3.2, 2.4, 3.6)), M.pathAt(0.7).clone().add(V3(2.2, 1.9, 2.6)), eio(lt / d)));
        const hp = headAt(0.7, 1.7);
        cam.lookAt(hp);
        render(cam.position.distanceTo(hp), { bloom: 0.45, warm: 0.09 }); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 1250, eob(seg(lt, pt, pt + 0.3)), '#7CF29A', 'rgba(24,26,20,0.8)', 66);
      } });
      cue(st, 'whoosh'); cue(st + 0.4, 'slam', { gain: 0.7 });
      if (P.etiqueta) cue(st + pt, 'pop');
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
