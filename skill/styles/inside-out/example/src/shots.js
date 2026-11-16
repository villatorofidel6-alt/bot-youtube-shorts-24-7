// shots.js — genérico: lee plan.json (escrito por el guionista) y construye las tomas con el generador del estilo.
// El plan lleva: { lineas: [{texto, caps?, pausa?}], tomas: [{id, linea, escena, cam?, zoom?, params}] }.
// Las palabras ancla de las tomas resuelven contra las LÍNEAS del guion: si el plan menciona una palabra que no
// existe, timing.js lanza y el chequeo (node tools/capture.mjs check) lo detiene antes de renderizar.
import { L, Wd, T } from './core/timing.js';
import * as G from './core/gen.js';

const PLAN = await (await fetch('plan.json', { cache: 'no-store' })).json();

export function buildShots() {
  return G.buildShots(PLAN);
}
