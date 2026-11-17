# -*- coding: utf-8 -*-
"""Ciclo de producción: genera videos de un grupo de estilos y los deja en la cola.

La cola es la release de GitHub `cola`: cada video se sube como asset de esa
release, y publicar.py lo consume (lo descarga, lo sube a YouTube y lo borra).
Este módulo NO toca estado_bot.json (publicar es el único escritor).

  ~/.faceless-shorts/venv/bin/python bot/producir.py --grupo prio     # mitad A del turno
  ... --grupo otros        # mitad B del turno
  ... --estilo night-file --cantidad 2    # manual

Rotación igualitaria (1 video por estilo y ciclo, 4 estilos por ciclo, 7 estilos):
  ORDEN = inside-out · deep-dive · night-file · paper-atlas · stick-story · tall-tale · caricatura
  el nº de run elige la ventana de 4; el matrix de producir.yml parte el turno:
  prio → 2 primeros · otros → 2 siguientes. Sin --grupo, produce los 4.
"""
import argparse
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import discord
import pipeline

GRUPOS = {
    "prio": [("inside-out", 1), ("deep-dive", 1)],
    "otros_a": [("night-file", 1), ("paper-atlas", 1)],
    "otros_b": [("stick-story", 1), ("tall-tale", 1), ("caricatura", 1)],
}

# Rotación igualitaria: todos los estilos rotan en rondas de 4 (7 estilos: cada
# uno sale 1 vez cada 7 runs; la ventana completa se repite cada 7 runs).
# run 1 → [inside-out, deep-dive, night-file, paper-atlas] · run 2 → [stick-story, tall-tale, caricatura, inside-out] ...
ORDEN = ["inside-out", "deep-dive", "night-file", "paper-atlas", "stick-story", "tall-tale", "caricatura"]


def rotacion(run, cantidad=4):
    i = ((run - 1) * cantidad) % len(ORDEN)
    return [ORDEN[(i + k) % len(ORDEN)] for k in range(cantidad)]


def _gh(args, timeout=900):
    return subprocess.run(["gh", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def asegurar_cola():
    r = None
    for _ in range(4):
        if _gh(["release", "view", "cola"]).returncode == 0:
            return
        r = _gh(["release", "create", "cola",
                 "--title", "Cola de videos del bot",
                 "--notes", "Cola interna: publicar.py descarga, sube a YouTube y borra cada asset."])
        if r.returncode == 0:
            return
        time.sleep(8)
    raise RuntimeError(f"No se pudo crear/ver la release `cola`: {r.stderr if r else '?'}")


def subir_a_cola(mp4, ruta_meta):
    r = None
    for _ in range(3):
        r = _gh(["release", "upload", "cola", str(mp4), str(ruta_meta), "--clobber"],
                timeout=1200)
        if r.returncode == 0:
            return
        time.sleep(10)
    raise RuntimeError(f"gh release upload falló para {mp4.name}: {r.stderr if r else '?'}")


def _latido(grupo, contadores):
    """Latido en vivo mientras dura la producción (cada 5 min)."""
    while not contadores["fin"]:
        time.sleep(300)
        if contadores["fin"]:
            break
        discord.produccion_viva(grupo, contadores["hechos"], contadores["total"],
                                contadores["fallos"], contadores["actual"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grupo", choices=["prio", "otros"])
    ap.add_argument("--estilo", default=None)
    ap.add_argument("--cantidad", type=int, default=1)
    ap.add_argument("--run", type=int, default=None,
                    help="nº de run para elegir tarjetas (por defecto GITHUB_RUN_NUMBER)")
    a = ap.parse_args()

    run = a.run or int(os.environ.get("GITHUB_RUN_NUMBER", "1") or "1")
    if a.estilo:
        estilos = [(a.estilo, max(1, a.cantidad))]
        grupo = f"manual:{a.estilo}"
    elif a.grupo in ("prio", "otros"):
        # rotación igualitaria: el ciclo toca 4 estilos round-robin y el matrix
        # los reparte en dos mitades (prio = primera, otros = segunda)
        cuatro = rotacion(run)
        estilos = [(s, 1) for s in (cuatro[:2] if a.grupo == "prio" else cuatro[2:])]
        grupo = f"ciclo{run}:{'+'.join(s for s, _ in estilos)}"
    else:
        estilos = [(s, 1) for s in rotacion(run)]
        grupo = "todo"

    t_inicio = time.time()
    discord.ciclo_inicio(grupo, [s for s, _ in estilos])

    contadores = {"fin": False, "hechos": 0, "fallos": 0, "total": sum(n for _, n in estilos),
                  "actual": "arrancando..."}
    threading.Thread(target=_latido, args=(grupo, contadores), daemon=True).start()

    hechos, fallos = 0, 0
    for estilo, n in estilos:
        pool = pipeline.cargar_pool(estilo)
        tarjetas = pool["tarjetas"]
        for i in range(n):
            idx = ((run - 1) * max(1, n) + i) % len(tarjetas)
            tarjeta = tarjetas[idx]
            contadores["actual"] = f"{estilo} · {tarjeta.get('titulo', tarjeta['id'])}"
            t0 = time.time()
            try:
                mp4, ruta_meta = pipeline.producir_video(estilo, tarjeta)
                asegurar_cola()
                subir_a_cola(mp4, ruta_meta)
                peso = mp4.stat().st_size / (1024 * 1024)
                hechos += 1
                contadores["hechos"] = hechos
                discord.video_completo(mp4.name, estilo, tarjeta.get("titulo", ""),
                                       mp4, peso, time.time() - t0)
            except Exception as err:
                fallos += 1
                contadores["fallos"] = fallos
                print(f"[producir] fallo {estilo}/{tarjeta['id']}: {err}", flush=True)
                discord.error(f"Producción: {estilo} · {tarjeta.get('id')}", err)
    contadores["actual"] = "cerrando ciclo..."
    contadores["fin"] = True

    discord.ciclo_fin(grupo, hechos, contadores["total"], time.time() - t_inicio)
    if hechos == 0 and fallos > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
