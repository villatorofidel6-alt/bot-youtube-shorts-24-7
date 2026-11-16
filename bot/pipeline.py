# -*- coding: utf-8 -*-
"""Pipeline de render de la skill para UN video:

  tarjeta de la pool → proyecto (plantilla + guionista) → voz Kokoro → words.py
  → capture.mjs check (CHECK OK) → capture.mjs cues → mix.py → capture.mjs video
  → dist/<estilo>_<ts>_<id>.mp4 + .meta.json

Se ejecuta con el python del venv de la skill (Kokoro/Whisper/numpy dentro).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent          # bot_repo
SKILL = RAIZ / "skill"
SCRIPTS = SKILL / "scripts"
GUIONISTA = RAIZ / "guionista" / "guionista.py"
POOLS = RAIZ / "guionista" / "pools"
DIST = RAIZ / "dist"
TRABAJO = RAIZ / "trabajo"

# entorno del render probado (swiftshader ≈2 s/frame en 3D; ~30 min por short)
ENV_CAPTURA = {"FPS": "24", "SOFTWARE_GL": "1", "QS": "&res=0.6&aa=0&shadow=1024"}


def _run(cmd, cwd=None, env=None, timeout=None):
    e = dict(os.environ)
    e.update(env or {})
    p = subprocess.run([str(c) for c in cmd], cwd=str(cwd or RAIZ), env=e,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=timeout)
    salida = (p.stdout or "") + (p.stderr or "")
    cola = "\n".join(salida.strip().splitlines()[-12:])
    if p.returncode != 0:
        raise RuntimeError(f"fallo `{' '.join(str(c) for c in cmd[:3])}` "
                           f"(código {p.returncode}):\n{cola}")
    return salida


def cargar_pool(estilo):
    ruta = POOLS / f"{estilo}.json"
    if not ruta.exists():
        raise RuntimeError(f"no existe la pool del estilo '{estilo}' ({ruta})")
    return json.loads(ruta.read_text(encoding="utf-8"))


def es_slug(texto):
    return re.sub(r"[^a-z0-9]+", "-", str(texto).lower()).strip("-")[:40] or "video"


def producir_video(estilo, tarjeta):
    """tarjeta → dist/<estilo>_<ts>_<id>.mp4 + .meta.json. Devuelve (mp4, meta)."""
    id_trabajo = f"{estilo}_{time.strftime('%Y%m%d_%H%M%S')}_{es_slug(tarjeta.get('id', 'v'))}"
    raiz = TRABAJO / id_trabajo
    raiz.mkdir(parents=True, exist_ok=True)
    proyecto = raiz / "proyecto"

    plantilla = SKILL / "styles" / estilo / "example"
    if not plantilla.exists():
        raise RuntimeError(f"no existe la plantilla del estilo '{estilo}' ({plantilla})")
    if proyecto.exists():
        shutil.rmtree(proyecto, ignore_errors=True)
    shutil.copytree(plantilla, proyecto)
    for nombre in ("data", "renders"):          # datos de la tarjeta de ejemplo: fuera
        d = proyecto / nombre
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
    (proyecto / "data").mkdir()
    (proyecto / "renders").mkdir()

    # el guionista valida la tarjeta y escribe script.json + plan.json + meta.json
    _run([sys.executable, GUIONISTA, "--estilo", estilo,
          "--tarjeta", tarjeta["id"], "--salida", proyecto], timeout=180)

    py = sys.executable
    _run([py, SCRIPTS / "voice.py", proyecto], timeout=1200)
    _run([py, SCRIPTS / "words.py", proyecto], timeout=1800)
    chequeo = _run(["node", "tools/capture.mjs", "check"], cwd=proyecto,
                   env=ENV_CAPTURA, timeout=1200)
    if "CHECK OK" not in chequeo:
        raise RuntimeError(f"el chequeo del motor no imprimió CHECK OK:\n"
                           f"{chequeo[-800:]}")
    _run(["node", "tools/capture.mjs", "cues"], cwd=proyecto, env=ENV_CAPTURA, timeout=1200)
    _run([py, "tools/mix.py", "."], cwd=proyecto, timeout=1200)
    _run(["node", "tools/capture.mjs", "video", "renders/out.mp4"], cwd=proyecto,
         env=ENV_CAPTURA, timeout=7200)

    out = proyecto / "renders" / "out.mp4"
    if not out.exists() or out.stat().st_size < 100_000:
        raise RuntimeError(f"el render no produjo un mp4 válido en {out}")

    DIST.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    nombre = f"{estilo}_{ts}_{es_slug(tarjeta.get('id', 'v'))}.mp4"
    mp4 = DIST / nombre
    shutil.copy2(out, mp4)
    meta = json.loads((proyecto / "meta.json").read_text(encoding="utf-8"))
    meta["estilo"] = estilo
    meta["archivo"] = nombre
    ruta_meta = mp4.with_suffix(".meta.json")
    ruta_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")

    shutil.rmtree(raiz, ignore_errors=True)      # el proyecto de trabajo ya no hace falta
    return mp4, ruta_meta
