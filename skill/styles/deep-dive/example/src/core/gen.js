// gen.js — Deep Dive paramétrico: convierte plan.json (escrito por el guionista) en la lista de tomas 3D.
// Cada "toma" del plan: { id, linea, escena, params }. El corte cae justo antes de esa línea (cut(i) = L(i)-0.08)
// y las palabras ancla (ancla_*) resuelven Wd(palabra, linea) — DEBEN existir en la línea (misma tilde: el
// normalizador de timing.js borra la letra acentuada, así "más"→"ms": el ancla DEBE llevar la misma tilde).
// Escenas: hablando · respira · corazon · cerebro · sangre · alarma · golpe · dato · apagon · final · esqueleto · pesas
import * as THREE from 'three';
import { W, H, clamp, lerp, seg, eo, eio, eob } from './lib.js';
import { L, Wd, T } from './timing.js';
import { camera } from './engine.js';
import { Human } from './human.js';
import * as SETS from './sets.js';
import { Skeleton, barbell } from './skeleton.js';
import { label, pill, warning, blackout } from './look2d.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const D = (a) => THREE.MathUtils.degToRad(a);
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
  const dur = (sh) => fin(sh) - cut(sh.linea);
  // tiempo relativo del ancla dentro de la toma (o el default si no hay ancla)
  const pop = (sh, st, key, def) => {
    const a = sh.params?.[`ancla_${key}`];
    return a ? Math.max(0, Wd(a, sh.linea) - st) : def;
  };

  const cam = camera(30);
  const KLOOK = { aperture: 0.003, maxblur: 0.01, bloom: 0.2 };
  const XLOOK = { aperture: 0.0015, bloom: 0.55, bloomThreshold: 0.4, vignette: 0.45 };
  const VLOOK = { aperture: 0.005, maxblur: 0.012, bloom: 0.6, bloomThreshold: 0.5, focus: 3.2 };

  // ── el mundo (se construye UNA vez) ──
  const K = SETS.kitchen(E), hero = new Human({}); hero.group.position.set(0.1, 0, -0.6); K.scene.add(hero.group);
  const X = SETS.xrayStage(E), xh = new Human({}), xmat = SETS.xrayMaterial(); xh.setBodyMaterial(xmat);
  const I = SETS.insides(); xh.spine.add(I.group); X.scene.add(xh.group);
  const VS = SETS.vessel(E);
  const SK = new Skeleton(); X.scene.add(SK.group); SK.group.visible = false;
  const BAR = barbell(); X.scene.add(BAR); BAR.visible = false;
  const CYAN = new THREE.Color('#4FD1E8'), RED = new THREE.Color('#FF3B3B');
  const chest = (h, k) => h.parts[0].scale.set(1 + 0.03 * k, 1 + 0.012 * k, 1 + 0.08 * k);
  const lungs = (k) => I.lungs.forEach((l) => l.scale.set(1 + 0.12 * k, 1 + 0.1 * k, 1 + 0.12 * k));
  const reset = () => { hero.pose({}); chest(hero, 0); xh.pose({}); chest(xh, 0); lungs(0); I.heart.scale.setScalar(1); xmat.uniforms.uCol.value.copy(CYAN); SK.group.visible = false; BAR.visible = false; xh.group.visible = true; };
  const kitchenRender = (focus, extra = {}) => E.render(K.scene, cam, { ...KLOOK, focus, ...extra });
  const xrayRender = (focus, extra = {}) => E.render(X.scene, cam, { ...XLOOK, focus, ...extra });
  const FACE = V3(0.1, 1.68, -0.6);               // cara del héroe (posición fija)
  const HEAD = V3(0, 1.55, 0.09);                 // cara del cuerpo x-ray (al origen)
  const H0 = V3(0.025, 1.41, 0.07);               // corazón dentro del pecho x-ray

  // latidos: lista de tiempos con separación creciente (el ritmo cae)
  const beats = (d, gap0 = 0.62) => { const b = []; let bt = 0.15, gap = gap0; while (bt < d) { b.push(bt); bt += gap; gap = Math.min(1.05, gap * 1.18); } return b; };
  const pulse = (lt, b) => b.reduce((a, x) => Math.max(a, lt >= x ? Math.exp(-(lt - x) * 9) : 0), 0);

  for (const sh of PLAN.tomas) {
    const st = sh.linea === 0 ? 0 : Math.max(cut(sh.linea), S[S.length - 1]?.at + 0.01 || 0);
    const d = fin(sh) - st;
    const P = sh.params || {};
    const esc = sh.escena;

    // 1 · hablando — cocina, primer plano del héroe hablando (pill opcional con dato)
    if (esc === 'hablando') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'héroe habla a cámara', draw(lt, dt, t, blit) {
        reset(); const s = Math.sin(lt * 1.7);
        hero.pose({ head: [2 + 2 * s, -4 + 3 * Math.sin(lt * 0.9), 0], lid: -0.15, look: [0, 2 * s] });
        chest(hero, 0.35 + 0.1 * Math.sin(lt * 2));
        const a = lerp(-0.34, 0.22, eio(lt / d)), r = lerp(0.85, 0.56, eio(lt / d));
        cam.position.set(FACE.x + Math.sin(a) * r, 1.73 + 0.012 * Math.sin(lt * 1.7), FACE.z + Math.cos(a) * r); cam.lookAt(FACE);
        kitchenRender(cam.position.distanceTo(FACE)); blit();
        const tx = P.texto, pt = pop(sh, st, 'texto', 0.3);
        if (tx) pill(tx, 540, 330, eob(seg(lt, pt, pt + 0.25)), '#7CD9F2');
      } });
      cue(st, 'pop', { gain: 0.4 });
    }

    // 2 · respira — rayos-X del pecho: los pulmones se llenan (prof 0..1)
    else if (esc === 'respira') {
      const prof = R(P.prof, 1), ritmo = R(P.ritmo, 2.6);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'rayos-X: pulmones respirando', draw(lt, dt, t, blit) {
        reset(); const cyc = 0.5 - 0.5 * Math.cos(lt * ritmo);
        lungs(0.15 + cyc * prof); chest(xh, cyc * prof); xh.pose({ head: [4, -6, 0], lid: -0.3 });
        cam.position.copy(lerpV(V3(0.55, 1.5, 1.6), V3(0.3, 1.42, 1.05), eio(lt / d))); cam.lookAt(0, 1.33, 0);
        xrayRender(cam.position.distanceTo(V3(0, 1.33, 0))); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) { const [lx, ly] = screen(HEAD, cam); label(et, 760, 520, lx, ly, eob(seg(lt, pt, pt + 0.25))); }
      } });
      cue(st, 'whoosh');
      if (prof > 0.6) { const b0 = pop(sh, st, 'etiqueta', 0.15); cue(st + b0, 'inhale', { dur: 1.0 }); }
    }

    // 3 · corazon — close-up del corazón con latidos que se ralentizan
    else if (esc === 'corazon') {
      const bb = beats(d, R(P.latido, 0.62));
      add({ id: sh.id, at: st, linea: sh.linea, note: 'close-up corazón con latidos', draw(lt, dt, t, blit) {
        reset(); chest(xh, 1); lungs(1); const p = pulse(lt, bb);
        I.heart.scale.setScalar(1 + p * 0.16); I.heart.material.emissiveIntensity = 0.18 + p * 0.8;
        const base = lerpV(V3(0.25, 1.48, 0.62), V3(0.12, 1.44, 0.42), eio(lt / d));
        base.lerp(H0, 0.05 * p); cam.position.copy(base); cam.lookAt(H0);
        xrayRender(cam.position.distanceTo(H0), { bloom: 0.6, aperture: 0.004 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 330, eob(seg(lt, pt, pt + 0.25)), '#FF8A8A');
      } });
      cue(st, 'whoosh'); bb.forEach((b) => cue(st + b, 'heartbeat'));
    }

    // 4 · cerebro — rayos-X de la cabeza con pulso rojo (pensando / alarma mental)
    else if (esc === 'cerebro') {
      const pul = R(P.pulso, 1);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'rayos-X cabeza con pulso', draw(lt, dt, t, blit) {
        reset(); const p = 0.5 + 0.5 * Math.sin(lt * 5);
        xmat.uniforms.uCol.value.copy(CYAN).lerp(RED, 0.25 + 0.3 * p * pul);
        xh.pose({ head: [0, 6 * Math.sin(lt * 1.1), 0], lid: -0.3 });
        cam.position.copy(lerpV(V3(0.4, 1.66, 0.9), V3(0.18, 1.6, 0.55), eio(lt / d))); cam.lookAt(HEAD);
        xrayRender(cam.position.distanceTo(HEAD), { bloom: 0.6 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) { const [lx, ly] = screen(HEAD, cam); label(et, 760, 480, lx, ly, eob(seg(lt, pt, pt + 0.25))); }
      } });
      cue(st, 'whoosh'); cue(st + 0.25, 'pop', { gain: 0.5 });
    }

    // 5 · sangre — dentro de un vaso sanguíneo (macro): co2 y dark son 0..1
    else if (esc === 'sangre') {
      const co2 = clamp(R(P.co2, 0)), dark = clamp(R(P.dark, 0));
      add({ id: sh.id, at: st, linea: sh.linea, note: 'macro vaso sanguíneo', draw(lt, dt, t, blit) {
        VS.update(t, -lt * 1.4, co2, dark);
        cam.position.set(Math.sin(lt) * 0.1, 0, -lt * 1.4); cam.lookAt(0.1, -0.05, -lt * 1.4 - 5);
        E.render(VS.scene, cam, VLOOK); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 330, eob(seg(lt, pt, pt + 0.25)), co2 > 0.3 ? '#C9D6DD' : '#FF8A8A');
      } });
      cue(st, 'whoosh');
      if (co2 > 0.3) cue(st + 0.1, 'bubbles', { dur: d - 0.1 });
      else cue(st, 'slide', { dur: d, gain: 0.5 });
    }

    // 6 · alarma — el cuerpo x-ray late en rojo (alarma del cuerpo)
    else if (esc === 'alarma') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'rayos-X pulso rojo: alarma', draw(lt, dt, t, blit) {
        reset(); chest(xh, 1); lungs(1); const p = 0.5 + 0.5 * Math.sin(lt * 7);
        xmat.uniforms.uCol.value.copy(CYAN).lerp(RED, clamp(lt / 0.8) * (0.55 + 0.45 * p));
        xh.pose({ head: [-4, 10 * Math.sin(lt * 1.3), 0], spine: [0, 0, Math.sin(lt * 9) * 1.2], lid: -0.4 });
        const base = lerpV(V3(-0.4, 1.6, 1.9), V3(-0.15, 1.6, 1.25), eio(lt / d)), temblor = 0.012 * p;
        base.x += Math.sin(lt * 47) * temblor; base.y += Math.sin(lt * 39 + 1) * temblor; base.z += Math.cos(lt * 43) * temblor;
        cam.position.copy(base); cam.lookAt(0, 1.45, 0);
        xrayRender(cam.position.distanceTo(V3(0, 1.45, 0)), { bloom: 0.75 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.2);
        if (et) pill(et, 540, 1200, eob(seg(lt, pt, pt + 0.25)), '#FF5A5A');
      } });
      cue(st, 'whoosh'); cue(st + 0.2, 'alarm', { dur: d - 0.2 });
    }

    // 7 · golpe — espasmos periódicos (calambre, hipo, pulso del músculo)
    else if (esc === 'golpe') {
      const Pd = R(P.periodo, 0.62), fz = R(P.fuerza, 1);
      const tw = (lt) => { const c = (lt - 0.25) % Pd; return lt < 0.25 ? 0 : Math.exp(-c * 14); };
      add({ id: sh.id, at: st, linea: sh.linea, note: 'espasmos periódicos', draw(lt, dt, t, blit) {
        reset(); const j = tw(lt) * fz; chest(xh, 1 + j * 0.8); lungs(1 + j * 1.2);
        xmat.uniforms.uCol.value.copy(CYAN).lerp(RED, 0.25);
        xh.pose({ spine: [6 * j, 0, 0], head: [4 * j, -15, 0], lid: -0.3 });
        cam.position.copy(lerpV(V3(1.25, 1.35, 1.05), V3(0.95, 1.3, 0.8), eio(lt / d))); cam.lookAt(0, 1.25, 0);
        xrayRender(cam.position.distanceTo(V3(0, 1.25, 0))); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) { const [lx, ly] = screen(V3(0.02, 1.2, 0.08), cam); label(et, 330, 1150, lx, ly, eob(seg(lt, pt, pt + 0.25))); }
      } });
      cue(st, 'whoosh'); for (let k = 0; st + 0.25 + k * Pd < st + d; k++) cue(st + 0.25 + k * Pd, 'thud', { gain: 0.45 });
    }

    // 8 · dato — número grande sobre plano medio del héroe
    else if (esc === 'dato') {
      const num = `${P.numero ?? ''}${P.numero && P.texto ? ' ' : ''}${P.texto ?? ''}`.trim();
      add({ id: sh.id, at: st, linea: sh.linea, note: 'plano medio + dato grande', draw(lt, dt, t, blit) {
        reset(); hero.pose({ head: [2, -6 + Math.sin(lt * 2) * 3, 0], lid: -0.15, look: [6, 0] }); chest(hero, 0.5);
        const a = lerp(0.55, 0.2, eio(lt / d));
        cam.position.set(0.1 + Math.sin(a) * 2.1, lerp(1.95, 1.35, eio(lt / d)), -0.6 + Math.cos(a) * 2.1); cam.lookAt(0.1, 1.25, -0.6);
        kitchenRender(2.1); blit();
        const pt = pop(sh, st, 'x', 0.35);
        pill(num, 540, 900, eob(seg(lt, pt, pt + 0.3)), '#FFD43B', 'rgba(12,14,20,0.8)', 92);
      } });
      cue(st, 'whoosh'); cue(st + 0.05, 'pop', { gain: 0.6 });
    }

    // 9 · apagon — los ojos se cierran y todo se funde a negro
    else if (esc === 'apagon') {
      const off = pop(sh, st, 'apagon', d * 0.55);
      add({ id: sh.id, at: st, linea: sh.linea, note: 'ojos se cierran, apagón', draw(lt, dt, t, blit) {
        reset(); const k = eio(seg(lt, off - 0.4, d)); chest(hero, 1 - k * 0.5);
        hero.pose({ head: [12 * k, -4, 6 * k], spine: [5 * k, 0, 2 * k], lid: lerp(-0.1, 1.05, k), look: [0, 6 * k] });
        cam.position.copy(lerpV(V3(-0.25, 1.7, 0.2), V3(-0.18, 1.62, 0.0), eio(lt / d)));
        cam.up.set(Math.sin(k * 0.12), 1, 0); cam.lookAt(V3(0.1, 1.64 - 0.05 * k, -0.6));
        kitchenRender(0.75, { aperture: 0.004 }); cam.up.set(0, 1, 0); blit();
        const et = P.etiqueta;
        if (et) pill(et, 540, 430, eob(seg(lt, 0.2, 0.45)), '#FF8A8A');
        blackout(seg(lt, off, d));
      } });
      cue(st, 'slide', { dur: 1.2, gain: 0.5 });
    }

    // 10 · final — el héroe mira a cámara + cartel de aviso (consejo final)
    else if (esc === 'final') {
      add({ id: sh.id, at: st, linea: sh.linea, note: 'cierre: héroe a cámara + warning', draw(lt, dt, t, blit) {
        reset(); hero.pose({ head: [-2, 0, 0], lid: 0.05, look: [0, 0] }); chest(hero, 0.3);
        cam.position.copy(lerpV(V3(0.0, 1.62, 0.9), V3(0.05, 1.64, 0.55), eio(lt / d))); cam.lookAt(FACE);
        kitchenRender(cam.position.distanceTo(FACE)); blit();
        warning(540, 1150, eob(seg(lt, 0.25, 0.55)) * 0.95);
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) pill(et, 540, 430, eob(seg(lt, pt, pt + 0.25)), '#7CF29A');
      } });
      cue(st, 'whoosh'); cue(st + 0.25, 'slam', { gain: 0.7 });
    }

    // 11 · esqueleto — cuerpo entero de huesos sobre el escenario x-ray: quieto · camina · tiembla · cae
    else if (esc === 'esqueleto') {
      const acc = R(P.accion, 'quieto'), tt1 = R(P.tropiezo, Math.min(0.45, d * 0.18)), tca = Math.max(tt1 + 0.2, d - R(P.impacto, 0.95));
      add({ id: sh.id, at: st, linea: sh.linea, note: `esqueleto: ${acc}`, draw(lt, dt, t, blit) {
        reset(); xh.group.visible = false; SK.group.visible = true;
        SK.group.rotation.set(0, 0, 0); SK.group.position.set(0, 0, 0);
        SK.brillo(0.4 + 0.1 * Math.sin(lt * 2.2));
        const j = Math.sin(lt * 34) * 1.2 + Math.sin(lt * 21.7) * 0.8;    // temblor en grados
        if (acc === 'camina') SK.walk(lt * 4.2, 1);
        else if (acc === 'tiembla') {
          SK.hips.position.y = 0.86;
          SK.pose({ hipL: [14, 0, 3], hipR: [14, 0, 3], knL: 26, knR: 26, spine: [10 + j * 0.4, j * 0.5, 0], head: [-8, j, 0], shL: [8, 0, 10], shR: [8, 0, 10], elL: 32, elR: 32 });
        } else if (acc === 'cae') {
          SK.hips.position.y = 0.93; SK.brillo(0.45);
          if (lt < tt1) SK.pose({ spine: [4, j * 0.3, 0], head: [4, 0, 0], shL: [10, 0, 12], shR: [10, 0, 12], elL: 24, elR: 24 });
          else {
            const k = clamp((lt - tt1) / Math.max(0.12, (tca - tt1) * 0.55));
            const rebote = lt > tca ? 5 * Math.exp(-(lt - tca) * 7) * Math.sin((lt - tca) * 15) : 0;
            SK.group.rotation.x = D(-eio(k) * 84 + rebote);
            SK.pose({ spine: [-14 * k, 0, 0], head: [10 + 8 * k, 0, 0], shL: [-30 - 130 * k, 0, 30 + 40 * k], shR: [-30 - 130 * k, 0, -30 - 40 * k], elL: 14, elR: 14, hipL: [-8 - 40 * k, 0, 6], hipR: [-8 - 40 * k, 0, 6], knL: 18 + 30 * k, knR: 18 + 30 * k });
          }
        } else { SK.hips.position.y = 0.93; SK.pose({ spine: [2, 4 * Math.sin(lt * 0.8), 0], head: [1, 5 * Math.sin(lt * 0.6), 0], shL: [4, 0, 9], shR: [4, 0, 9], elL: 14, elR: 14 }); }
        if (acc === 'cae') {
          const k2 = clamp((lt - tt1) / (d - tt1));
          cam.position.set(0.9 - 1.2 * eio(k2), 1.6 - 0.45 * eio(k2), 2.1 + 1.3 * eio(k2));
          const im = lt > tca ? Math.exp(-(lt - tca) * 8) : 0;
          cam.position.x += Math.sin(lt * 51) * 0.05 * im; cam.position.y += Math.sin(lt * 44) * 0.04 * im;
          cam.lookAt(0, lerp(1.35, 0.6, eio(k2)), 0.25);
        } else {
          const a = lerp(-0.5, 0.25, eio(lt / d));
          const r = acc === 'tiembla' ? lerp(2.1, 1.65, eio(lt / d)) : lerp(3.75, 3.05, eio(lt / d));
          cam.position.set(Math.sin(a) * r, (acc === 'tiembla' ? 1.72 : 1.75) + 0.06 * Math.sin(lt * 0.9), Math.cos(a) * r);
          const hb = acc === 'tiembla' ? 0.006 : 0.003;
          cam.position.x += Math.sin(lt * 13) * hb; cam.position.y += Math.cos(lt * 11) * hb;
          cam.lookAt(0, acc === 'tiembla' ? 1.42 : 1.02, 0);
        }
        xrayRender(cam.position.distanceTo(V3(0, 1.15, 0)), { bloom: 0.5, aperture: 0.0022 }); blit();
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.25);
        if (et) pill(et, 540, 300, eob(seg(lt, pt, pt + 0.25)), acc === 'cae' ? '#FF5A5A' : '#7CD9F2');
      } });
      cue(st, 'whoosh');
      if (acc === 'cae') { cue(st + tca, 'slam', { gain: 0.8 }); cue(st + tca + 0.05, 'thud', { gain: 0.5 }); }
      else if (acc === 'camina') cue(st, 'slide', { dur: d, gain: 0.45 });
      else if (acc === 'tiembla') cue(st, 'slide', { dur: d, gain: 0.3 });
    }

    // 12 · pesas — el esqueleto hace press de barra: repeticiones, pico de esfuerzo y fatiga acumulada
    else if (esc === 'pesas') {
      const reps = Math.max(1, R(P.reps, 3)), fat = clamp(R(P.fatiga, 0)), per = d / reps;
      add({ id: sh.id, at: st, linea: sh.linea, note: 'esqueleto: press de barra', draw(lt, dt, t, blit) {
        reset(); xh.group.visible = false; SK.group.visible = true; BAR.visible = true;
        SK.group.rotation.set(0, 0, 0);
        const nrep = Math.min(reps, Math.floor(lt / per) + 1), prog = nrep / reps;
        const ph = (lt % per) / per, u = ph < 0.42 ? eio(ph / 0.42) : 1 - eio(Math.min(1, (ph - 0.42) / 0.58));
        const jz = fat * prog * (Math.sin(lt * 31) * 1.4 + Math.sin(lt * 19) * 0.9);
        SK.hips.position.y = lerp(0.895, 0.94, u) - 0.008 * (1 - u);
        SK.pose({ spine: [lerp(9, 2, u) + (1 - u) * fat * 4, jz * 0.35, 0], head: [lerp(-4, 2, u), 0, 0],
          shL: [lerp(22, 180, u), 0, 7 + Math.abs(jz) * 0.4], shR: [lerp(22, 180, u), 0, -(7 + Math.abs(jz) * 0.4)],
          elL: lerp(122, 8, u) + Math.abs(jz), elR: lerp(122, 8, u) + Math.abs(jz),
          hipL: [lerp(10, 2, u), 0, 4], hipR: [lerp(10, 2, u), 0, 4], knL: lerp(14, 5, u), knR: lerp(14, 5, u) });
        BAR.position.copy(SK.mano('L')).add(SK.mano('R')).multiplyScalar(0.5); BAR.position.y += 0.015;
        const pico = pulse(lt, Array.from({ length: reps }, (_, i) => (i + 0.42) * per));
        SK.brillo(0.42 + pico * 0.85 + fat * prog * 0.15);
        xmat.uniforms.uCol.value.copy(CYAN).lerp(RED, fat * prog * 0.35);
        const a = lerp(0.95, 0.35, eio(lt / d)), r = lerp(3.5, 2.95, eio(lt / d));
        cam.position.set(Math.sin(a) * r, 1.35 + 0.3 * eio(lt / d) + 0.03 * pico, Math.cos(a) * r);
        cam.position.x += Math.sin(lt * 41) * 0.012 * (pico + fat * 0.4); cam.position.y += Math.cos(lt * 37) * 0.01 * (pico + fat * 0.4);
        cam.lookAt(0, 1.4, 0.1);
        xrayRender(cam.position.distanceTo(V3(0, 1.3, 0)), { bloom: 0.55, aperture: 0.0028 }); blit();
        pill(`REP Nº ${nrep}`, 540, 240, eob(seg(lt, 0.15, 0.4)), '#FFD43B');
        const et = P.etiqueta, pt = pop(sh, st, 'etiqueta', 0.3);
        if (et) pill(et, 540, 330, eob(seg(lt, pt, pt + 0.25)), fat > 0.4 ? '#FF8A8A' : '#7CD9F2');
      } });
      cue(st, 'whoosh');
      for (let i = 0; i < reps; i++) { cue(st + (i + 0.42) * per, 'thud', { gain: 0.5 }); cue(st + (i + 0.42) * per, 'heartbeat'); }
      if (fat > 0.5) cue(st, 'alarm', { dur: d * 0.6 });
    }

    else throw new Error(`escena desconocida en toma ${sh.id}: "${esc}"`);
  }

  return { shots: S, cues: CUES };
}
