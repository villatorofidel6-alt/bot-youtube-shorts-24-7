# Inside Out: shorts 2D planos "¿Qué pasaría si…?", 9:16

Curioso, ligeramente impactante, satisfactorio. Un héroe plano simple, cortes de rayos X al interior del cuerpo, órganos y
objetos como formas vectoriales limpias, subtítulos de 1-3 palabras en negrita con una palabra en amarillo, y un corte cada
1-3 segundos con la cámara siempre en movimiento. Ejemplo para estudiar y copiar: `example/` = **WHAT IF YOU SWALLOW GUM?**
(30 s, 11 tomas). Hoja de estilo: `style-sheet.png`.

## 1. El look (reglas de la hoja: no romperlas)
- **Solo formas planas.** Sin degradados, texturas ni iluminación realista. La profundidad viene de tonos planos más
  oscuros/claros del mismo color (sombra de la camiseta, brillo del órgano), nunca de desenfoque o glow.
- **Paleta:** piel `#E8B89A` · rosa órgano `#E57A8A` · rojo peligro `#D62839` · cian rayos X `#4FD1E8` · amarillo
  destacado `#FFD43B` · fondo `#F4F1EA`, más la tinta `#1A1A1E` y los tonos derivados en `C` de `lib.js`.
- **El cian de rayos X es solo para vistas del interior del cuerpo** (esqueleto, fondo de radiografía, brillo del intestino).
  **El rojo marca peligro o el problema** (X, aviso, anillo de bloqueo, aguja del cronómetro). **El amarillo es la única
  palabra clave por subtítulo**, además de las explosiones de impacto y el ácido.
- **Un modo visual por toma.** Rayos X significa que el cuerpo entero está en rayos X (brazos, cuello, piernas); solo la
  cabeza queda normal.
- Los personajes son mínimos y amables: cabeza redonda, ojos de punto con brillo, camiseta y pantalón simples, cejas y boca
  expresivas. Reaccionan al golpe (tragar, shock, sonrisita, dedo acusador) y pueden mirar a cámara en el giro final.
- Tono: curioso, ligeramente impactante, satisfactorio. Ciencia precisa, sin gore, sin heridas en pantalla.

## 2. Formato
- **1080x1920, 30 fps, 25-45 s.** Silencio inicial 0,45 s, outro 0,9 s (van en `script.json`).
- **Forma de la historia:** pregunta gancho (héroe + la cosa) → rayos X: a dónde va → primer plano de lo que pasa → el dato
  clave → mito derribado (X roja) → lo que pasa de verdad → pasa el tiempo → **giro: "pero si tú…"** (peligro, rojo) →
  la última línea seca del héroe a cámara (engancha de vuelta con el gancho).
- **Una línea = una toma = un corte**, y una frase suele abarcar 2-3 líneas (`"Baja por tu garganta y aterriza en el
  estómago,"` / `"donde el ácido fuerte se pone a trabajar."`). La voz dice cada frase de una pasada, suena natural, y los
  cortes caen en las pausas internas. Las tomas duran 1,5-3,5 s; parte una línea que corra más tiempo. Cada corte lleva
  punch-in + destello blanco breve + whoosh (automático en `main.js`; el cue whoosh lo añades tú).
- **Narración:** conversacional, como explicándole a un amigo: frases fluidas con palabras de conexión, nunca una lista de
  fragmentos tipo subtítulo. Kokoro `am_michael` x1.0 (o `am_puck` para juguetón, `af_heart` para voz femenina cálida). Tranquilo,
  curioso, matter-of-fact. Números dichos como se dicen.

## 3. Subtítulos
Línea de `script.json`: `{ "text": "¿Atrapado siete años? Mito total.", "caps": "¿ATRAPADO 7 *AÑOS? | MITO *TOTAL" }`
- `|` parte la línea en trozos de subtítulo; `*` marca la ÚNICA palabra amarilla de cada trozo. 1-3 palabras por trozo.
- Un trozo aparece cuando se dice su primera palabra (match por grafía, si no por número de palabras), entra con pop
  (0,2 s de overshoot) y se queda hasta el siguiente. Inter Black 150 px, blanco, contorno tinta 30 px + sombra, centrado
  en y 1400 (`CAP` en captions.js).
- Los caps pueden diferir de lo hablado ("7" por "siete") pero deben empezar con la misma palabra que el trozo hablado.
- Sin `caps`, las líneas se trocean solas (2-3 palabras, la palabra más larga en amarillo): vale para borradores, escribe
  caps para el final.

## 4. Mapa del motor (`example/`)
| archivo | te da |
|---|---|
| `script.json` | título, voz, velocidad, lead, outro, gap, música (`bed`·`none`·`audio/x.mp3`), sources, líneas `{text, caps, gap}` |
| `src/shots.js` | **el archivo por-video**: la lista de tomas + cues de sonido |
| `src/core/kit.js` | el zoológico de componentes (abajo) |
| `src/core/lib.js` | `W H FPS`, paleta `C`, `clamp lerp seg eo eio eob rnd`, `rr circle ell line fillAll bigText` |
| `src/core/timing.js` | `L(i)` inicio de línea, `Le(i)` fin de línea, `Wd(palabra, linea)` inicio de palabra (match por prefijo, lanza si falta), `T.dur` |
| `src/core/captions.js` | troceado de subtítulos + dibujo (`CAP` = posición/tamaño) |
| `src/main.js` | boot, cámara (punch-in + empuje lento), destello de corte, fades, `window.OP` para captura |
| `tools/capture.mjs` | `check` · `cues` · `sheet` · `frames` · `video [inicio fin] [--draft]` · `preview` |
| `tools/mix.py` | voz + cama de música (atenuada) + efectos procedurales → `data/mix.wav` |
| `data/` | `lines.json`, `words.json` (timing), `narration.wav`, `cues.json`, `mix.wav` |

## 5. El zoológico de componentes (`kit.js`, `import * as K`)
**Héroe** `K.man({ x, y, s, arm, armL, finger, eyes, mouth, chew, brow, smirk, frown, look, xray, pulse, holding, inside })`
- origen = centro del pecho; con `s: 1` mide ~1100 px (tope de cabeza ≈ -480, pies ≈ +620). Primer plano: `s: 1.6-2.0`, y 1150-1300.
- `arm`: `K.ARM.down | mouth | point | wave | hip`, mezcla con `K.armPose(a, b, t)`. `finger`: ángulo (rad) que muestra un
  índice levantado (señala con `Math.sin(lt * 11) * 0.35`).
- `eyes`: `'n' | 'wide' | 'closed'` · `mouth`: `'smile' | 'smirk' | 'chew' | 'o' | 'flat' | 'grin'` · `brow` 0..1 alza.
- `xray: true` convierte todo el cuerpo en rayos X (esqueleto, estómago), la cabeza queda normal. `pulse` 0..1 hincha el estómago.
- `holding: (x, y) => K.gum(x, y, 0.55)` dibuja un objeto EN LA MANO (sigue al brazo). `inside: [x, y, rot]` = un chicle
  dentro del cuerpo en coordenadas locales; `K.foodAt(u)` recorre boca → garganta → estómago (u 0..1).
**Órganos y objetos** `K.gum(x, y, s, rot, sx, sy)` · `K.stomach(x, y, s, pulse)` + `K.stomachTop(x, y, s)` · `K.heart(x, y, s, beat)`
· `K.stopwatch(x, y, s, angle)` · `K.calendar(x, y, s, '7', 'AÑOS', rot)` · `K.makeGut()` → `{ draw(), at(u) }` intestino
serpenteante · `K.gutTube(y, t)` primer plano de intestino recto.
**Gráficos** `K.pill(texto, x, y, size, bg, fg, scale)` · `K.tag(texto, x, y, targetX, targetY, size, scale)` · `K.redX(x, y, s, alpha)`
· `K.arrow(x, y, len, angle, alpha)` · `K.warning(x, y, s)` · `K.chomper(x, y, r, open, flip)` (enzimas) · `K.burst(x, y, s, a)`
· `K.speedLines(x, y, a)` · `K.shockLines(x, y, r, a)` · `bigText(texto, x, y, size, fill, rot, scale)` (ej. "¡GULP!").
**Fondos** `K.room()` (A, mundo real) · `K.xray(t)` (B, placa de rayos X + línea de escaneo) · `K.insideStomach(t, acid)` (C, macro).
Tema nuevo = componentes nuevos: añádelos a kit.js en el mismo look (rellenos planos, un tono más oscuro, un brillo claro,
contornos de tinta solo en gráficos), documentalos aquí y compruébalos a tamaño completo.

## 6. Una toma
```js
const st = cut(5), slam = Wd('mito', 5) - st - 0.05;          // corte justo antes de la línea 5; la X cae sobre "mito"
add({ id: 'S06', at: st, cam: [540, 800], zoom: 0.06, note: 'calendario cae, X roja sobre "mito"',
  draw(lt, d, t) {                                              // función pura del tiempo: sin estado entre frames
    ctx.fillStyle = C.bg; ctx.fillRect(-300, -300, W + 600, H + 600);   // rellena más allá de los bordes (la cámara zooma)
    K.calendar(540, lerp(-400, 780, eob(seg(lt, 0, 0.45))), 1, '7', 'AÑOS');
    if (lt > slam) K.redX(540, 780, lerp(1.9, 1, eo(seg(lt, slam, slam + 0.2))), 1);
  } });
cue(st, 'whoosh'); cue(st + 0.4, 'thud'); cue(st + slam + 0.1, 'slam');
```
`cam` = el punto hacia el que la cámara empuja; `zoom` = cuánto empuja en la toma (0,06 por defecto, 0,3 = fuerte).
Mantén al héroe y los objetos clave entre y 250 y 1250 para que el subtítulo (y 1250-1550) nunca los tape.

**Cues de sonido** `cue(t, tipo, { gain, dur })`: `whoosh` (cada corte) · `slide` (dur, algo que viaja) · `pop` (aparece una
etiqueta) · `plop` (cae en líquido) · `gulp` · `boing` (rebote, golpe cómico) · `bubbles` (dur) · `sizzle` (dur, ácido) ·
`sparkle` (dur, disolviéndose / magia) · `thud` (algo aterriza) · `slam` (la X grande / impacto) · `tock` (paso del tiempo,
suave) · `zip` (salida rápida) · `alarm` (dur, pulso de peligro bajo). Todos suaves y redondeados por diseño.

## 7. Trampas de QA que ya sufrimos (comprueba esto primero)
- Un cuerpo de rayos X con mangas de camiseta o brazos de piel normales → `xray: true` se encarga del cuerpo entero; nunca
  rayos X solo en parte.
- Un objeto flotando donde va a estar, antes de que la mano llegue → usa `holding`, que sigue a la mano.
- Un objeto en movimiento cruzando una etiqueta o contador (el chicle zumbando por "DÍA 3") → dale carriles propios a lo
  que se mueve.
- Un subtítulo que cae una palabra antes → pon los límites de trozos de `caps` en palabras realmente dichas; revisa la
  salida de `capture.mjs check`.
- Cosas ocultas bajo el subtítulo → mantén la acción clave por encima de y 1250.
