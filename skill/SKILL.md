---
name: faceless-shorts
description: Crea Shorts sin rostro para YouTube / TikTok / Reels totalmente en código en el ordenador del usuario, con voz IA local gratuita y subtítulos sincronizados palabra por palabra, $0. Seis estilos - Deep Dive 3D (explicadores 3D tipo Zack D. Films de "qué pasaría si..." sobre cuerpo/ciencia), Night File 3D (misterios sin resolver, crimen real), Inside Out (explicadores 2D planos de rayos X), Stick Story (monigotes "¿qué harías si...?" con pasos de supervivencia), Paper Atlas (historia en papel recortado con mapas), Tall Tale 3D (historias reales divertidas con gente de dibujo 2D plano en un mundo 3D soleado, subtítulos de una palabra). Úsalo cuando alguien quiera un short sin rostro, un explicador de "qué pasaría si", un video estilo Zack D. Films, un short de misterio o crimen real, una historia de monigotes, un short de historia, una historia real divertida o un short estilo storytime, o un video en alguno de estos estilos, incluso solo con un tema.
---

# Faceless Shorts

Creas un short vertical terminado a partir de un tema: guion, voz, subtítulos sincronizados palabra por palabra, tomas animadas,
sonido y música, renderizado a MP4. **Todo es código**: dibujo en canvas, captura con Chrome headless, ffmpeg, una voz Kokoro
local, timing de palabras con Whisper local, sonido con numpy. Sin imágenes ni video IA, sin claves de API, sin créditos.
`SKILL` = la carpeta donde está este archivo. Los proyectos viven en `~/faceless-shorts/<nombre-corto>/`.

| estilo | qué produce | duración · aspecto |
|---|---|---|
| **Deep Dive 3D** `deep-dive` | el buque insignia, tipo Zack D. Films: personas 3D esculpidas en sets soleados, cuerpos de rayos X brillantes, viajes de cámara por vasos sanguíneos, enfoque corto. "¿Qué pasaría si…?" cuerpo y ciencia | 30-45 s · 9:16 |
| **Night File 3D** `night-file` | misterios sin resolver / crimen real: lugares 3D oscuros con una sola luz, gente sin rostro (el sujeto brilla en rojo), fechas a máquina de escribir, inserts de expediente | 30-45 s · 9:16 |
| **Inside Out** `inside-out` | explicador 2D plano "¿Qué pasaría si…?": un héroe simple, cortes de rayos X, subtítulos de 1-3 palabras en negrita, cortes secos | 25-40 s · 9:16 |
| **Stick Story** `stick-story` | "¿Qué harías si…?" pasos de supervivencia: monigotes con ojos actorales, cuartos planos día/noche, tarjetas doradas de paso | 30-45 s · 9:16 |
| **Paper Atlas** `paper-atlas` | historia en papel recortado: mapas de pergamino, rutas carmesí, cintas doradas de fecha, figuras de época | 30-45 s · 9:16 |
| **Tall Tale 3D** `tall-tale` | historias reales divertidas: gente de dibujo 2D plano (cabezas grandes redondas, contornos de tinta) actuando en un mundo 3D de pueblo pequeño y soleado, cámara siempre en movimiento, subtítulos de una palabra | 40-60 s · 9:16 |

Qué estilo: cuerpo / salud / ciencia "¿qué pasaría si?" → **Deep Dive 3D** (o **Inside Out** para un look 2D más ligero y
rápido) · siniestro, inexplicado, crimen real, "esto pasó en 1971" → **Night File 3D** · supervivencia, trucos de vida,
"esto es lo que haces" → **Stick Story** · un evento histórico, "cómo pasó X" → **Paper Atlas** · una historia real divertida
o astuta, una estafa, un resquicio, "este tío hizo X" → **Tall Tale 3D**. Si no es obvio, pregunta una vez.

Cada estilo = `styles/<estilo>/style-sheet.png` (el look en una imagen, dibujada por el propio código del estilo) + `STYLE.md`
(las reglas + el manual del motor) + `example/` (un proyecto completo que renderiza tal cual). **Lee el STYLE.md del estilo
completo antes de planificar.**

## 0. Primer uso en un ordenador
`bash SKILL/scripts/setup.sh` hasta que imprima **All set** (comprueba Node 22+, ffmpeg, Chrome; construye `~/.faceless-shorts/venv`;
descarga la voz Kokoro ~340 MB y Whisper small.en ~0,5 GB). Instala lo que falte de la forma libre y oficial, y pregunta antes
de cualquier cosa que necesite contraseña. Luego `bash SKILL/scripts/selftest.sh` debe imprimir **SELFTEST PASSED**: abre la
hoja de contactos y los clips, míralos y fíjate en los nombres.

## 1. Recogida (UN mensaje, con los valores por defecto ya puestos)
Pregunta solo lo desconocido, todo a la vez: tema (o "elige tú 3 ideas"), enlace a un short cuyo formato le guste (opcional),
duración (por defecto ~30 s), voz (`SKILL/scripts/py SKILL/scripts/voice.py --list`; por defecto `am_michael`), modo de
locución: **voz IA** (por defecto) · **su propia grabación** (graba después de ver el guion; `words.py --audio`) ·
**solo subtítulos** (todavía sin voz; `estimate.py`), música (cama integrada · ninguna · su propio archivo libre de
royalties), línea final / handle. "Dale" = los valores por defecto.

## 2. El plan (UNA pantalla, luego espera)
Muestra: título · la narración completa, una línea por corte, con sus trozos de subtítulo (`WHAT IF *YOU | SWALLOW *GUM?`) ·
la lista de tomas, una línea cada una (qué vemos, qué se mueve, sobre qué palabra cae) · los componentes nuevos que añadirás
al kit, si hay · los hechos y sus fuentes. Pregunta **"¿Lo construyo?"** y espera.

**Reglas del guion.** Escríbelo como habla una persona con un amigo: frases completas y fluidas con palabras de conexión
("Pues", "donde", "pero", "así que", "lo que significa"), no una lista de frases cortas tipo subtítulo. ~90-110 palabras
para 35 s. **Una línea es un CORTE, no una frase**: parte cada frase en 1-3 líneas en las pausas naturales (comas, "y",
"donde"), para que la imagen cambie cada 1,5-3,5 s mientras la voz sigue fluyendo (voice.py dice cada frase entera de una vez).
Forma: pregunta gancho, luego escalada, un mito o sorpresa, un giro ("pero si tú…"), una última línea seca que engancha en bucle.
Escribe los números como se dicen ("siete"). Léelo en voz alta en tu cabeza: si suena a subtítulos, reescríbelo.
Solo escritura original: coge un formato que te guste, nunca el guion o las tomas de otro creador. Cada hecho se comprueba
contra una fuente fiable (listalas en "sources" de `script.json`). Temas de salud: precisos, sin gore, sin desinformación que asuste.

## 3. Construir
1. `bash SKILL/scripts/new_video.sh <estilo> <nombre-corto>` copia el example a `~/faceless-shorts/<nombre-corto>/`.
2. Escribe `script.json` (líneas + caps + gaps; ver STYLE.md).
3. Timing: `SKILL/scripts/py SKILL/scripts/voice.py <proy>` y luego `SKILL/scripts/py SKILL/scripts/words.py <proy>`
   (grabación propia: `words.py <proy> --audio su.m4a`; solo subtítulos: `estimate.py <proy>`).
4. Reescribe `src/shots.js`: una toma por línea (o dos para líneas largas), cada una colocada con `cut(i)` y sus momentos
   clave sobre palabras con `Wd('palabra', linea)`. Reutiliza el kit (`src/core/kit.js`); añade ahí los componentes nuevos,
   en el look del estilo.
5. En el proyecto: `node tools/capture.mjs check` (debe decir CHECK OK) → `node tools/capture.mjs cues` →
   `SKILL/scripts/py tools/mix.py .` → QA (sección 4) → `node tools/capture.mjs video renders/<nombre>.mp4`.
   Iterar una toma: `node tools/capture.mjs frames review/f "4.2,4.6"` y mirar.

## 4. QA: nunca muestres un frame que no hayas mirado
`node tools/capture.mjs sheet review/all.jpg 0.5 10` (un frame cada 0,5 s, con marca de tiempo) y lee la hoja entera, luego
los frames clave a tamaño completo. Para cada frame pregúntate:
- **¿Tiene sentido?** Un modo visual por toma: si el cuerpo está en rayos X, TODO está en rayos X (sin mangas de camisa sobre
  un cuerpo de rayos X). Los objetos se mueven con lo que los sostiene (el chicle sigue en la mano hasta que la mano llega a
  la boca). Nada aparece antes de su causa.
- **¿Casa con la narración en ese momento?** La imagen cambia justo antes de su línea; las revelaciones caen sobre su palabra.
- **¿Algo se choca?** Lo que se mueve nunca cruza etiquetas, pills, la zona de subtítulos (y 1250-1550) o entre sí por accidente.
- **Subtítulos:** 1-3 palabras, exactamente una en amarillo, bien escritas, sobre la palabra que se dice, legibles en un móvil.
- **Hoja de estilo:** solo la paleta, formas planas, rayos X en cian, peligro en rojo.
- **Sonido:** la voz clara sobre la música; efectos suaves (sin ticks ni beeps duros).
Corrige, re-renderiza la hoja, vuelve a comprobar. Cuenta al usuario qué cazaste y arreglaste.

## 5. Entregar
Abre el MP4 para el usuario. Da también: una copia para compartir si pesa > 35 MB (`ffmpeg -i in.mp4 -c:v libx264 -crf 21
-preset slow -c:a aac -b:a 160k -movflags +faststart share.mp4`), el mejor frame de portada (`capture.mjs frames`), un título,
una descripción y 5-8 hashtags. En modo grabación propia, da también el guion con el timing de cada línea para leerlo.
Ofrece una ronda de cambios precisos y re-renderiza solo lo que cambió.

## Añadir un estilo nuevo (cuando el usuario lo pide)
Crea `styles/<estilo-nuevo>/` con `style-sheet.png`, `STYLE.md` (mismas secciones que Inside Out: reglas de look, paleta,
formato, mapa del motor/kit, componentes, anatomía de toma, tipos de cue, trampas de QA) y un `example/` completo. Copia de
Inside Out `tools/`, `index.html`, `src/main.js`, `src/core/{lib,timing,captions}.js` y construye el kit y las tomas del look
nuevo. Los scripts compartidos (voice, words, estimate, new_video, selftest) funcionan sin cambios. Añade una fila a la tabla
de arriba y corre `selftest.sh` hasta que cada estilo pase.

## Estilos 3D (Deep Dive, Night File, Tall Tale)
Renderizan 3D real con three.js en Chrome headless. Con tarjeta gráfica va rápido y a plena calidad. Sin una (portátil sin
aceleración GPU, sandbox en la nube) renderiza con `SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=24` delante de
`node tools/capture.mjs ...` (≈2 s por frame; avisa del tiempo de render por adelantado, correlo en background y haz el QA
primero con `sheet review/all.jpg 1 10`). Sus STYLE.md listan la API 3D.

## Nunca
Generar imágenes o video con IA; gastar el dinero o créditos del usuario; copiar guion, tomas o frames de otro creador;
sobrescribir el proyecto de un usuario sin preguntar; entregar un frame que no hayas mirado.
