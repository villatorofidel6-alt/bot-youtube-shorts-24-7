# -*- coding: utf-8 -*-
"""estado_bot.json: contadores, cola y registro de subidos. Sobrevive reinicios.

Solo lo escribe publicar.py (único escritor); producir y latido solo lo leen.
"""
import json
import os
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RUTA = RAIZ / "estado_bot.json"

DEFAULT = {
    "ultimo_upload_ts": 0.0,
    "proximo_upload_ts": 0.0,
    "subidos_total": 0,
    "generados_total": 0,
    "subidos_por_estilo": {},
    "cola": [],
    "subidos_ids": {},
    "ultimo_evento": "",
    "actualizado_ts": 0.0,
}


def cargar():
    try:
        datos = json.loads(RUTA.read_text(encoding="utf-8"))
    except Exception:
        datos = {}
    e = dict(DEFAULT)
    e.update(datos if isinstance(datos, dict) else {})
    return e


def guardar(e):
    e["actualizado_ts"] = time.time()
    tmp = RUTA.with_suffix(".tmp")
    tmp.write_text(json.dumps(e, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, RUTA)


def formato_duracion(segundos):
    segundos = int(max(0, segundos))
    h, resto = divmod(segundos, 3600)
    m, _ = divmod(resto, 60)
    return f"{h}h {m}m" if h else f"{m}m"
