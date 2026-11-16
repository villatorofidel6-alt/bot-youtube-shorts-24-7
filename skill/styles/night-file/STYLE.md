# Night File 3D: misterios sin resolver y crimen real, 9:16

Silencioso, inquietante, investigativo. Lugares 3D oscuros con UNA fuente de luz, gente sin rostro: los testigos son
negro casi puro con una luz de borde roja fina, la persona de la historia brilla en rojo sólido. Fechas y subtítulos a
máquina de escribir, inserts de evidencia (expedientes, tickets, polaroids, círculos rojos), grano de película, cámara lenta.
Ejemplo: `example/` = **THE MAN WHO JUMPED OUT OF A PLANE** (D.B. Cooper, 1971; 36 s, 11 tomas). Hoja: `style-sheet.png`.

## 1. Reglas
- Una luz por escena; todo lo demás cae en la oscuridad. Las lámparas vienen con un cono de luz visible suave.
- **El rojo significa el sujeto.** Nada más en pantalla es rojo excepto las marcas de evidencia (círculo rojo, sello
  UNSOLVED, hilo).
- Sin rostros, sin gore, sin armas a la vista (menciónalas en palabras solo si el expediente lo necesita). Casos reales:
  hechos comprobados contra fuentes primarias (FBI, registros judiciales, medios grandes) y listados en "sources" de
  `script.json`; trata a víctimas y familias con respeto; nunca acuses a una persona viva real.
- Lento: tomas de 3-5 s, empujes y derivas. Las pausas entre frases son más largas (`gap` 0,4).
- Subtítulos: FreeMono a máquina de escribir, sentence case, 2-5 palabras, crema con una palabra en rojo, mecanografiados
  letra a letra (y 1560).
- Las fechas se teclean arriba a la izquierda: `K.dateStamp('NOV 24, 1971', 'VUELO 305 · PORTLAND', p, 80, 300)`.
- Narración: baja y calmada, `am_onyx` x0.95. Música `"tension"`.

## 2. Mapa del motor (`example/src/`)
El núcleo 3D (`engine.js`, `sdf.js`, `human.js`) se comparte con Deep Dive 3D (ver su STYLE.md). Night File añade:
| archivo | te da |
|---|---|
| `core/sets3d.js` | `corridor()`, `houseNight()`, `caseWall(photoCanvases)`, `planeCabin()` (`.update(t, { door, rain, flash })`); `witnessMat()`, `subjectMat()`, `lightCone()` |
| `core/kit.js` | inserts 2D de evidencia: `caseFile(x, y, s, etiqueta, stamp)`, `polaroid(x, y, s, rot, 'glow'│'dark'│'house')`, `clock`, `cassette`, `marker`, `redacted`, `redCircle(x, y, rx, ry, p)`, `dateStamp`, `captionMono`, `filmLook` |
Personas: `new Human({ face: false })` y luego `.setAllMaterial(SETS.subjectMat())` o `witnessMat()`. Sentado: caderas y 0,66,
`hipL/hipR [88, 0, 2]`, `knL/knR 88`.

## 3. Forma de la historia
Fecha + lugar → la persona (sujeto brillando) → el evento extraño, paso a paso, cada paso un insert de evidencia o una toma
3D lenta → el momento en que todo sale mal (un sonido duro) → lo que se encontró después (muro del caso, fecha) → la pregunta
abierta, sello UNSOLVED. Termina en silencio y el dron.

## 4. Trampas de QA que ya sufrimos
- Cámara dentro de un cono de luz = frame plano marrón. Asientos o paredes entre cámara y sujeto = vista bloqueada.
- Un encuadre demasiado cerrado sobre un marco de puerta oscuro se lee como frame vacío: usa una lente más ancha
  (`fov: 58`) para espacios oscuros.
- Velocidad de render: ver sección 5 del STYLE.md de Deep Dive.
