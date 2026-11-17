# Caricatura 3D: historias épicas con personajes planos en un mundo 3D, 9:16

Personajes de caricatura dibujados a mano (cabezas de frijol, extremidades de palito, contorno
ciruela) pegados como tarjetas a un mundo 3D soleado: cielo pintado, colinas, nubes, hierba y
multitudes instanciadas de cientos de soldados. Energía de caricatura histórica: ejércitos,
reyes arengando, duelos de huestes, cargas con lanzas al alto, caídas de héroe. Port del estilo
"shorts animados 3D" (MIT): `caricatura/example/` = **LA CARGA DE GAUGAMELA** (37 s, 9 tomas).

## 1. El look (reglas)
- **Los personajes son planos y el mundo es 3D.** Cada personaje es una tarjeta dibujada en canvas
  (luz pintada a mano, sombras crecientes) pegada de frente a cámara; el suelo, las colinas y los
  árboles son 3D de colores planos facetados con niebla.
- **Sol siempre desde la izquierda-arriba de cámara** (la luz pintada de las tarjetas coincide con
  la key light del mundo; no la cambies).
- **Dos horas:** `dia` (cielo azul, hierba verde) y `oro` (cielo humo-naranja de batalla, suelo
  quemado). La tensión dramática usa `oro` (duelo, carga, final).
- **La cámara nunca se detiene:** push-in lento en los holds, glides simétricos con easing suave.
  Planos de ejército con fov 52 (camA), primeros planos con fov 30 (cam).
- **Sin sangre ni gore:** las caídas terminan en polvo y sacudida de cámara; el peligro se cuenta
  con pills rojas y carteles `warning`.
- Subtítulos: 1-3 palabras blancas con contorno, una en amarillo (motor automático). Datos como
  `pill` grande, etiquetas como pills de color según emoción (amarillo dato, rojo peligro).

## 2. Formato
- 1080x1920, 24 fps, 30-45 s. Narración `em_alex` (o `ef_dora`), conversacional.
- Una línea = una toma (corte justo antes de la línea: `cut(i)`).
- Música: `"tension"` (dron + pulso) para batallas y peligro, `"bed"` para historias ligeras.

## 3. Mapa del motor (`example/src/`)
| archivo | te da |
|---|---|
| `core/engine.js` | `makeEngine(canvas)` → `E.render(escena, cam, look)`: ACES, sombras suaves, DoF, bloom, viñeta + grano. `camera(fov)`, `lightRig(escena, {...})` |
| `core/toon.js` | el elenco plano: `bodyFront(pen, outfit, opts)` y `bodySide(...)` (modos march/stroll/stand/sit/fall, raise 0..1, wave, expr, blink), `SOLDADO/PUEBLANO/REY/OFFICER/KID`, `fxContact/fxShadow`. Pen dibuja en unidades de diseño 600x1000 |
| `core/mundo.js` | `mundo(E)` → `{ scene, luz, setHora('dia'|'oro'), loma }`: cielo pintado, hierba, colinas, árboles, nubes. `makeCrowd(escena, { n, raise, outfitFn })` → multitud instanciada billboard (`formar`, `actualizar`, `tinte`, `niebla`). `TarjetaViva(k)` → tarjeta redibujable por frame (`.draw(outfit, opts)`, `.drawSide`, `.mesh`, `.mat`). `sombra()`, `polvo()` |
| `core/look2d.js` | capa 2D: `pill(texto, x, y, sc, color)`, `warning(x, y, s)`, `blackout(k)` |
| `src/main.js` | render 3D → copia al canvas 2D → overlays → subtítulos |

## 4. Escenas del generador (params del plan)
`hablando` {objeto: rey|capitan|soldado|aldeano|nino, texto?, ancla_texto?, etiqueta?} — el personaje de frente a cámara hablando (boca + parpadeo animados), push-in lento ·
`ejercito` {filas?, etiqueta?} — la formación marchando en el sitio, la cámara recorre las filas ·
`rey` {objeto?, etiqueta?} — el rey sobre la loma arenga a su guardia, cámara en arco ·
`duelo` {etiqueta?} — dos ejércitos frente a frente, la cámara sube y aleja revelando la brecha (hora oro) ·
`carga` {etiqueta?} — la horda con lanzas al alto corre hacia la cámara, que retrocede y tiembla (hora oro) ·
`personaje` {accion: camina|saluda|arenga|quieto, objeto?, etiqueta?} — un héroe solo cruzando la pantalla (vista de lado), saludando, con la lanza al alto o quieto ·
`caida` {objeto?, tropiezo?, impacto?, etiqueta?} — el héroe titubea y se desploma de lado: polvo, sacudida y golpe de sonido en el impacto ·
`dato` {numero, texto, ancla_x} — plano medio del héroe + número grande ·
`final` {etiqueta?} — plano ancho dorado del ejército + `warning` (hora oro).

## 5. Trampas de QA que ya sufrimos
- Las anclas DEBEN existir en su línea (el validador del guionista y timing.js lo chequean; sin
  tilde: el normalizador borra la letra acentuada, así que escribe el ancla tal cual suena).
- Pills de datos arriba (y 200-330) o en el pecho (y 900); nunca sobre el rostro.
- La multitud billboard mira a cámara por shader: las formaciones siempre delante de la cámara
  (z negativo detrás del héroe, o z positivo acercándose en `carga`).
- El fov 30 solo sirve para 1-2 personajes; los planos de ejército usan camA (fov 52) a 9-14 m.
- `carga` y `duelo`/`final` cambian a hora `oro`: no mezcles con `dia` en la misma toma.
