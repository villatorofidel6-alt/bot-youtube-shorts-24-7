# -*- coding: utf-8 -*-
"""
=====================================================================
 BOT AUTÓNOMO DE YOUTUBE SHORTS 24/7
 Historias de terror "Reglas de pueblos de Roblox"
=====================================================================
 FLUJO INFINITO (while True):
   1. Cola vacía  -> PRODUCCIÓN MASIVA de un lote de videos
      (historia -> voz edge-tts -> subtítulos faster-whisper ->
       render vertical 9:16 con moviepy estilo Hormozi -> /cola_videos)
   2. Cola con videos -> SUBE SOLO UNO a YouTube vía API oficial
   3. PAUSA ESTRICTA de 4 a 6 horas (anti rate-limit, sobrevive reinicios)
   4. Vuelve al paso 2 hasta vaciar la cola -> vuelve al paso 1

 USO RÁPIDO:
   pip install -r requirements.txt
   python main.py            (1ª vez: abre navegador para autorizar)
   iniciar_bot.bat           (dejar corriendo en segundo plano 24/7)

 LOG:  bot_activity.log      ESTADO: estado_bot.json
 ERRORES DE RED/API: try/except -> log -> espera 10 min -> reintenta.

 MODO SERVIDOR/CI (GitHub Actions, VPS):
   python main.py --ciclo --sin-navegador
   -> ejecuta UNA acción (producir lote o subir 1 video) y sale.
=====================================================================
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import pickle
import random
import re
import shutil
import socket
import sys
import threading
import textwrap
import time
import wave
from pathlib import Path

import numpy as np

# ------------------------------------------------------------------ #
# 1. CONFIGURACIÓN GENERAL (edita aquí tus preferencias)
# ------------------------------------------------------------------ #
BASE = Path(__file__).resolve().parent

ARCHIVO_SECRETS = BASE / "client_secret.json"   # OAuth de Google
ARCHIVO_TOKEN = BASE / "token.pickle"           # sesión guardada
ARCHIVO_LOG = BASE / "bot_activity.log"
ARCHIVO_ESTADO = BASE / "estado_bot.json"

CARPETA_COLA = BASE / "cola_videos"             # listos para subir
CARPETA_SUBIDOS = BASE / "subidos"              # ya publicados
CARPETA_ERRORES = BASE / "errores"              # fallidos definitivos
CARPETA_TEMP = BASE / "temp"                    # archivos de trabajo

# --- Discord (opcional): latidos y avisos vía webhook ---
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
INTERVALO_HEARTBEAT_SEG = 300                   # latido a Discord cada 5 minutos
INICIO_RUN = time.time()

VIDEOS_POR_LOTE = 5          # videos generados en cada fase de producción
PAUSA_MIN_H = 4.0            # pausa mínima tras subir (horas)
PAUSA_MAX_H = 6.0            # pausa máxima tras subir (horas)
REINTENTO_SEG = 600          # esperar 10 min ante fallos de red/API
MAX_INTENTOS = 5             # intentos por video antes de mandarlo a /errores

# --- Video ---
ANCHO, ALTO = 720, 1280      # vertical 9:16 (sube a 1080x1920 si tu PC aguanta)
FPS = 30
TAM_TEXTO = int(ALTO * 0.050)          # subtítulos GRANDES estilo Hormozi
PALABRAS_POR_TARJETA = 3               # palabras por tarjeta de subtítulo

# --- Voz / subtítulos ---
VOZ = "es-MX-JorgeNeural"    # alternativas: es-ES-AlvaroNeural, es-CO-SalomeNeural
VELOCIDAD_VOZ = "-4%"        # un poco más lenta = más suspenso
TONO_VOZ = "-2Hz"
MODELO_WHISPER = "small"     # "base" (rápido) | "small" (recomendado) | "medium"

# --- Historia ---
N_REGLAS = 8                 # reglas leídas por video (8 ≈ 70-90 s de duración)

# ------------------------------------------------------------------ #
# 2. LOGS
# ------------------------------------------------------------------ #
log = logging.getLogger("bot_youtube")


def configurar_logging() -> None:
    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(message)s", "%Y-%m-%d %H:%M:%S"
    )
    log.setLevel(logging.DEBUG)
    log.propagate = False

    fh = logging.FileHandler(ARCHIVO_LOG, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    log.addHandler(fh)

    if sys.stdout is not None:  # evita crash bajo pythonw (sin consola)
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(fmt)
        log.addHandler(ch)
    log.addHandler(_CapturaUltimoLog(level=logging.INFO))


# ------------------------------------------------------------------ #
# 2.5 NOTIFICACIONES A DISCORD (se activan con DISCORD_WEBHOOK_URL)
# ------------------------------------------------------------------ #
_ultimo_mensaje_log = {"texto": "(sin eventos aún)"}


class _CapturaUltimoLog(logging.Handler):
    """Guarda el último mensaje del log para incluirlo en el latido."""

    def emit(self, record):
        try:
            _ultimo_mensaje_log["texto"] = record.getMessage()
        except Exception:
            pass


def discord_log(mensaje: str | None = None, embed: dict | None = None) -> None:
    """Envía mensaje y/o embed al webhook de Discord; si falla, no rompe el bot."""
    if not DISCORD_WEBHOOK or (not mensaje and not embed):
        return
    try:
        import urllib.request

        payload: dict = {"username": "Bot YouTube 24/7"}
        if mensaje:
            payload["content"] = mensaje[:1900]
        if embed:
            payload["embeds"] = [embed]
        datos = json.dumps(payload).encode("utf-8")
        peticion = urllib.request.Request(
            DISCORD_WEBHOOK,
            data=datos,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "Mozilla/5.0 (compatible; BotYouTubeShorts/1.0)",
                "Accept": "application/json",
            },
        )
        urllib.request.urlopen(peticion, timeout=15)
    except Exception as error:
        log.debug(f"📡 Discord no respondió: {error}")


# Colores de los embeds (entero hexadecimal de Discord)
COLOR_PUBLICADO = 0x2ECC71   # verde
COLOR_LISTO = 0x3498DB       # azul
COLOR_ERROR = 0xE74C3C       # rojo
COLOR_AVISO = 0xF39C12       # naranja


def discord_embed_video(evento: str, color: int, ruta: Path | None = None,
                        video_id: str | None = None, meta: dict | None = None,
                        historia: dict | None = None, extra: str = "") -> None:
    """Embed detallado de Discord con todos los datos de un video."""
    campos: list[dict] = []
    if meta:
        campos.append({"name": "🎬 Título", "value": (meta.get("titulo") or "?")[:250],
                       "inline": False})
        campos.append({"name": "📝 Descripción",
                       "value": (meta.get("descripcion") or "(vacía)")[:1000],
                       "inline": False})
        etiquetas = ", ".join(meta.get("tags", []))
        if etiquetas:
            campos.append({"name": "🏷️ Etiquetas", "value": etiquetas[:1000],
                           "inline": False})
    elif historia:
        campos.append({"name": "🎬 Título", "value": (historia.get("titulo") or "?")[:250],
                       "inline": False})
        campos.append({"name": "🏘️ Pueblo", "value": historia.get("pueblo", "?"),
                       "inline": True})
        campos.append({"name": "👤 Entidad", "value": historia.get("entidad", "?"),
                       "inline": True})
        campos.append({"name": "⏰ Hora clave", "value": historia.get("hora", "?"),
                       "inline": True})
    if ruta is not None:
        try:
            peso = ruta.stat().st_size / (1024 * 1024)
            campos.append({"name": "💾 Peso", "value": f"{peso:.1f} MB", "inline": True})
            campos.append({"name": "📁 Archivo", "value": f"`{ruta.name}`", "inline": True})
        except OSError:
            pass
    if video_id:
        campos.append({"name": "🔗 Enlace",
                       "value": f"https://youtube.com/shorts/{video_id}", "inline": False})
    if extra:
        campos.append({"name": "ℹ️ Detalle", "value": extra[:1000], "inline": False})

    embed = {
        "title": evento[:256],
        "color": color,
        "fields": campos[:25],
        "footer": {"text": "Bot YouTube Shorts 24/7"},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    discord_log(embed=embed)


def _hilo_heartbeat() -> None:
    """Latido a Discord cada 5 minutos con el estado actual del bot."""
    while True:
        time.sleep(INTERVALO_HEARTBEAT_SEG)
        try:
            en_cola = len(videos_en_cola())
            restante = pausa_pendiente()
            proxima = formato_duracion(restante) if restante > 0 else "listo para subir"
            corrida = formato_duracion(time.time() - INICIO_RUN)
            discord_log(
                f"💓 **Bot vivo** · en ejecución: {corrida}\n"
                f"📥 Cola: **{en_cola}** video(s) · próx. subida: **{proxima}**\n"
                f"📝 Último evento: {_ultimo_mensaje_log['texto']}"
            )
        except Exception:
            pass


# ------------------------------------------------------------------ #
# 3. ESTADO PERSISTENTE (sobrevive reinicios: respeta pausas e intentos)
# ------------------------------------------------------------------ #
def cargar_estado() -> dict:
    try:
        return json.loads(ARCHIVO_ESTADO.read_text(encoding="utf-8"))
    except Exception:
        return {"ultimo_upload_ts": 0.0, "proximo_upload_ts": 0.0,
                "subidos_total": 0, "generados_total": 0, "intentos": {}}


def guardar_estado(estado: dict) -> None:
    tmp = ARCHIVO_ESTADO.with_suffix(".tmp")
    tmp.write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, ARCHIVO_ESTADO)


def formato_duracion(segundos: float) -> str:
    segundos = int(max(0, segundos))
    h, resto = divmod(segundos, 3600)
    m, _ = divmod(resto, 60)
    return f"{h}h {m}m" if h else f"{m}m"


def dormir(segundos: float, motivo: str) -> None:
    """Duerme en bloques de 60 s con latidos en el log (Ctrl+C responde)."""
    log.info(f"😴 {motivo}: durmiendo {formato_duracion(segundos)}")
    limite = time.time() + segundos
    ultimo_latido = time.time()
    while True:
        restante = limite - time.time()
        if restante <= 0:
            break
        time.sleep(min(60, restante))
        if time.time() - ultimo_latido >= 1800:  # latido cada 30 min
            ultimo_latido = time.time()
            log.info(f"💤 Bot vivo, sigue en pausa. Faltan {formato_duracion(limite - time.time())}")


# ------------------------------------------------------------------ #
# 4. GENERADOR DE HISTORIAS (estilo "reglas de pueblos de Roblox")
#    Para usar una IA real (Gemini/OpenAI) reemplaza el cuerpo de
#    generar_historia() manteniendo el dict de salida.
# ------------------------------------------------------------------ #
NOMBRES_PUEBLO = [
    "Brookhaven", "Bloxburg", "Robloxia", "Villa Ceniza", "Costa Rosa",
    "Mesa Negra", "Puerto Blox", "Rocaviva", "El Lago Silente", "Nueva Harbor",
]

ENTIDADES = [
    "el Vigilante de las 3 AM", "la Señora del Pocito", "el Repartidor Sin Cara",
    "la Niña del Paraguas Rojo", "el Fontanero del Sótano", "el Conductor del Bus 13",
    "la Maniquí del Parque", "el Interlocutor del Chat de Voz",
    "la Vendedora de Globos Grises", "el Guardia del Spawn",
]

HORAS = ["3:00 AM", "2:47 AM", "3:33 AM", "4:44 AM", "1:11 AM", "la medianoche"]

HOOKS = [
    "Este es {p}, el pueblo de Roblox donde nadie vive más de una semana. "
    "Memoriza estas reglas, porque nadie te las va a repetir.",
    "Bienvenido a {p}. De día parece normal. Pero de noche, estas reglas son "
    "lo único que te mantiene con vida.",
    "Mi primo se mudó a {p} y me envió esta lista antes de desaparecer. "
    "Estas son las reglas del pueblo.",
    "Si algún día aparece un servidor llamado {p}, no entres. A menos que "
    "puedas cumplir todas estas reglas.",
]

REGLAS = [
    "Después de las {h}, no abras la puerta, ni siquiera si llama tu vecino. "
    "En {p} los vecinos vuelven caminando raro.",
    "Si un jugador sin nombre te escribe «ven», cierra el chat y no respondas nada.",
    "El panadero del pueblo no parpadea. No lo mires más de diez segundos seguidos.",
    "Acepta cualquier game pass que te regalen, menos los que cuestan 0 Robux "
    "y se llaman con tu nombre.",
    "Si la música del pueblo se corta de golpe, mete tu avatar debajo del mapa "
    "y no te muevas hasta que vuelva.",
    "La sirena suena una vez al día. Si suena tres veces, sal del servidor sin decir adiós.",
    "Entre las {h} y el amanecer, el chat de voz solo transmite hacia dentro. "
    "No hables, aunque escuches a tu mamá.",
    "Si ves que todos corren hacia el spawn, no los sigas. Nadie recuerda "
    "por qué empezaron a correr.",
    "El bus 13 solo aparece de madrugada. Si paras, el conductor te mirará a los ojos. "
    "No le pagues, no le hables, no bajes la mirada.",
    "Hay una casa con la luz siempre encendida. Si un día la ves apagada, avisa "
    "al guardia y vete de {p} esa misma noche.",
    "Ningún admin te pedirá tu contraseña. Si alguien lo hace, es {e}.",
    "Si tu propio avatar aparece sentado dentro de una casa donde tú no estás, "
    "sal del juego sin cerrar el chat.",
    "Los NPC del mercado repiten la misma frase. Si uno dice tu nombre real, "
    "apaga el juego y cuenta hasta cien antes de volver a abrirlo.",
    "A las {h} el pueblo se vacía. Si tú sigues viendo gente, tú eres la gente "
    "que los demás no deberían ver. Corre.",
    "No revises el buzón de tu casa de Bloxburg después de las {h}. "
    "Las cartas que llegan de noche no usan sellos.",
    "Si la lluvia cae hacia arriba, quédate bajo techo. Los que salieron, sus "
    "avatares siguen ahí. Ellos ya no.",
    "El puente del río tiene un límite: cuatro jugadores. Si cruzan cinco, "
    "el río elige quién regresa.",
    "Si escuchas pasos en el techo a las {h}, respira lento y cuenta hasta treinta. "
    "{e} solo ataca a quien tiene miedo.",
    "Apaga el televisor de tu casa antes de dormir. A veces emite la señal del "
    "pueblo viejo, el que quemaron.",
    "El guardia del spawn guarda la lista de las reglas. Si te pide recitarlas "
    "y fallas una, no te deja salir hasta el amanecer.",
    "Nunca digas «no es real» en el chat a las {h}. {e} toma eso como un desafío personal.",
    "Si un juego dentro del juego te invita a probarlo gratis, pide primero el "
    "nombre del creador. Si el nombre es el tuyo, no entres.",
    "Las flores del parque huelen a quemado los viernes. Ese día no uses el atajo, "
    "aunque te ahorre diez minutos.",
    "Si tu hermano pequeño te despierta a las {h} y te pide que lo acompañes al "
    "baño, mira primero sus pies. Los de {e} no tocan el suelo.",
    "La pizzería reparte gratis a las {h}. Come todo lo que quieras, pero nunca "
    "pidas la cuenta. Aquí la cuenta se cobra en otra cosa.",
    "Si el sol sale dos veces el mismo día, quédate en casa el día siguiente "
    "entero. Nadie sabrá por qué, pero hazlo.",
    "No dejes tu avatar AFK en la plaza. A las {h} los AFK despiertan y caminan "
    "solos hacia el bosque.",
    "Cuando nieva en {p}, no hagas muñecos de nieve. Ellos cuentan cuántos hay. "
    "Y a veces falta uno.",
]

CLIMAX = [
    "Yo rompí la regla {num} mi tercera noche. A las {h} escuché tres golpes. "
    "Abrí. No había nadie. Solo el olor a servidor viejo y una voz en el chat: "
    "«gracias por abrir». {e} no olvida una puerta abierta. Y yo sigo aquí, "
    "dentro del servidor, esperando que alguien lea esto.",
    "Mi vecino rompió la regla {num} y a las {h} su casa amaneció cerrada con "
    "llave por fuera. En el mapa, su avatar sigue ahí. Yo lo saludo cada noche. "
    "No contesta. {e} dice que contestará cuando cumplamos treinta días sin dormir.",
    "La regla {num} la escribió mi hermana antes de irse. A las {h} la sirena "
    "sonó dos veces. Un minuto después, sonó la tercera. Yo cumplí todas las "
    "reglas. Y aun así, anoche, mi puerta sonó tres veces.",
]

CTAS = [
    "Vivirías en {p}? Guarda esta lista y compártela con tu equipo. Y si la "
    "sirena suena tres veces, ya sabes: no abras, no hables, no mires atrás. "
    "Sígueme, mañana publico las reglas del pueblo vecino.",
    "Esta lista se actualiza sola. Si un día cambian las reglas, es porque {e} "
    "ya anda suelto. Suscríbete antes de las {h}, por si acaso.",
    "Comparte esto con quien entraría igual. Y recuerda: en {p} las reglas no "
    "existen para asustarte. Existen para que te sigan teniendo en la lista.",
]

TITULOS = [
    "Las REGLAS de {p} que NADIE te cuenta 😨 #shorts",
    "NO entres a {p} después de las {h} ⚠️ Roblox #shorts",
    "Reglas del pueblo {p} de Roblox (la #3 es la peor) 😨",
    "Si escuchas esto en {p}, YA ES TARDE 😨 Roblox #shorts",
    "El pueblo de Roblox con más reglas que habitantes: {p} ⚠️",
]

HASHTAGS = ["#shorts", "#roblox", "#historiasterror", "#reglas", "#creepypasta",
            "#miedo", "#paranormal", "#robloxshorts", "#terror", "#viral"]

TAGS_YT = ["shorts", "roblox", "historias de terror", "reglas de roblox",
           "creepypasta", "miedo", "paranormal", "terror en roblox", "viral"]


def generar_historia() -> dict:
    pueblo = random.choice(NOMBRES_PUEBLO)
    entidad = random.choice(ENTIDADES)
    hora = random.choice(HORAS)

    reglas_texto = [
        f"Regla {i}. {tpl.format(e=entidad, h=hora, p=pueblo)}"
        for i, tpl in enumerate(random.sample(REGLAS, N_REGLAS), start=1)
    ]
    gancho = random.choice(HOOKS).format(p=pueblo, h=hora)
    climax = random.choice(CLIMAX).format(
        num=random.randint(1, N_REGLAS), h=hora, e=entidad, p=pueblo
    )
    cierre = random.choice(CTAS).format(p=pueblo, h=hora, e=entidad)
    texto_tts = "\n\n".join([gancho, *reglas_texto, climax, cierre])

    titulo = random.choice(TITULOS).format(p=pueblo, h=hora)
    descripcion = (
        f"{gancho} 👇\n\n"
        f"⏰ Reglas del pueblo {pueblo} | Historia de terror estilo Roblox.\n"
        f"😨 Sígueme para conocer las reglas del próximo pueblo.\n\n"
        f"⚠️ Historia de FICCIÓN creada para entretenimiento. "
        f"Narrada con voz generada por inteligencia artificial.\n\n"
        f"{' '.join(HASHTAGS)}"
    )
    return {
        "pueblo": pueblo, "entidad": entidad, "hora": hora,
        "titulo": titulo, "descripcion": descripcion,
        "tags": TAGS_YT, "texto": texto_tts,
    }


def _slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")[:40]


# ------------------------------------------------------------------ #
# 5. VOZ EN OFF (edge-tts)
# ------------------------------------------------------------------ #
def texto_a_audio(texto: str, ruta_mp3: Path) -> None:
    import edge_tts

    async def _generar():
        comunicacion = edge_tts.Communicate(
            texto, VOZ, rate=VELOCIDAD_VOZ, pitch=TONO_VOZ
        )
        await comunicacion.save(str(ruta_mp3))

    asyncio.run(_generar())


# ------------------------------------------------------------------ #
# 6. SUBTÍTULOS CON TIEMPOS (faster-whisper)
# ------------------------------------------------------------------ #
_MODELO_WHISPER = None


def obtener_modelo_whisper():
    global _MODELO_WHISPER
    if _MODELO_WHISPER is None:
        from faster_whisper import WhisperModel

        log.info(f"🧠 Cargando faster-whisper ({MODELO_WHISPER}) "
                 f"(la primera vez descarga el modelo, ten paciencia)...")
        _MODELO_WHISPER = WhisperModel(MODELO_WHISPER, device="cpu", compute_type="int8")
    return _MODELO_WHISPER


def transcribir(ruta_audio: Path) -> list[dict]:
    """Devuelve [{'palabra': str, 'start': float, 'end': float}, ...]."""
    modelo = obtener_modelo_whisper()
    segmentos, _ = modelo.transcribe(
        str(ruta_audio), language="es", word_timestamps=True, vad_filter=True
    )
    palabras: list[dict] = []
    for seg in segmentos:
        for w in (seg.words or []):
            limpio = w.word.strip()
            if limpio:
                palabras.append({"palabra": limpio, "start": w.start, "end": w.end})
    if not palabras:
        raise RuntimeError("Whisper no devolvió palabras; audio vacío o ilegible.")
    return palabras


# ------------------------------------------------------------------ #
# 7. RENDER DEL VIDEO VERTICAL 9:16 (moviepy, estilo Hormozi)
# ------------------------------------------------------------------ #
_FUENTE: str | None = None

PALABRAS_IMPACTO = {
    "NUNCA", "JAMÁS", "NO", "PELIGRO", "MUERE", "MUERTO", "MUERTE", "SANGRE",
    "GRITA", "GRITÓ", "HUYE", "CORRE", "PROHIBIDO", "OJOS", "PUERTA", "CIERRA",
    "NADIE", "TODOS", "DESAPARECE", "DESAPARECIÓ", "SIRENA", "TRES", "VEN",
    "ALTO", "FUEGO", "MIRA", "ESCUCHA", "AFK",
}


def buscar_fuente() -> str:
    global _FUENTE
    if _FUENTE:
        return _FUENTE
    candidatas = [
        os.environ.get("FUENTE_TTF", ""),
        "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/ariblk.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    for ruta in candidatas:
        if ruta and Path(ruta).exists():
            _FUENTE = ruta
            return _FUENTE
    raise RuntimeError("No se encontró ninguna fuente .ttf. Define FUENTE_TTF.")


# El fondo estático fue reemplazado por el motor de escenas animadas
# procedurales del módulo escenas.py (ver sección de render).


def agrupar_palabras(palabras: list[dict]) -> list[dict]:
    """Une palabras en tarjetas de subtítulo (2-4 palabras, ruptura por puntuación)."""
    tarjetas: list[dict] = []
    grupo: list[dict] = []

    def cerrar():
        if grupo:
            tarjetas.append({"inicio": grupo[0]["start"], "fin": grupo[-1]["end"],
                             "palabras": [g["palabra"] for g in grupo]})
            grupo.clear()

    for p in palabras:
        grupo.append(p)
        base = re.sub(r"[^\wÁÉÍÓÚÜÑáéíóúüñ]", "", p["palabra"]).upper()
        impacto = base in PALABRAS_IMPACTO
        ruptura = base.endswith((".", "!", "?", "…", ",", ":", ";")) and len(grupo) >= 2
        if impacto or len(grupo) >= PALABRAS_POR_TARJETA + 1 or ruptura:
            cerrar()

    cerrar()

    # tarjetas de 1 palabra no-impacto se fusionan con la anterior
    fusionadas: list[dict] = []
    for t in tarjetas:
        if len(t["palabras"]) == 1 and len(fusionadas):
            limpia = re.sub(r"[^\wÁÉÍÓÚÜÑ]", "", t["palabras"][0]).upper()
            if limpia not in PALABRAS_IMPACTO:
                fusionadas[-1]["palabras"].append(t["palabras"][0])
                fusionadas[-1]["fin"] = t["fin"]
                continue
        fusionadas.append(t)
    tarjetas = fusionadas

    # cerrar huecos cortos entre tarjetas
    for i, t in enumerate(tarjetas):
        if i + 1 < len(tarjetas):
            hueco = tarjetas[i + 1]["inicio"] - t["fin"]
            if 0 < hueco < 0.40:
                t["fin"] = tarjetas[i + 1]["inicio"] - 0.02
        t["duracion"] = max(0.45, t["fin"] - t["inicio"])
    return tarjetas


def construir_subtitulos(palabras: list[dict]) -> list:
    from moviepy import TextClip

    fuente = buscar_fuente()
    max_caracteres = max(12, int((ANCHO * 0.88) / (TAM_TEXTO * 0.52)))
    salto_y = [0, int(ALTO * 0.012), -int(ALTO * 0.012)]
    clips: list = []
    trazo = max(3, TAM_TEXTO // 14)

    for i, tarjeta in enumerate(agrupar_palabras(palabras)):
        texto = " ".join(tarjeta["palabras"]).upper()
        texto = "\n".join(textwrap.wrap(texto, max_caracteres))
        limpio = re.sub(r"[^\wÁÉÍÓÚÜÑ]", "", texto).upper()
        impacto = any(re.sub(r"[^\wÁÉÍÓÚÜÑ]", "", p).upper() in PALABRAS_IMPACTO
                      for p in tarjeta["palabras"])
        color = "yellow" if impacto or "IMPACTO" in limpio else "white"
        clip = (
            TextClip(font=fuente, text=texto, font_size=TAM_TEXTO,
                     color=color, stroke_color="black", stroke_width=trazo,
                     text_align="center", method="label", transparent=True)
            .with_duration(tarjeta["duracion"])
            .with_start(max(0.0, tarjeta["inicio"]))
            .with_position(("center", int(ALTO * 0.62) + salto_y[i % 3]))
        )
        clips.append(clip)
    return clips


def generar_dron(duracion: float, ruta_wav: Path) -> None:
    """Colchón sonoro de terror (dron grave + ruido filtrado), sin archivos externos."""
    sr = 32000
    t = np.linspace(0, duracion, int(sr * duracion), endpoint=False, dtype=np.float64)
    onda = (0.50 * np.sin(2 * np.pi * 55.0 * t)
            + 0.40 * np.sin(2 * np.pi * 55.7 * t)
            + 0.22 * np.sin(2 * np.pi * 110.3 * t))
    ruido = np.random.normal(0.0, 0.08, len(t))
    ruido = np.convolve(ruido, np.ones(200) / 200, mode="same")  # low-pass burdo
    envolvente = np.clip(np.minimum(t / 3.0, (duracion - t) / 3.0), 0.0, 1.0)
    senal = (onda * 0.32 + ruido * 1.10) * envolvente
    senal = np.clip(senal / max(1e-9, np.abs(senal).max()) * 0.35, -1.0, 1.0)
    pcm = (senal * 32767.0).astype(np.int16)
    with wave.open(str(ruta_wav), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


def render_video(historia: dict, ruta_salida: Path) -> None:
    from moviepy import (AudioFileClip, CompositeAudioClip, CompositeVideoClip,
                         afx, vfx)

    CARPETA_TEMP.mkdir(exist_ok=True)
    ruta_voz = CARPETA_TEMP / "voz.mp3"
    ruta_dron = CARPETA_TEMP / "dron.wav"

    # 1) Voz en off
    texto_a_audio(historia["texto"], ruta_voz)
    voz = AudioFileClip(str(ruta_voz))

    # 2) Transcripción palabra a palabra
    palabras = transcribir(ruta_voz)

    # 3) Duración total
    total = max(palabras[-1]["end"], voz.duration) + 0.8
    total = max(8.0, total)

    # 4) Dron de fondo
    generar_dron(total, ruta_dron)
    dron = (AudioFileClip(str(ruta_dron))
            .with_effects([afx.MultiplyVolume(0.55), afx.AudioFadeOut(2.5)]))
    mezcla = CompositeAudioClip([voz, dron]).with_duration(total)

    # 5) Escenas animadas (calle/casa/bosque/tienda/parque) + cámara + fundidos
    import escenas
    escenas.configurar(ANCHO, ALTO, FPS)
    tipos = escenas.elegir_escenas(historia)
    log.info(f"🎨 Escenas animadas: {' + '.join(tipos)}")
    dur_e = (total + 2 * escenas.DESVANECIMIENTO) / len(tipos)
    partes = []
    for i, tipo in enumerate(tipos):
        clip = escenas.clip_escena(tipo, dur_e).with_start(
            i * (dur_e - escenas.DESVANECIMIENTO))
        if i > 0:
            clip = clip.with_effects([vfx.CrossFadeIn(escenas.DESVANECIMIENTO)])
        partes.append(clip)
    fondo = CompositeVideoClip(partes).with_duration(total)

    from moviepy import TextClip
    etiqueta = (
        TextClip(font=buscar_fuente(), text=historia["pueblo"].upper(),
                 font_size=int(ALTO * 0.024), color="white",
                 stroke_color="black", stroke_width=3,
                 text_align="center", method="label", transparent=True)
        .with_duration(total)
        .with_position(("center", int(ALTO * 0.05)))
    )

    final = CompositeVideoClip(
        [fondo, *construir_subtitulos(palabras), etiqueta]
    ).with_duration(total).with_audio(mezcla)

    # 6) Render a temporal y movimiento atómico a la cola
    tmp = CARPETA_TEMP / (ruta_salida.stem + "_render.mp4")
    try:
        log.info(f"🎬 Renderizando {ruta_salida.name} "
                 f"({total:.0f}s @ {FPS}fps, {ANCHO}x{ALTO})...")
        final.write_videofile(
            str(tmp), fps=FPS, codec="libx264", audio_codec="aac",
            audio_bitrate="160k", preset="medium",
            threads=os.cpu_count() or 4, logger=None,
            ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
        )
    finally:
        try:
            voz.close()
            dron.close()
        except Exception:
            pass
    os.replace(tmp, ruta_salida)


# ------------------------------------------------------------------ #
# 8. FASE DE PRODUCCIÓN MASIVA
# ------------------------------------------------------------------ #
def limpiar_temp() -> None:
    for nombre in ("voz.mp3", "dron.wav", "fondo.jpg"):
        try:
            (CARPETA_TEMP / nombre).unlink(missing_ok=True)
        except Exception:
            pass


def guardar_meta(ruta_video: Path, historia: dict) -> None:
    meta = {"titulo": historia["titulo"], "descripcion": historia["descripcion"],
            "tags": historia["tags"]}
    ruta_meta = ruta_video.with_suffix(".meta.json")
    tmp = ruta_meta.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, ruta_meta)


def generar_lote(cantidad: int) -> int:
    log.info("=" * 64)
    log.info(f"🏭 FASE DE PRODUCCIÓN MASIVA: generando {cantidad} videos...")
    log.info("=" * 64)
    limpiar_temp()
    hechos = 0
    for i in range(1, cantidad + 1):
        try:
            t0 = time.time()
            historia = generar_historia()
            nombre = f"corto_{time.strftime('%Y%m%d_%H%M%S')}_{_slug(historia['pueblo'])}.mp4"
            destino = CARPETA_COLA / nombre
            render_video(historia, destino)
            guardar_meta(destino, historia)
            hechos += 1
            estado = cargar_estado()
            estado["generados_total"] = estado.get("generados_total", 0) + 1
            guardar_estado(estado)
            log.info(f"✅ [{i}/{cantidad}] {nombre} listo en cola "
                     f"({formato_duracion(time.time() - t0)} de producción)")
            discord_embed_video(
                f"🏭 Video {i}/{cantidad} listo en la cola",
                COLOR_LISTO, ruta=destino, historia=historia,
                extra=f"Producción: {formato_duracion(time.time() - t0)}",
            )
            limpiar_temp()
        except Exception as error:
            log.error(f"❌ [{i}/{cantidad}] Fallo generando el video: {error}")
            log.debug("", exc_info=True)
    log.info(f"🏭 Lote terminado: {hechos}/{cantidad} videos en /cola_videos")
    discord_log(f"🏭 **Lote de producción terminado**: {hechos}/{cantidad} videos "
                f"listos en la cola.")
    return hechos


# ------------------------------------------------------------------ #
# 9. AUTENTICACIÓN OAuth 2.0 (client_secret.json -> token.pickle)
# ------------------------------------------------------------------ #
# force-ssl: permite GESTIONAR videos (borrar). upload: subir. Ambas juntas cubren todo.
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.force-ssl"]


def guardar_token(creds) -> None:
    with open(ARCHIVO_TOKEN, "wb") as f:
        pickle.dump(creds, f)
    log.info("💾 Sesión guardada en token.pickle (no se pedirá de nuevo).")


def obtener_credenciales(sin_navegador: bool = False):
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if ARCHIVO_TOKEN.exists():
        try:
            with open(ARCHIVO_TOKEN, "rb") as f:
                creds = pickle.load(f)
        except Exception:
            log.warning("token.pickle corrupto; se re-autenticará.")
            ARCHIVO_TOKEN.unlink(missing_ok=True)
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            guardar_token(creds)
            return creds
        except Exception as error:
            log.warning(f"Refresh falló ({error}); se re-autenticará.")
            ARCHIVO_TOKEN.unlink(missing_ok=True)

    log.info("🔐 Abriendo navegador para autorizar la cuenta de YouTube "
             "(SOLO la primera vez)...")
    if sin_navegador:
        raise RuntimeError(
            "El token.pickle está vencido o no existe y --sin-navegador está activo. "
            "Ejecuta en tu PC:  python main.py --autorizar  y luego actualiza el "
            "secreto TOKEN_PICKLE_B64 del repositorio de GitHub con el nuevo token.pickle."
        )
    flow = InstalledAppFlow.from_client_secrets_file(str(ARCHIVO_SECRETS), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")
    guardar_token(creds)
    return creds


def crear_servicio(sin_navegador: bool = False):
    from googleapiclient.discovery import build

    return build("youtube", "v3", credentials=obtener_credenciales(sin_navegador))


def borrar_todo_youtube() -> None:
    """BORRA todos los videos que el bot subió a YouTube y vacía la cola local."""
    from googleapiclient.errors import HttpError

    estado = cargar_estado()
    ids = dict(estado.get("subidos_ids", {}))
    servicio = crear_servicio()

    if not ids:
        log.info("🗑️ No hay videos registrados como subidos en el estado.")
    for nombre, vid in list(ids.items()):
        try:
            servicio.videos().delete(id=vid).execute()
            log.info(f"🗑️ BORRADO de YouTube: https://youtube.com/shorts/{vid} ({nombre})")
            estado["subidos_ids"].pop(nombre, None)
        except HttpError as error:
            motivo = razon_error(error) or str(error)
            log.warning(f"⚠️ No se pudo borrar {vid}: {motivo}")
            if "videoNotFound" in motivo or "forbidden" in motivo:
                estado["subidos_ids"].pop(nombre, None)  # ya no existe: quitar del registro
    estado["subidos_total"] = len(estado.get("subidos_ids", {}))

    # Vaciar carpetas locales (cola, subidos, errores, temp)
    borrados = 0
    for carpeta in (CARPETA_COLA, CARPETA_SUBIDOS, CARPETA_ERRORES, CARPETA_TEMP):
        if carpeta.exists():
            for archivo in carpeta.iterdir():
                try:
                    archivo.unlink()
                    borrados += 1
                except Exception:
                    pass
    guardar_estado(estado)
    log.info(f"🧹 Cola local vaciada ({borrados} archivos eliminados). "
             f"Histórico subidos: {estado['subidos_total']}")
    discord_log("🗑️ **Limpieza total** · videos borrados de YouTube y cola local vaciada. "
                "A partir de ahora todo será **video animado** 🎬")


# ------------------------------------------------------------------ #
# 10. SUBIDA A YOUTUBE (API oficial, resumable y con reintentos)
# ------------------------------------------------------------------ #
class CuotaDiaria(Exception):
    pass


class VideoInvalido(Exception):
    pass


def razon_error(http_error) -> str:
    try:
        datos = json.loads(http_error.content.decode("utf-8"))
        errores = datos.get("error", {}).get("errors", [])
        if errores:
            return str(errores[0].get("reason", ""))
    except Exception:
        pass
    return ""


def subir_video(servicio, ruta_video: Path, meta: dict) -> str:
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    cuerpo = {
        "snippet": {
            "title": meta["titulo"][:100],
            "description": meta["descripcion"][:4900],
            "tags": meta["tags"][:30],
            "categoryId": "24",               # Entretenimiento
            "defaultLanguage": "es",
            "defaultAudioLanguage": "es",
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,  # NO es contenido para niños
        },
    }
    media = MediaFileUpload(
        str(ruta_video), chunksize=8 * 1024 * 1024,
        resumable=True, mimetype="video/mp4",
    )
    peticion = servicio.videos().insert(part="snippet,status", body=cuerpo,
                                        media_body=media)
    respuesta = None
    ultimo_progreso = -1
    while respuesta is None:
        try:
            estado, respuesta = peticion.next_chunk(num_retries=0)
            if estado is not None:
                progreso = int(estado.progress() * 100)
                if progreso >= ultimo_progreso + 25:
                    ultimo_progreso = progreso
                    log.info(f"   ⏫ Subida al {progreso}%...")
        except HttpError as error:
            razon = razon_error(error)
            if razon in ("quotaExceeded", "dailyLimitExceeded",
                         "uploadLimitExceeded", "rateLimitExceeded"):
                raise CuotaDiaria(razon) from error
            if error.resp.status == 400:
                raise VideoInvalido(razon or "invalidRequest") from error
            if error.resp.status in (500, 502, 503, 504):
                log.warning(f"⚠️ YouTube con problemas ({error.resp.status}); "
                            f"reintentando en 30 s...")
                time.sleep(30)
                continue
            raise
        except (OSError, socket.timeout, TimeoutError, ConnectionError) as error:
            log.warning(f"⚠️ Red inestable durante la subida ({error}); "
                        f"reanudando en 20 s...")
            time.sleep(20)
    return respuesta["id"]


# ------------------------------------------------------------------ #
# 11. BUCLE PRINCIPAL 24/7 (publicación espaciada)
# ------------------------------------------------------------------ #
def videos_en_cola() -> list[Path]:
    return sorted(
        [p for p in CARPETA_COLA.glob("*.mp4") if p.stat().st_size > 1024],
        key=lambda p: p.stat().st_mtime,
    )


def cargar_meta(ruta_video: Path) -> dict:
    ruta_meta = ruta_video.with_suffix(".meta.json")
    if ruta_meta.exists():
        try:
            return json.loads(ruta_meta.read_text(encoding="utf-8"))
        except Exception:
            log.warning(f"Meta corrupto para {ruta_video.name}; uso metadatos genéricos.")
    return {
        "titulo": "Las REGLAS de este pueblo de Roblox NO son un juego 😨 #shorts",
        "descripcion": ("⏰ Reglas de un pueblo de Roblox. Historia de FICCIÓN, "
                        "narrada con voz de IA.\n\n" + " ".join(HASHTAGS)),
        "tags": TAGS_YT,
    }


def archivar(ruta_video: Path, carpeta: Path) -> None:
    destino = carpeta / ruta_video.name
    if destino.exists():
        destino.unlink()
    shutil.move(str(ruta_video), str(destino))
    meta_origen = ruta_video.with_suffix(".meta.json")
    if meta_origen.exists():
        destino_meta = carpeta / meta_origen.name
        if destino_meta.exists():
            destino_meta.unlink()
        shutil.move(str(meta_origen), str(destino_meta))
    estado = cargar_estado()
    estado.get("intentos", {}).pop(ruta_video.name, None)
    guardar_estado(estado)
    log.info(f"📦 {ruta_video.name} movido a /{carpeta.name}")


def registrar_intento_fallido(ruta_video: Path) -> int:
    estado = cargar_estado()
    intentos = estado.setdefault("intentos", {})
    n = int(intentos.get(ruta_video.name, 0)) + 1
    intentos[ruta_video.name] = n
    guardar_estado(estado)
    log.warning(f"⚠️ Intento {n}/{MAX_INTENTOS} fallido para {ruta_video.name}")
    return n


def pausa_pendiente() -> float:
    """Segundos que faltan para poder volver a subir (respeta reinicios)."""
    estado = cargar_estado()
    return estado.get("proximo_upload_ts", 0.0) - time.time()


def bucle_principal(ciclo: bool = False, sin_navegador: bool = False) -> None:
    """Bucle 24/7. Con ciclo=True ejecuta UNA acción y sale (GitHub Actions)."""
    while True:
        video: Path | None = None
        try:
            pendientes = videos_en_cola()

            # --- ¿Cola vacía? -> producción masiva ---
            if not pendientes:
                log.info("📚 Cola vacía: toca fabricar un nuevo lote de videos.")
                hechos = generar_lote(VIDEOS_POR_LOTE)
                if hechos == 0 and not ciclo:
                    dormir(REINTENTO_SEG, "lote fallido: reintentando producción")
                pendientes = videos_en_cola()
                if not pendientes:
                    log.warning("⚠️ El lote no produjo videos; se reintentará la próxima ejecución.")
                    return
                if ciclo:
                    log.info("🔁 Lote listo; continúo en este mismo ciclo con la subida del primero.")

            video = pendientes[0]

            # --- Guardia anti-duplicado (por si un guardado de estado falló antes) ---
            estado_prev = cargar_estado()
            if video.name in estado_prev.get("subidos_ids", {}):
                log.warning(f"♻️ {video.name} ya fue publicado antes "
                            f"(id {estado_prev['subidos_ids'][video.name]}); se archiva sin re-subir.")
                archivar(video, CARPETA_SUBIDOS)
                if ciclo:
                    return
                continue

            meta = cargar_meta(video)
            log.info(f"🧾 Cola: {len(pendientes)} video(s). Siguiente: {video.name}")

            # --- Pausa anti rate-limit (persistente entre reinicios) ---
            restante = pausa_pendiente()
            if restante > 0:
                log.info(f"⏳ Pausa anti rate-limit: faltan {formato_duracion(restante)}.")
                if ciclo:
                    return
                dormir(restante, "⏳ Pausa anti rate-limit pendiente (heredada del ciclo anterior)")

            servicio = crear_servicio(sin_navegador=sin_navegador)
            log.info(f"📤 Subiendo a YouTube: {video.name}")
            t0 = time.time()
            video_id = subir_video(servicio, video, meta)

            # --- Éxito: registrar, archivar y pausa ESTRICTA de 4-6 h ---
            ahora = time.time()
            estado = cargar_estado()
            estado["ultimo_upload_ts"] = ahora
            pausa = random.uniform(PAUSA_MIN_H * 3600, PAUSA_MAX_H * 3600)
            estado["proximo_upload_ts"] = ahora + pausa
            estado["subidos_total"] = estado.get("subidos_total", 0) + 1
            estado.setdefault("subidos_ids", {})[video.name] = video_id
            guardar_estado(estado)
            log.info(f"🚀 PUBLICADO: https://youtube.com/shorts/{video_id} "
                     f"({formato_duracion(time.time() - t0)} de subida) | "
                     f"Título: {meta['titulo']!r}")
            discord_embed_video(
                "🚀 ¡Video publicado en YouTube!",
                COLOR_PUBLICADO, ruta=video, video_id=video_id, meta=meta,
                extra=f"Subida: {formato_duracion(time.time() - t0)}",
            )
            archivar(video, CARPETA_SUBIDOS)

            if ciclo:
                log.info(f"🔁 Modo ciclo: video publicado y estado guardado "
                         f"(próxima subida en {formato_duracion(pausa)}). Saliendo.")
                return
            dormir(pausa, "🛑 PAUSA ESTRICTA post-subida (anti rate-limit)")

        except KeyboardInterrupt:
            log.info("🛑 Bucle detenido por el usuario. Estado guardado.")
            break
        except CuotaDiaria as error:
            log.warning(f"🚦 Cuota/rate-limit de YouTube ({error}); se reintentará más tarde.")
            discord_log(f"🚦 Cuota de YouTube agotada ({error}); se reintentará en la próxima corrida.")
            if ciclo:
                return
            dormir(3600, "esperando cuota de la API")
        except VideoInvalido as error:
            if video:
                log.error(f"🗑️ Video rechazado por la API ({error}); a /errores: {video.name}")
                discord_log(f"🗑️ Video rechazado por YouTube ({error}): {video.name}")
                try:
                    archivar(video, CARPETA_ERRORES)
                except Exception:
                    log.debug("", exc_info=True)
            if ciclo:
                return
            continue
        except Exception as error:
            # Fallo de red/API/genérico: log + 10 min + reintento sin crashear.
            log.error(f"❌ ERROR inesperado: {error}")
            log.debug("", exc_info=True)
            discord_log(f"❌ **ERROR del bot**: {error}\nSe reintentará automáticamente.")
            if video and registrar_intento_fallido(video) >= MAX_INTENTOS:
                log.error(f"🗑️ {video.name} agotó sus {MAX_INTENTOS} intentos; a /errores.")
                try:
                    archivar(video, CARPETA_ERRORES)
                except Exception:
                    log.debug("", exc_info=True)
            if ciclo:
                return
            dormir(REINTENTO_SEG, "🔁 Reintento automático tras fallo")


# ------------------------------------------------------------------ #
# 12. ARRANQUE
# ------------------------------------------------------------------ #
def crear_carpetas() -> None:
    for carpeta in (CARPETA_COLA, CARPETA_SUBIDOS, CARPETA_ERRORES, CARPETA_TEMP):
        carpeta.mkdir(exist_ok=True)


def main() -> None:
    configurar_logging()
    crear_carpetas()

    if DISCORD_WEBHOOK:
        threading.Thread(target=_hilo_heartbeat, daemon=True).start()
        log.info("📡 Latidos de Discord activos (cada 5 minutos).")

    parser = argparse.ArgumentParser(description="Bot autónomo de YouTube Shorts 24/7")
    parser.add_argument("--autorizar", action="store_true",
                        help="solo realiza el OAuth y guarda token.pickle")
    parser.add_argument("--prueba", action="store_true",
                        help="genera 1 video de muestra en /temp y NO sube nada")
    parser.add_argument("--lote", type=int, default=VIDEOS_POR_LOTE,
                        help="tamaño del lote de producción")
    parser.add_argument("--ciclo", action="store_true",
                        help="ejecuta UNA acción (producir lote o subir 1 video) y sale; "
                             "para GitHub Actions / servidores programados")
    parser.add_argument("--sin-navegador", action="store_true",
                        help="no abre navegador para autenticar (CI); falla con mensaje "
                             "claro si el token está vencido")
    parser.add_argument("--borrar-todos", action="store_true",
                        help="BORRA todos los videos publicados por el bot en YouTube "
                             "y vacía la cola local")
    args = parser.parse_args()

    log.info("=" * 64)
    log.info("🤖 BOT AUTÓNOMO DE YOUTUBE SHORTS 24/7 — iniciado")
    log.info(f"   Lote: {args.lote} videos | Pausa: {PAUSA_MIN_H}-{PAUSA_MAX_H} h | "
             f"Video: {ANCHO}x{ALTO} @{FPS}fps")
    log.info(f"   Log: {ARCHIVO_LOG.name} | Voz: {VOZ} | Whisper: {MODELO_WHISPER}")
    log.info("=" * 64)
    discord_log(f"🟢 **Bot iniciado** ({'ciclo CI' if args.ciclo else 'modo 24/7 local'}) · "
                f"lote {args.lote} · pausa {PAUSA_MIN_H}-{PAUSA_MAX_H} h")

    if not ARCHIVO_SECRETS.exists():
        log.error("🚨 Falta client_secret.json junto a main.py. Descárgalo de "
                  "Google Cloud Console (OAuth 2.0, tipo 'Aplicación de escritorio').")
        sys.exit(1)

    try:
        if args.autorizar:
            crear_servicio()
            log.info("✅ Autenticación completada. Ya puedes dejar el bot en segundo plano.")
            return

        if args.borrar_todos:
            borrar_todo_youtube()
            return

        # Validar autenticación ANTES del bucle (solo pide navegador la 1ª vez).
        crear_servicio()
        log.info("✅ Autenticación lista (token.pickle).")

        if args.prueba:
            historia = generar_historia()
            destino = CARPETA_TEMP / "prueba_render.mp4"
            render_video(historia, destino)
            log.info(f"🎬 Video de PRUEBA listo (no se sube): {destino}")
            return

        estado = cargar_estado()
        log.info(f"📊 Histórico: {estado.get('subidos_total', 0)} subidos | "
                 f"{estado.get('generados_total', 0)} generados")
        bucle_principal(ciclo=args.ciclo, sin_navegador=args.sin_navegador)

    except KeyboardInterrupt:
        log.info("🛑 Bot detenido manualmente. ¡Hasta la próxima!")
    except SystemExit:
        raise
    except Exception as error:
        log.error(f"🚨 Fallo fatal en el arranque: {error}")
        log.debug("", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
