# -*- coding: utf-8 -*-
"""Discord vía webhook: mensajes, embeds y latidos en español.

Nunca rompe el flujo del bot: si el webhook no responde, se registra y se sigue.
"""
import json
import os
import time
import urllib.request

WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
BOT_NAME = "Bot YouTube Shorts"

AZUL = 0x3498DB      # informativo
VERDE = 0x2ECC71     # éxito
ROJO = 0xE74C3C      # error
NARANJA = 0xF39C12   # aviso
GRIS = 0x95A5A6      # latidos


def _post(payload, intentos=2):
    if not WEBHOOK:
        print("[discord] (sin webhook) " + json.dumps(payload, ensure_ascii=False)[:200])
        return False
    datos = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for i in range(intentos):
        try:
            peticion = urllib.request.Request(
                WEBHOOK, data=datos,
                headers={"Content-Type": "application/json; charset=utf-8",
                         "User-Agent": "Mozilla/5.0 (compatible; BotShorts/2.0)"})
            with urllib.request.urlopen(peticion, timeout=20) as r:
                r.read()
            return True
        except Exception as e:
            print(f"[discord] intento {i + 1} fallo: {e}")
            time.sleep(3)
    return False


def log(mensaje):
    """Mensaje plano (máx ~1900 caracteres)."""
    return _post({"username": BOT_NAME, "content": str(mensaje)[:1900]})


def embed(titulo, campos=None, color=AZUL, descripcion=None):
    """Embed: campos = [(nombre, valor, inline), ...]."""
    e = {"title": str(titulo)[:256], "color": color,
         "footer": {"text": BOT_NAME},
         "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if descripcion:
        e["description"] = str(descripcion)[:4000]
    if campos:
        e["fields"] = [{"name": str(n)[:256], "value": str(v)[:1000], "inline": bool(i)}
                       for n, v, i in campos[:25]]
    return _post({"username": BOT_NAME, "embeds": [e]})


# ------------------------------------------------------------------ #
# Eventos del bot
# ------------------------------------------------------------------ #

def ciclo_inicio(grupo, estilos):
    return embed("🏭 Producción iniciada", [
        ("Grupo", grupo, True),
        ("Estilos", ", ".join(estilos), True),
        ("Objetivo", "1 video por estilo", True),
    ], AZUL)


def ciclo_fin(grupo, hechos, total, segundos):
    return embed("✅ Ciclo de producción terminado", [
        ("Videos listos", f"{hechos}/{total}", True),
        ("Tiempo", f"{segundos / 60:.0f} min", True),
        ("Grupo", str(grupo), True),
    ], VERDE if hechos == total else NARANJA)


def video_listo(nombre, estilo, titulo, peso_mb, segundos):
    return embed("🎬 Video generado", [
        ("Estilo", estilo, True),
        ("Título", titulo, False),
        ("Archivo", f"`{nombre}`", True),
        ("Peso", f"{peso_mb:.1f} MB", True),
        ("Producción", f"{segundos / 60:.1f} min", True),
    ], VERDE)


def produccion_viva(grupo, hechos, total, fallos, actual):
    return embed("🛠 Producción en curso", [
        ("Grupo", str(grupo), True),
        ("Listos", f"{hechos}/{total}", True),
        ("Fallos", str(fallos), True),
        ("En proceso", str(actual), False),
    ], GRIS)


def subido(url, titulo, estilo, n):
    return embed("🚀 Short subido a YouTube", [
        ("Título", titulo or "(sin título)", False),
        ("Estilo", estilo, True),
        ("Subido nº", str(n), True),
        ("Link", url, False),
    ], VERDE)


def error(contexto, detalle):
    return embed("⚠️ Error", [
        ("Contexto", str(contexto), True),
        ("Detalle", str(detalle)[:900], False),
    ], ROJO)


def cola_vacia(en_cola):
    return embed("📥 Cola vacía", [
        ("Estado", "Sin videos en la cola; no se sube nada esta vez.", False),
        ("Esperando producción", str(en_cola) + " archivo(s) sueltos", True),
    ], NARANJA)


def latido(e, proximo, actualizado, en_cola):
    return embed("💓 Bot vivo", [
        ("Cola", f"{en_cola} video(s)", True),
        ("Subidos (total)", str(e.get("subidos_total", 0)), True),
        ("Próx. subida", proximo, True),
        ("Último evento", e.get("ultimo_evento") or "—", False),
        ("Estado actualizado", actualizado, True),
    ], GRIS)
