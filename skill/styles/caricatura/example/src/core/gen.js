// gen.js — Caricatura: convierte plan.json (escrito por el guionista) en tomas 3D de tarjetas animadas.
// Cada "toma" del plan: { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde).
// Escenas: hablando · ejercito · rey · duelo · carga · personaje · caida · dato · final
// El look: personajes planos dibujados a mano (toon.js) pegados a un mundo 3D soleado (mundo.js),
// cámara que nunca se detiene (push-in lento en holds, glides simétricos), foco corto, grano de película.
import * as THREE from 'three';
import { clamp, lerp, seg, eo, eio, eob } from './lib.js';
import { L, Wd, T } from './timing.js';
import { camera } from './engine.js';
import { mundo, makeCrowd, TarjetaViva, sombra, polvo } from './mundo.js';
import { DEF_LIGHT, REY, OFFICER, SOLDADO, PUEBLANO, KID } from './toon.js';
import { label, pill, warning, blackout } from './look2d.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const D = (a) => THREE.MathUtils.degToRad(a);
const lerpV = (a, b, k) => a.clone().lerp(b, k);

// ─── fábrica de tomas ───
export function buildShots(PLAN, E) {
  const S = [], CUES = [];
  const add = (o) => (S.push(o), o);
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.08);
  const R = (v, d0) => (v == null ? d0 : v);
  const fin = (sh) => { const nx = PLAN.tomas[PLAN.tomas.indexOf(sh) + 1]; return nx ? cut(nx.linea) : T.dur; };
  const pop = (sh, st, key, def) => {
    const a = sh.params?.[`ancla_${key}`];
    return a ? Math.max(0, Wd(a, sh.linea) - st) : def;
  };

  const M = mundo(E);
  const cam = camera(30);                 // primer plano
  const camA = camera(52);                // planos de ejército (anchos)
  const LOOK = { aperture: 0.0024, maxblur: 0.007, bloom: 0.16, bloomThreshold: 0.8, vignette: 0.38, grain: 0.022, warm: 0.03 };
  const LOOKW = { aperture: 0.0016, maxblur: 0.006, bloom: 0.2, bloomThreshold: 0.8, vignette: 0.42, grain: 0.024, warm: 0.035 };

  // ── el mundo: se construye UNA vez ──
  const TRAJES = { rey: () => REY(0), capitan: () => OFFICER, soldado: () => SOLDADO(0), aldeano: () => PUEBLANO(0), nino: () => KID };
  const traje = (P) => (TRAJES[P.objeto] || TRAJES.rey)();

  const heroViva = new TarjetaViva(1.8); M.scene.add(heroViva.mesh);
  const heroSide = new TarjetaViva(1.8); M.scene.add(heroSide.mesh);
  heroViva.mesh.rotation.order = 'YXZ'; heroSide.mesh.rotation.order = 'YXZ';
  const sombraHero = sombra(M.scene, 0, 0.03, 1, false);
  const polvos = [0, 1, 2].map((i) => polvo(M.scene, 0, 0.3, 0, 0.8 + i * 0.35));
  const CARA = V3(0, 1.5, 0);

  const propio = makeCrowd(M.scene, { n: 96, variants: 8, raise: false });
  const asalto = makeCrowd(M.scene, { n: 96, variants: 8, raise: true });
  const enemigo = makeCrowd(M.scene, {
    n: 96, variants: 8, raise: false,
    outfitFn: (i) => SOLDADO(i, { jacket: ['#3f6fb5', '#2f5f8a', '#4a7aa8'][i % 3], shield: '#3f6fae', hat: 'tophat' }),
  });
  const TODOS = [propio, asalto, enemigo];

  const reset = () => {
    const H = M.setHora('dia');
    heroViva.mesh.visible = false; heroViva.mesh.rotation.set(0, 0, 0); heroViva.mesh.position.set(0, 0, 0);
    heroSide.mesh.visible = false; heroSide.mesh.rotation.set(0, 0, 0); heroSide.mesh.position.set(0, 0, 0);
    sombraHero.visible = false;
    M.loma.visible = false;
    for (const c of TODOS) { c.group.visible = false; c.group.position.set(0, 0, 0); }
    for (const p of polvos) p.visible = false;
    const tint = H.tinte;
    heroViva.mat.color.setRGB(...tint); heroSide.mat.color.setRGB(...tint);
    for (const c of TODOS) c.tinte(tint[0], tint[1], tint[2]);
    cam.up.set(0, 1, 0); camA.up.set(0, 1, 0);
  };
  const syncNiebla = () => {
    const f = M.scene.fog;
    for (const c of TODOS) c.niebla(f.color, f.near, f.far);
  };
  const bilboard = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z);
  };
  const shake = (lt, desde, amp) => {
    if (lt <= desde) return [0, 0];
    const k = Math.min(1, (lt - desde) / 0.12), m = Math.exp(-(lt - desde) * 3.2) * amp * k;
    return [Math.sin(lt * 47) * m, Math.cos(lt * 41 + 1) * m];
  };

  for (const sh of PLAN.tomas) {
    const st = sh.linea === 0 ? 0 : Math.max(cut(sh.linea), S[S.length - 1]?.at + 0.01 || 0);
    const d = fin(sh) - st;
    const P = sh.params || {};
    const esc = sh.escena;

    // 1 · hablando — el personaje de frente a cámara, boca animada, push-in lento
    if (esc === 'hablando') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'personaje habla a cámara', draw(lt, dt, t, blit) {
        reset();
        const o = traje(P);
        const boca = Math.sin(lt * 8.5) > 0.12;
        const blink = (lt % 3.3) < 0.13;
        heroViva.draw(o, { mode: 'stand', expr: boca ? 'abierta' : 'serio', blink, look: Math.sin(lt * 0.7) * 2, light: DEF_LIGHT, seed: 3 });
        heroViva.mesh.visible = true; sombraHero.visible = true;
        bilboard(heroViva.mesh, 0, 0, 0);
        sombraHero.position.set(0, 0.03, 0);
        const a = lerp(0.30, 0.10, eio(lt / d)), r = lerp(3.05, 2.4, eio(lt / d));
        cam.position.set(Math.sin(a) * r, 1.74 + 0.012 * Math.sin(lt * 1.5), Math.cos(a) * r);
        cam.lookAt(CARA);
        syncNiebla();
        E.render(M.scene, cam, { ...LOOK, focus: cam.position.distanceTo(CARA) }); blit();
        const tx = P.texto, pt = pop(sh, st, 'texto', 0.3);
        if (tx) pill(tx, 540, 330, eob(seg(lt, pt, pt + 0.25)), '#FFD43B');
        const et = P.etiqueta, pe = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 190, eob(seg(lt, pe, pe + 0.25)), '#7CD9F2');
      } });
      cue(st, 'whoosh');
      const tx = P.texto; if (tx) cue(st + pop(sh, st, 'texto', 0.3), 'pop', { gain: 0.45 });
    }

    // 2 · ejercito — formación marchando en el sitio, la cámara recorre las filas
    else if (esc === 'ejercito') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'ejército en formación', draw(lt, dt, t, blit) {
        reset();
        propio.group.visible = true;
        propio.formar({ filas: R(P.filas, 8), cols: 12, z0: -2.6, dx: 1.0, dz: 1.18, semilla: 4 });
        propio.actualizar(t, 0.05, 5.2);
        const k = eio(lt / d);
        camA.position.set(lerp(-2.9, 2.9, k), lerp(1.6, 1.78, k), lerp(3.6, 3.2, k));
        camA.lookAt(0, 1.25, -5.5);
        syncNiebla();
        E.render(M.scene, camA, { ...LOOKW, focus: camA.position.distanceTo(V3(0, 1.2, -5.5)) }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.25);
        if (et) pill(et, 540, 240, eob(seg(lt, pt, pt + 0.25)), '#FFD43B');
      } });
      cue(st, 'whoosh'); cue(st, 'slide', { dur: d, gain: 0.4 });
    }

    // 3 · rey — el rey sobre la loma arenga a su guardia, cámara en arco
    else if (esc === 'rey') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'el rey arenga', draw(lt, dt, t, blit) {
        reset();
        const o = traje(P);
        const boca = Math.sin(lt * 8.5) > 0.12;
        heroViva.draw(o, { mode: 'stand', expr: boca ? 'grito' : 'serio', blink: (lt % 3.7) < 0.13, raise: 0.55, light: DEF_LIGHT, seed: 2 });
        heroViva.mesh.visible = true; sombraHero.visible = true; M.loma.visible = true;
        bilboard(heroViva.mesh, 0, 0.55, -1.2);
        sombraHero.position.set(0, 0.58, -1.2);
        propio.group.visible = true;
        propio.formar({ filas: 5, cols: 12, z0: -3.6, dx: 1.0, dz: 1.15, semilla: 4 });
        propio.actualizar(t, 0.03, 4.0);
        const a = lerp(-0.52, 0.24, eio(lt / d)), r = lerp(4.3, 3.4, eio(lt / d));
        cam.position.set(Math.sin(a) * r, lerp(2.1, 1.9, eio(lt / d)), -1.2 + Math.cos(a) * r);
        cam.lookAt(0, 1.85, -1.2);
        syncNiebla();
        E.render(M.scene, cam, { ...LOOK, focus: cam.position.distanceTo(V3(0, 1.85, -1.2)) }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.25);
        if (et) pill(et, 540, 220, eob(seg(lt, pt, pt + 0.25)), '#FFD43B');
      } });
      cue(st, 'whoosh'); cue(st + 0.3, 'slam', { gain: 0.5 });
    }

    // 4 · duelo — dos ejércitos frente a frente; la cámara sube y aleja revelando la brecha
    else if (esc === 'duelo') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'dos ejércitos frente a frente', draw(lt, dt, t, blit) {
        reset(); M.setHora('oro');
        propio.group.visible = enemigo.group.visible = true;
        propio.formar({ filas: 5, cols: 12, z0: -2.2, dx: 1.0, dz: 1.2, semilla: 4 });
        enemigo.formar({ filas: 5, cols: 12, z0: -2.2, dx: 1.0, dz: 1.2, semilla: 9 });
        enemigo.group.position.z = 17;
        propio.actualizar(t, 0.04, 4.6); enemigo.actualizar(t, 0.04, 4.6);
        const k = eio(lt / d);
        camA.position.set(lerp(0.5, 0, k), lerp(1.5, 4.4, k), lerp(6.5, 13.5, k));
        camA.lookAt(0, lerp(1.1, 0.9, k), 7);
        syncNiebla();
        E.render(M.scene, camA, { ...LOOKW, focus: 12 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.25);
        if (et) pill(et, 540, 240, eob(seg(lt, pt, pt + 0.25)), '#FF8A8A');
      } });
      cue(st, 'whoosh'); cue(st, 'alarm', { dur: d * 0.75, gain: 0.35 });
    }

    // 5 · carga — la horda con lanzas alzadas corre hacia la cámara, que retrocede temblando
    else if (esc === 'carga') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'la carga hacia cámara', draw(lt, dt, t, blit) {
        reset(); M.setHora('oro');
        asalto.group.visible = true;
        asalto.formar({ filas: 6, cols: 12, z0: -1.8, dx: 0.95, dz: 1.3, semilla: 6 });
        asalto.group.position.z = 22 - 13 * eio(clamp(lt / d, 0, 1));
        asalto.actualizar(t, 0.085, 8.5);
        const k = eio(lt / d);
        camA.position.set(0, lerp(1.0, 1.3, k), lerp(5.2, 8.4, k));
        const [sx, sy] = shake(lt, d - 0.5, 0.06);
        camA.position.x += sx; camA.position.y += sy;
        camA.lookAt(0, 1.3, 3);
        syncNiebla();
        E.render(M.scene, camA, { ...LOOKW, aperture: 0.002, focus: 10, bloom: 0.26 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 240, eob(seg(lt, pt, pt + 0.25)), '#FF5A5A');
      } });
      cue(st, 'whoosh'); cue(st, 'alarm', { dur: d * 0.7, gain: 0.4 }); cue(st + d - 0.3, 'slam', { gain: 0.7 });
    }

    // 6 · personaje — un héroe solo: camina · saluda · arenga · quieto
    else if (esc === 'personaje') {
      const acc = R(P.accion, 'camina');
      add({ id: sh.id, at: st, linea: sh.linea, note: `personaje: ${acc}`, draw(lt, dt, t, blit) {
        reset();
        const o = traje(P);
        const hx = acc === 'camina' ? lerp(-3.4, 3.4, eio(clamp(lt / d, 0, 1))) : 0;
        if (acc === 'camina') {
          heroSide.drawSide(o, { mode: 'march', ph: lt * 2.3, light: DEF_LIGHT, seed: 5, expr: 'neutral' });
          heroSide.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroSide.mesh, hx, 0, 0);
          sombraHero.position.set(hx, 0.03, 0);
          cam.position.set(hx * 0.85 + 0.3, 1.52, 4.1);
          cam.lookAt(hx * 0.9, 1.05, 0);
        } else if (acc === 'saluda') {
          heroViva.draw(o, { mode: 'stand', expr: 'sonrisa', wave: 0.5 + 0.5 * Math.sin(lt * 5.2), blink: (lt % 3.4) < 0.13, light: DEF_LIGHT, seed: 4 });
          heroViva.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroViva.mesh, 0, 0, 0);
          sombraHero.position.set(0, 0.03, 0);
          const a = lerp(-0.2, 0.14, eio(lt / d));
          cam.position.set(Math.sin(a) * 3.0, 1.66, Math.cos(a) * 3.0);
          cam.lookAt(0, 1.45, 0);
        } else if (acc === 'arenga') {
          heroViva.draw(o, { mode: 'stand', expr: 'grito', raise: 1, blink: (lt % 3.4) < 0.13, light: DEF_LIGHT, seed: 2 });
          heroViva.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroViva.mesh, 0, 0, 0);
          sombraHero.position.set(0, 0.03, 0);
          const a = lerp(0.34, 0.05, eio(lt / d));
          cam.position.set(Math.sin(a) * lerp(4.6, 3.4, eio(lt / d)), lerp(1.35, 1.75, eio(lt / d)), Math.cos(a) * lerp(4.6, 3.4, eio(lt / d)));
          cam.lookAt(0, 1.35, 0);
        } else { // quieto
          heroViva.draw(o, { mode: 'stand', expr: 'neutral', blink: (lt % 3.6) < 0.13, light: DEF_LIGHT, seed: 3 });
          heroViva.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroViva.mesh, 0, 0, 0);
          sombraHero.position.set(0, 0.03, 0);
          const r = lerp(3.6, 2.9, eio(lt / d));
          cam.position.set(Math.sin(0.12) * r, 1.7, Math.cos(0.12) * r);
          cam.lookAt(0, 1.45, 0);
        }
        syncNiebla();
        E.render(M.scene, cam, { ...LOOK, focus: cam.position.distanceTo(V3(hx, 1.1, 0)) }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.25);
        if (et) pill(et, 540, 300, eob(seg(lt, pt, pt + 0.25)), '#7CD9F2');
      } });
      cue(st, 'whoosh');
      if (acc === 'camina') cue(st, 'slide', { dur: d, gain: 0.45 });
      if (acc === 'arenga') cue(st + 0.3, 'slam', { gain: 0.55 });
    }

    // 7 · caida — el héroe titubea y se desploma de lado; polvo + sacudida en el impacto
    else if (esc === 'caida') {
      const tt1 = R(P.tropiezo, Math.min(0.45, d * 0.22)), tca = Math.max(tt1 + 0.3, d - R(P.impacto, 0.85));
      add({ id: sh.id, at: st, linea: sh.linea, note: 'el héroe tropieza y cae', draw(lt, dt, t, blit) {
        reset();
        const o = traje(P);
        if (lt < tt1) {
          const w = eio(clamp(lt / tt1, 0, 1));
          heroViva.draw(o, { mode: 'stand', expr: 'nervioso', tilt: 20 * w * Math.sin(lt * 9) * 0.4 + 14 * w, blink: true, light: DEF_LIGHT, seed: 3 });
          heroViva.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroViva.mesh, 0, 0, 0); sombraHero.position.set(0, 0.03, 0);
        } else {
          const kf = clamp((lt - tca) / 0.3, 0, 1);
          if (lt < tca) {
            const w = clamp((lt - tt1) / (tca - tt1), 0, 1);
            heroViva.draw(o, { mode: 'stand', expr: w > 0.5 ? 'shock' : 'nervioso', tilt: lerp(16, 82, eio(w)), blink: true, light: DEF_LIGHT, seed: 3 });
            heroViva.mesh.rotation.z = 0;
          } else {
            heroViva.draw(o, { mode: 'fall', expr: 'dolor', light: DEF_LIGHT, seed: 3 });
            heroViva.mesh.rotation.z = -1.22 * eio(kf);
          }
          heroViva.mesh.visible = true; sombraHero.visible = true;
          bilboard(heroViva.mesh, 0, 0, 0); sombraHero.position.set(0, 0.03, 0);
          const im = lt >= tca ? Math.exp(-(lt - tca) * 4.5) : 0;
          for (let i = 0; i < polvos.length; i++) {
            const p = polvos[i], g0 = clamp((lt - tca) / 0.5 - i * 0.12, 0, 1);
            p.visible = g0 > 0 && g0 < 1;
            if (p.visible) { p.scale.setScalar((0.55 + g0 * 0.9) * (0.8 + i * 0.3)); p.position.set(0.25 + i * 0.22, 0.28 + g0 * 0.5, 0.12 + i * 0.14); }
          }
          const k2 = eio(clamp((lt - tt1) / (d - tt1), 0, 1));
          cam.position.set(1.25, 1.55, 3.3);
          const [sx, sy] = shake(lt, tca, 0.075 * (0.3 + im));
          cam.position.x += sx; cam.position.y += sy;
          cam.lookAt(0, lerp(1.25, 0.5, k2), 0);
        }
        syncNiebla();
        E.render(M.scene, cam, { ...LOOK, focus: 3.0 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 300, eob(seg(lt, pt, pt + 0.25)), '#FF5A5A');
      } });
      cue(st, 'whoosh'); cue(st + tca, 'slam', { gain: 0.8 }); cue(st + tca + 0.06, 'thud', { gain: 0.5 });
    }

    // 8 · dato — plano medio del héroe + número grande
    else if (esc === 'dato') {
      const num = `${P.numero ?? ''}${P.numero && P.texto ? ' ' : ''}${P.texto ?? ''}`.trim();
      add({ id: sh.id, at: st, linea: sh.linea, note: 'plano medio + dato grande', draw(lt, dt, t, blit) {
        reset();
        heroViva.draw(traje(P), { mode: 'stand', expr: 'serio', blink: (lt % 3.5) < 0.13, look: 5, light: DEF_LIGHT, seed: 3 });
        heroViva.mesh.visible = true; sombraHero.visible = true;
        bilboard(heroViva.mesh, 0, 0, 0); sombraHero.position.set(0, 0.03, 0);
        const a = lerp(0.5, 0.16, eio(lt / d));
        cam.position.set(Math.sin(a) * lerp(3.6, 2.7, eio(lt / d)), lerp(1.95, 1.5, eio(lt / d)), Math.cos(a) * lerp(3.6, 2.7, eio(lt / d)));
        cam.lookAt(0, 1.3, 0);
        syncNiebla();
        E.render(M.scene, cam, { ...LOOK, focus: 2.8 }); blit();
        const pt = pop(sh, st, 'x', 0.35);
        pill(num, 540, 900, eob(seg(lt, pt, pt + 0.3)), '#FFD43B', 'rgba(12,14,20,0.8)', 92);
      } });
      cue(st, 'whoosh'); cue(st + 0.05, 'pop', { gain: 0.6 });
    }

    // 9 · final — plano ancho dorado del ejército + cartel de aviso
    else if (esc === 'final') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'cierre: ejército al atardecer', draw(lt, dt, t, blit) {
        reset(); M.setHora('oro');
        propio.group.visible = true;
        propio.formar({ filas: 7, cols: 12, z0: -2.6, dx: 1.0, dz: 1.18, semilla: 4 });
        propio.actualizar(t, 0.035, 4.2);
        const k = eio(lt / d);
        camA.position.set(0, lerp(2.2, 1.75, k), lerp(11.5, 9.0, k));
        camA.lookAt(0, 1.2, -5);
        syncNiebla();
        E.render(M.scene, camA, { ...LOOKW, focus: 10 }); blit();
        warning(540, 1150, eob(seg(lt, 0.25, 0.55)) * 0.95);
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) pill(et, 540, 240, eob(seg(lt, pt, pt + 0.25)), '#7CF29A');
      } });
      cue(st, 'whoosh'); cue(st + 0.3, 'slam', { gain: 0.6 });
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
