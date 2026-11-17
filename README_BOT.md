# 🤖 Bot Autónomo de YouTube Shorts 24/7 (GitHub Actions)

Produce y publica Shorts verticales 9:16 **sin intervención humana**, corriendo gratis en **GitHub Actions** — el PC puede estar apagado. 7 estilos en español rotan en turnos igualitarios: los videos se generan, se guardan en una cola (release de GitHub) y se suben a YouTube **1 cada 2 horas**, con latido y alertas en vivo en Discord.

## 🎬 Los 7 estilos

| Estilo | Qué produce | Turno |
|---|---|---|
| **Deep Dive 3D** `deep-dive` | "¿Qué pasaría si…?" de cuerpo y ciencia, 3D tipo Zack D. Films | round-robin |
| **Inside Out** `inside-out` | explicador 2D plano de rayos X | round-robin |
| **Night File 3D** `night-file` | expedientes de misterio sin resolver, crimen real | round-robin |
| **Paper Atlas** `paper-atlas` | historia en papel recortado con mapas | round-robin |
| **Stick Story** `stick-story` | "¿qué harías si…?" con monigotes | round-robin |
| **Tall Tale 3D** `tall-tale` | historias reales divertidas en 3D | round-robin |
| **Caricatura 3D** `caricatura` | historias épicas reales con personajes de caricatura en un mundo 3D | round-robin |

**Producción:** cron cada 6 h → 4 videos por ciclo, rotando los 7 estilos en orden (`ORDEN` en `bot/producir.py`; el job `prio` hace los 2 primeros y `otros` los 2 siguientes) ≈ **16/día generados**. **Consumo:** 1 subida cada 2 h = **12/día** (todos los estilos pesan igual; sale primero el que menos lleva). La cola se poda a 36 para no crecer sin límite.

## 📁 Estructura del repo

| Carpeta/Archivo | Descripción |
|---|---|
| `bot/` | Código del bot (Python): producir, publicar, latido, YouTube, Discord, estado |
| `guionista/` | Generador de guiones + `pools/` con las tarjetas de cada estilo |
| `skill/` | Motor de render de los 6 estilos (canvas + Chrome + ffmpeg + voz Kokoro) |
| `.github/workflows/` | `producir.yml` · `publicar.yml` · `latido.yml` |
| `estado_bot.json` | Estado persistente (auto): contadores, cola, dedupe de subidos |

## 🔁 Los 3 workflows

| Workflow | Cron | Qué hace |
|---|---|---|
| `producir.yml` | `0 */6 * * *` | Elige los 4 estilos del turno → guionista → render Chrome → `video.mp4` + `video.meta.json` a la release `cola` |
| `publicar.yml` | `15 */2 * * *` | Toma el video más antiguo de la cola, sube a YouTube, borra los assets de la cola |
| `latido.yml` | `*/5 * * * *` | Latido a Discord cada 5 min + alertas en tiempo real (inicio/fin de ciclo, video generado, subida con link, errores críticos) |

## 🔑 Secrets de GitHub (se ponen una vez)

| Secret | Qué es |
|---|---|
| `CLIENT_SECRET_B64` | `client_secret.json` de Google Cloud en base64 |
| `TOKEN_PICKLE_B64` | `token.pickle` con el token de refresco de YouTube, en base64 |
| `DISCORD_WEBHOOK_URL` | URL del webhook del canal de Discord |
| `GH_TOKEN` | token del repo para leer/borrar la cola de la release |

## 🚀 Puesta en marcha (primera vez)

1. Añade los secrets arriba en **Settings → Secrets and variables → Actions**.
2. Genera el token de YouTube en local: `python bot/yt.py --autorizar` (abre el navegador y, al terminar, imprime la línea `TOKEN_OK` con el `TOKEN_PICKLE_B64` ya codificado). No se vuelve a pedir.
3. Activa los workflows (Actions → Enable). Todo arranca solo por cron.

## 📡 Monitoreo

El canal de Discord recibe: latido cada 5 min, video generado (estilo + título), subida con link, y errores críticos con el log.

## ⚙️ Ajustes

- Orden de rotación (`ORDEN`), pesos de subida y `MAX_COLA=36` → `bot/producir.py` / `bot/publicar.py`
- Crons → los `on.schedule` de cada workflow
- Pool de temas → `guionista/pools/*.json` (8+ tarjetas por estilo; se amplían añadiendo tarjetas)

## ⚠️ Notas

- Cuota diaria de la API de YouTube: ~6 subidas/día; si se corta, el bot reintenta en el siguiente hueco sin morir.
- Las descripciones declaran contenido generado con voz de IA (recomendado por YouTube).
- **Los videos personales del canal (2024) no se tocan jamás** — el bot solo sube, no borra nada de YouTube.
