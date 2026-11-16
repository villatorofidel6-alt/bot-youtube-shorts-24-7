# Deep Dive 3D: explicadores 3D estilizados "¿Qué pasaría si…?", 9:16 (el buque insignia)

3D real, renderizado en el navegador con three.js: personas estilizadas esculpidas en sets cálidos y soleados, cortes de
rayos X brillantes, viajes de cámara por vasos sanguíneos, enfoque corto, una cámara que nunca se detiene. Curioso,
impactante, satisfactorio. Ejemplo: `example/` = **WHAT HAPPENS IF YOU HOLD YOUR BREATH?** (37 s, 11 tomas). Hoja de
estilo: `style-sheet.png` (regenérala abriendo `example/sheet.html` vía `node tools/capture.mjs preview`).

## 1. El look (reglas)
- **Tres mundos, y cada video se mueve entre ellos:** (A) el mundo real: una persona en un set cálido y soleado (cocina),
  (B) el rayos X: el mismo cuerpo como vidrio cian con esqueleto y órganos brillantes, (C) dentro del cuerpo: macros
  (vaso sanguíneo, órganos) en rojo profundo con bloom. Mundo real → rayos X → interior → de vuelta fuera para el final.
- **Sol bajo cálido fuera, cian dentro del cuerpo.** Cian rayos X `#4FD1E8` solo para vidrio de rayos X; rojo `#B8283A`
  para sangre.
- **Enfoque corto siempre:** foco en el sujeto, fondo suave (`aperture` 0,003-0,006 en el mundo real).
- **La cámara siempre se mueve:** cada toma empuja, orbita o deriva (interpola la cámara entre dos puntos durante la toma).
- **Sin gore.** Lesión o peligro se muestra como rayos X, brillo, color de alarma roja o un cartel de aviso, nunca heridas.
- Personas: un cuerpo esculpido, muchos looks (`new Human({ skin, shirt, pants, shoes, hair, iris })`). Rostros calmados y
  legibles; evita primeros planos de manos (las manos son mitones simples).
- Subtítulos: sentence case, 1-3 palabras, blancos con contorno oscuro, una palabra en amarillo (`src/core/captions.js`, y 1480).
  Etiquetas: pills oscuras pequeñas con línea guía (`label()`), contadores/datos como pills (`pill()`), `warning()` para peligro.

## 2. Formato
- 1080x1920, 24 fps (cinemático, y más rápido de renderizar), 30-45 s. Narración `am_michael` x1.0, conversacional.
- Una línea = una toma (corte justo antes de la línea: `cut(i)`), y una línea larga puede sostener una segunda toma que
  empieza sobre una palabra (`Wd('sangre', 2)`), ej. pulmones de rayos X → corte en "sangre" → dentro del vaso.
- Música: `"tension"` (dron bajo + pulso lento) para temas de cuerpo/peligro, `"bed"` para los ligeros.

## 3. Mapa del motor (`example/src/`)
| archivo | te da |
|---|---|
| `core/engine.js` | `makeEngine(canvas, { w, h, samples })` → `E.render(escena, cam, look)`: tono ACES, sombras suaves, luz ambiental de habitación, profundidad de campo, bloom, viñeta + grano. `look = { focus, aperture, maxblur, bloom, bloomThreshold, exposure, vignette, grain, warm }`. `lightRig(escena, {...})`, `camera(fov)` |
| `core/sdf.js` | esculpido: `sphere, ellipsoid, capsule, rbox, torus, smin/smax/ssub, noise3`, `mesh(sdf, bounds, step, colorFn)` (surface nets → BufferGeometry suave con colores por vértice). Úsalo para cualquier órgano, objeto o pieza de set nuevo para que todo comparta el look de arcilla suave |
| `core/human.js` | `new Human(look)`: `.group` (pies en y 0, mira a +z), `.pose({ spine, head, shL, elL, shR, elR, hipL, knL, hipR, knR, lid, look })` (grados; lid -0.4 abierto … 1 cerrado), `.walk(fase, amt)`, `.setBodyMaterial(m)` (rayos X), `.parts[0]` = torso (escálalo para respirar), `.spine` (engancha vísceras), `.hips.position.y` (sentado: 0,66 + caderas 88°, rodillas 88°) |
| `core/sets.js` | `kitchen(E)`, `xrayStage(E)`, `vessel(E)` (`.update(t, camZ, co2, dark)`), `xrayMaterial(color)`, `insides()` → `{ group, stomach, heart, lungs }` |
| `core/skeleton.js` | `new Skeleton()`: esqueleto completo de primitivas con la MISMA API de pose que Human (`.pose(q)`, `.walk(ph, amt)`); `.mano('L'|'R')` da la posición de la mano en mundo (para anclar la barra); `.brillo(v)` sube/baja el brillo del hueso (picos de esfuerzo). `barbell()`: barra con discos rojos. Va sobre el `xrayStage`: alterna visibilidad con el cuerpo x-ray (`SK.group.visible`, `BAR.visible`) |
| `core/look2d.js` | capa 2D sobre el 3D: `caption`, `label(texto, x, y, tx, ty, scale)`, `pill(texto, x, y, scale, color)`, `warning(x, y, s)`, `blackout(k)` |
| `src/shots.js` | el archivo por-video. `screen(vec3, cam)` da el punto 2D de un punto 3D (apunta etiquetas a órganos) |
| `src/main.js` | renderiza el frame 3D al canvas oculto `#gl`, lo copia a `#cv`, luego 2D + subtítulos |

## 4. Escenas del generador (params del plan)
`hablando` {texto?} · `respira` {prof, ritmo, etiqueta?} · `corazon` {latido, etiqueta?} · `cerebro` {pulso, etiqueta?} ·
`sangre` {co2, dark, etiqueta?} · `alarma` {etiqueta?} · `golpe` {periodo, fuerza, etiqueta?} · `dato` {numero, texto, ancla_x} ·
`apagon` {etiqueta?} · `final` {etiqueta?} ·
`esqueleto` {accion: quieto|camina|tiembla|cae, tropiezo?, impacto?, etiqueta?} — el esqueleto de cuerpo entero sobre el escenario x-ray;
`cae` = desfallece y se desploma hacia atrás con rebote + sacudida de cámara en el impacto ·
`pesas` {reps, fatiga: 0..1, etiqueta?} — el esqueleto hace press de barra (discos rojos): la barra sigue las manos de verdad
(se lee la posición de la mano tras posar), contador de reps, pico de brillo del hueso en cada repetición y temblor+rojo con la fatiga.

## 5. Una toma
```js
add({ id: 'S03', at: cut(2), note: 'rayos X del pecho, pulmones llenos', draw(lt, d, t, blit) {
  reset(); lungs(1);                                                     // posa todo como función pura del tiempo
  cam.position.copy(lerpV(V3(0.55, 1.5, 1.6), V3(0.3, 1.42, 1.1), eio(lt / d))); cam.lookAt(0, 1.33, 0);
  E.render(X.scene, cam, { ...XLOOK, focus: cam.position.distanceTo(V3(0, 1.33, 0)) }); blit();
  label('PULMONES: LLENOS', 760, 520, ...screen(V3(0.1, 1.42, 0.05), cam), eob(seg(lt, 0.2, 0.45)));
} });
```
Mantén las pills y etiquetas 2D fuera de los rostros (y 1150-1250 sobre el torso, o arriba en y 300 cuando la cabeza está
baja en el frame).

## 6. Velocidad de render
Los frames 3D son pesados sin tarjeta gráfica. En un ordenador normal con GPU renderiza a plena calidad. En una máquina
sin ella (o un sandbox en la nube) renderiza con `SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=24` (≈2 s por frame,
~30 min para un short de 37 s) y comprueba con `sheet ... 1` (un frame por segundo) antes del render completo.

## 7. Trampas de QA que ya sufrimos
- Una cámara dentro del cono de brillo de una luz lava el frame plano (los conos son mallas volumétricas): mantén las
  cámaras fuera de ellos.
- Respaldos de asiento / objetos entre cámara y sujeto: mantén la cámara en espacio despejado (centro de un pasillo).
- Overlays sobre rostros: revisa cada frame donde aparezca una pill o warning.
- El cuerpo de rayos X debe ser rayos X en todo menos la cabeza (`setBodyMaterial`).
