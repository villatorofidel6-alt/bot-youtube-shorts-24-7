# -*- coding: utf-8 -*-
"""Latido: lee estado_bot.json y manda el embed de vida a Discord (cron cada 5 min).

  python bot/latido.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import discord
import estado


def main():
    if not discord.WEBHOOK:
        print("sin DISCORD_WEBHOOK_URL; nada que hacer")
        return
    e = estado.cargar()
    ahora = time.time()
    restante = e.get("proximo_upload_ts", 0) - ahora
    proximo = estado.formato_duracion(restante) if restante > 0 else "listo para subir"
    desde = e.get("actualizado_ts", 0)
    actualizado = f"hace {estado.formato_duracion(ahora - desde)}" if desde else "nunca"
    discord.latido(e, proximo, actualizado, len(e.get("cola", [])))
    print(f"latido enviado: cola={len(e.get('cola', []))} proximo={proximo}")


if __name__ == "__main__":
    main()
