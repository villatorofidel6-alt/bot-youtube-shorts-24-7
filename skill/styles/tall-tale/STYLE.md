# Tall Tale 3D: historias reales divertidas, 9:16

Juguetón, astuto, un poco pillo. Gente de dibujo 2D plano (contornos de tinta gruesos, cabezas blancas grandes y redondas,
cuerpos de haba, extremidades de palo) actuando dentro de un mundo 3D soleado y saturado: calles de pueblo pequeño,
tiendas con papel pintado, prados, trenes. La cámara se mueve en cada toma, los rostros reaccionan en cada golpe, los
subtítulos van palabra a palabra.
Ejemplo: `example/` = **THE GIRL WHO WAS MAILED TO GRANDMA** (1914; 52 s, 21 tomas). Hoja: `style-sheet.png`.

## 1. Reglas
- **La gente es 2D, el mundo es 3D.** Cada persona es un recorte `Toon` que gira de frente a la cámara y proyecta una
  sombra real. Nunca construyas personas en 3D; nunca dibujes sets planos.
- **Los rostros hacen la actuación.** Cambia el ánimo al golpe: `smug` cuando alguien es astuto, `shock` en la revelación,
  `laugh` / `happy` en el pago, `worried` + `sweat` para el problema. Parpadea con `blink(t)`, habla con `talk(t)`.
- Un sombrero + algo en el cuello por personaje; mismo look todo el video. Niños: `kid: true` (piernas cortas) y
  `height: 1.4`.
- Cámara siempre en movimiento: empujes, paneos, grúas bajando, un punch-in en la palabra de la revelación. Nueva toma
  cada 1,5-3 s.
- Sol de mediodía brillante fuera, bombillas cálidas dentro, atardecer rosado para finales o flashbacks.
- Subtítulos: una palabra a la vez (las palabras cortas se emparejan: "un solo"), Inter Black blanco con borde negro y
  sombra suave, centro de pantalla (y 1340). Sin palabra destacada en color. Las palabras conservan su puntuación.
- Forma de la historia: abre con el dato más sorprendente ("mandaron a su hija por correo"), luego "Mira, ..." rebobina y
  explica el truco paso a paso, una imagen por cláusula, golpes de reacción cortos, termina en un chiste que voltea el inicio.
- Narración: narrador animado, `am_michael` x1.05. Música `"bounce"` (comedia ligera). Muchos sonidos pequeños: `pop`,
  `plop`, `boing`, `stamp`, `ding`, `chirp`, `chug`, `whoosh` en cortes.
- Solo historias reales, comprobadas contra buenas fuentes (museos, enciclopedias, medios grandes) y listadas en "sources"
  de `script.json`. Si las fuentes discrepan en un número, usa el que den la mayoría y mantén la redacción simple.

## 2. Mapa del motor (`example/src/`)
| archivo | te da |
|---|---|
| `core/engine.js` | `makeEngine` (curva de tono neutra, sombras suaves, bloom, profundidad de campo, grade de saturación), `camera(fov)` |
| `core/toon.js` | `drawToon(g, look, st)` (dibujo 2D), `new Toon(look, { height, res })` (recorte 3D: `.at(x,y,z)`, `.set(st)`, `.face(cam)`, `.tint(col)`, `.restyle(patch)`), `PROPS` para sostener en manos |
| `core/world.js` | sets: `mainStreet(E, { shops, dusk })` (devuelve `buildings` con la posición de cada tienda), `interior(E, { wall, motif, floor, ceiling, view, signText, counterOn })`, `meadow(E, { sunset, fenceOn })`; piezas: `sky, clouds, sunlight, hills, tree, pole, wire, lamp, barrel, crate, car, fence, bunting, signBoard, facade, extras`; texturas pintadas `T.planks/wallpaper/brick/siding/dirt/grass/felt`; `snapshot(E, scene, cam)` renderiza un set a una textura (vistas de ventanas) |
| `core/props.js` | `house()` (`.door` se abre), `signpost`, `platformScale()` (`.set(lbs)`), `train()` (`.update(t)`), `rails`, `cubbies`, `mailSack`, `parcel`, `desk`, `poster(lines)`, `chickCrate()` |
| `core/captions.js` | subtítulos de una palabra, `captionText(texto, x, y)` |

**Look Toon**: `{ body, pattern: plain│check│stripes│overalls│vest│apron│stamps, patCol, hat: none│cap│bowler│boater│beanie│visor│tophat│bun│flower│bow│mailcap, hatCol, band, neck: none│bowtie│tie│scarf│collar, neckCol, dots, extra: [mustache, glasses, freckles, blush, pencil, monocle], kid, stamps }`.
**Estado Toon**: `{ mood: neutral│smug│happy│laugh│shock│worried│angry│sad│sly│proud│tired│dizzy, look: [dx, dy], blink, talk,
sweat, tears, armL / armR: [hombro°, codo°] (0 = abajo, 150 = arriba), legs: stand│walk│run│sit│jump, phase, lean, bob,
holdL / holdR: PROPS.x, flip }`. Un objeto creado con argumentos (`PROPS.book('REGLAS', 1)`) necesita un `v: 'algo'` en el
estado que cambie cuando el objeto cambia, para que el recorte se redibuje.
Posiciones: la gente está de pie en y 0 (paseos marítimos y 0,18, sobre un mostrador y 1,26). Mostrador interior: x 2,2..3,2,
dependiente en x 3,55.

## 3. Anatomía de una toma (ver `example/src/shots.js`)
Construye cada set una vez arriba, dale a cada set sus propios recortes, luego por toma: coloca gente, ponles `set()` con
su estado según `t`, `shoot(scene, people, camDe, camA, lookDe, lookA, k, LOOK)` (mueve la cámara, gira a todos de frente a
ella, renderiza con profundidad de campo), `blit()`, y cualquier overlay 2D (un sello DEVOLVER AL REMITENTE). Los cues van
sobre la palabra (`cue(Wd('prohibido', 17), 'stamp')`).

## 4. Trampas de QA
- Un recorte visto de lado se vuelve una astilla: mantén la cámara a ~60° o menos de frente a la gente (`.face(cam)` se
  encarga del resto).
- Gente dentro de los muebles: revisa alturas de pies (paseo 0,18, tope de mostrador 1,18 + escala 0,08).
- Las sombras solo caen dentro de la caja de sombra del sol: mueve `sun.key.target` cerca de la acción cuando construyas
  un set nuevo.
- Velocidad de render: igual que Deep Dive (`SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=24` sin GPU, ≈2-3 s/frame).
