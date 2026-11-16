# -*- coding: utf-8 -*-
"""Publicación: 1 subida a YouTube por ejecución (cron cada 2 h).

Flujo:
  1. guardia de 2 h (estado_bot.json)
  2. lista los assets de la release `cola` y elige por peso intercalado
     (inside-out 5 · deep-dive 5 · resto 2) — el estilo con menor proporción subida gana
  3. descarga el video + .meta.json, lo sube a YouTube (API oficial, sin borrar nada)
  4. borra los assets consumidos, actualiza estado_bot.json y lo commitea
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import discord
import estado
import yt

# Rotación igualitaria: todos los estilos valen lo mismo; sale primero el que menos lleva
PESOS = {"inside-out": 1, "deep-dive": 1, "night-file": 1,
         "paper-atlas": 1, "stick-story": 1, "tall-tale": 1}
GAP_SEG = 2 * 3600          # 1 subida cada 2 h exactas
MAX_COLA = 36               # poda: si la cola crece demasiado, se descartan los más viejos
RAIZ = Path(__file__).resolve().parent.parent


def _gh(args, timeout=900):
    return subprocess.run(["gh", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def _git(*args):
    return subprocess.run(["git", *args], cwd=str(RAIZ), capture_output=True,
                          text=True, encoding="utf-8", errors="replace")


def _commit_estado(mensaje):
    _git("config", "user.name", "bot-shorts[bot]")
    _git("config", "user.email", "bot-shorts[bot]@users.noreply.github.com")
    _git("add", "estado_bot.json")
    if _git("diff", "--cached", "--quiet").returncode == 0:
        return
    _git("commit", "-m", mensaje)
    rama = os.environ.get("GITHUB_REF_NAME", "main") or "main"
    for _ in range(3):
        _git("pull", "--rebase", "origin", rama)
        if _git("push", "origin", f"HEAD:{rama}").returncode == 0:
            return
        time.sleep(5)
    print("[publicar] no pude empujar el estado (conflicto); la próxima corrida lo reintentará")


def assets_cola():
    r = _gh(["release", "view", "cola", "--json", "assets",
             "--jq", "[.assets[].name]"], timeout=120)
    if r.returncode != 0:
        return []
    try:
        return json.loads(r.stdout)
    except Exception:
        return []


def elegir_video(videos, subidos_por_estilo, subidos_ids):
    """Intercalado por peso: score = subidos[estilo]/peso[estilo]; gana el menor."""
    def clave(nombre):
        estilo = nombre.split("_", 1)[0]
        if estilo not in PESOS:
            estilo = "inside-out"
        return (subidos_por_estilo.get(estilo, 0) / PESOS[estilo], nombre)
    candidatos = [n for n in videos if n not in subidos_ids]
    if not candidatos:
        candidatos = videos          # todo ya subido antes: reintenta el de menor peso
    return min(candidatos, key=clave)


def refrescar_cola(e):
    nombres = assets_cola()
    e["cola"] = [n for n in nombres if n.endswith(".mp4")]
    e["generados_total"] = e.get("subidos_total", 0) + len(e["cola"])


def podar_cola(nombres):
    """Si la cola crece demasiado, descarta los videos más viejos (con sus metas)."""
    videos = sorted(n for n in nombres if n.endswith(".mp4"))
    sobran = videos[:max(0, len(videos) - MAX_COLA)]
    for nombre in sobran:
        _gh(["release", "delete-asset", "cola", nombre, "-y"])
        _gh(["release", "delete-asset", "cola", nombre[:-4] + ".meta.json", "-y"])
    return len(sobran)


def main():
    e = estado.cargar()
    ahora = time.time()
    if ahora < e.get("proximo_upload_ts", 0):
        print(f"guardia de 2 h: toca subir en "
              f"{estado.formato_duracion(e['proximo_upload_ts'] - ahora)}; salgo.")
        return

    nombres = assets_cola()
    videos = [n for n in nombres if n.endswith(".mp4")]
    if not videos:
        discord.cola_vacia(0)
        print("cola vacía: no hay videos que subir.")
        return

    objetivo = elegir_video(videos, e.get("subidos_por_estilo", {}), e.get("subidos_ids", {}))
    meta_nombre = objetivo[:-4] + ".meta.json"
    d = Path(tempfile.mkdtemp(prefix="publicar_"))
    ruta = d / objetivo
    ultimo = ""
    for intento in range(4):
        # los assets recién subidos tardan ~1 min en ser descargables (consistencia de GitHub)
        r = _gh(["release", "download", "cola", "-p", objetivo, "-D", str(d)], timeout=900)
        if ruta.exists() and ruta.stat().st_size > 0:
            break
        ultimo = (r.stderr or r.stdout or "(sin salida)").strip()[-300:]
        print(f"[publicar] descarga intento {intento + 1} falló: {ultimo}", flush=True)
        time.sleep(25)
    else:
        raise RuntimeError(f"la descarga del asset {objetivo} falló: {ultimo}")
    meta = {}
    if meta_nombre in nombres:
        _gh(["release", "download", "cola", "-p", meta_nombre, "-D", str(d)], timeout=300)
        ruta_meta = d / meta_nombre
        if ruta_meta.exists():
            meta = json.loads(ruta_meta.read_text(encoding="utf-8"))
    if not meta:
        meta = {"titulo": "Short nuevo del canal 🎬",
                "descripcion": "Un short más del canal.",
                "tags": ["shorts"]}
    estilo = meta.get("estilo") or objetivo.split("_", 1)[0] or "desconocido"

    try:
        servicio = yt.crear_servicio()
        video_id = yt.subir_video(servicio, ruta, meta)
    except yt.CuotaDiaria as err:
        e = estado.cargar()
        e["ultimo_evento"] = f"Cuota diaria de YouTube agotada ({err})"
        e["proximo_upload_ts"] = ahora + GAP_SEG
        estado.guardar(e)
        _commit_estado("⏳ cuota diaria agotada: reintento en el próximo hueco")
        discord.error("Cuota diaria de YouTube agotada",
                      f"El video `{objetivo}` se queda en la cola; reintento en el próximo hueco.")
        return
    except yt.VideoInvalido as err:
        _gh(["release", "delete-asset", "cola", objetivo, "-y"])
        if meta_nombre in nombres:
            _gh(["release", "delete-asset", "cola", meta_nombre, "-y"])
        e = estado.cargar()
        e["ultimo_evento"] = f"YouTube rechazó un video ({err})"
        refrescar_cola(e)
        estado.guardar(e)
        _commit_estado("🚫 video inválido descartado de la cola")
        discord.error("YouTube rechazó un video",
                      f"`{objetivo}` ({err}). Lo saqué de la cola y el ciclo sigue.")
        return

    url = f"https://youtube.com/shorts/{video_id}"
    e = estado.cargar()
    e["subidos_total"] = e.get("subidos_total", 0) + 1
    por = e.setdefault("subidos_por_estilo", {})
    por[estilo] = por.get(estilo, 0) + 1
    e.setdefault("subidos_ids", {})[objetivo] = video_id
    e["ultimo_upload_ts"] = ahora
    e["proximo_upload_ts"] = ahora + GAP_SEG
    e["ultimo_evento"] = f"Subido: {meta.get('titulo', objetivo)}"
    refrescar_cola(e)
    estado.guardar(e)

    _gh(["release", "delete-asset", "cola", objetivo, "-y"])
    if meta_nombre in nombres:
        _gh(["release", "delete-asset", "cola", meta_nombre, "-y"])
    _commit_estado(f"🚀 subido #{e['subidos_total']} ({estilo})")
    podar_cola([a for a in assets_cola()])
    discord.subido(url, meta.get("titulo", ""), estilo, e["subidos_total"])
    print(f"subido {objetivo} → {url}")


if __name__ == "__main__":
    main()
