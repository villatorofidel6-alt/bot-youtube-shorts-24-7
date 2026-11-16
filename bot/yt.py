# -*- coding: utf-8 -*-
"""Autenticación OAuth y subida a YouTube (API oficial, resumable).

Este módulo SOLO sube: no existe ninguna función de borrado de videos.
Las credenciales llegan como secretos base64 (CLIENT_SECRET_B64 y
TOKEN_PICKLE_B64) y se decodifican a archivos temporales.

Regenerar el token localmente (cuando el refresh falla):
  python bot/yt.py --autorizar     → pega la salida en el secreto TOKEN_PICKLE_B64
"""
import base64
import json
import os
import pickle
import socket
import tempfile
import time
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.force-ssl"]

TMP = Path(tempfile.gettempdir())


class CuotaDiaria(Exception):
    pass


class VideoInvalido(Exception):
    pass


def preparar_credenciales():
    cs = os.environ.get("CLIENT_SECRET_B64", "").strip()
    tp = os.environ.get("TOKEN_PICKLE_B64", "").strip()
    if not cs or not tp:
        raise RuntimeError("Faltan los secretos CLIENT_SECRET_B64 o TOKEN_PICKLE_B64")
    ruta_secret = TMP / "bot_client_secret.json"
    ruta_token = TMP / "bot_token.pickle"
    ruta_secret.write_bytes(base64.b64decode(cs))
    ruta_token.write_bytes(base64.b64decode(tp))
    return ruta_secret, ruta_token


def obtener_credenciales():
    """Credenciales del pickle; en CI no hay navegador: refresh o error claro."""
    from google.auth.transport.requests import Request

    ruta_secret, ruta_token = preparar_credenciales()
    creds = None
    try:
        with open(ruta_token, "rb") as f:
            creds = pickle.load(f)
    except Exception as e:
        raise RuntimeError(f"token.pickle ilegible ({e}); regenera TOKEN_PICKLE_B64") from e
    if creds is None:
        raise RuntimeError("token.pickle vacío; regenera TOKEN_PICKLE_B64")
    if creds.valid:
        return creds
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(ruta_token, "wb") as f:
                pickle.dump(creds, f)
            return creds
        except Exception as e:
            raise RuntimeError(
                "El token de YouTube está vencido y el refresh falló. Ejecuta en tu PC "
                "`python bot/yt.py --autorizar` y actualiza el secreto TOKEN_PICKLE_B64.") from e
    raise RuntimeError("token.pickle sin credenciales válidas; regenera TOKEN_PICKLE_B64")


def crear_servicio():
    from googleapiclient.discovery import build
    return build("youtube", "v3", credentials=obtener_credenciales())


def razon_error(http_error):
    try:
        datos = json.loads(http_error.content.decode("utf-8"))
        errores = datos.get("error", {}).get("errors", [])
        if errores:
            return str(errores[0].get("reason", ""))
    except Exception:
        pass
    return ""


def subir_video(servicio, ruta_video, meta):
    """Subida resumable; devuelve el id del video. Lanza CuotaDiaria / VideoInvalido."""
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    cuerpo = {
        "snippet": {
            "title": str(meta.get("titulo", "Short nuevo"))[:100],
            "description": str(meta.get("descripcion", ""))[:4900],
            "tags": [str(t) for t in meta.get("tags", [])][:30],
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
                    print(f"   ⏫ subida al {progreso}%...", flush=True)
        except HttpError as error:
            razon = razon_error(error)
            if razon in ("quotaExceeded", "dailyLimitExceeded",
                         "uploadLimitExceeded", "rateLimitExceeded"):
                raise CuotaDiaria(razon) from error
            if error.resp.status == 400:
                raise VideoInvalido(razon or "invalidRequest") from error
            if error.resp.status in (500, 502, 503, 504):
                print("   ⚠️ YouTube con problemas; reintentando en 30 s...", flush=True)
                time.sleep(30)
                continue
            raise
        except (OSError, socket.timeout, TimeoutError, ConnectionError) as error:
            print(f"   ⚠️ red inestable ({error}); reanudando en 20 s...", flush=True)
            time.sleep(20)
    return respuesta["id"]


def autorizar():
    """Local: abre el navegador, guarda token.pickle e imprime el nuevo TOKEN_PICKLE_B64."""
    from google_auth_oauthlib.flow import InstalledAppFlow

    cs = os.environ.get("CLIENT_SECRET_B64", "").strip()
    local = Path("client_secret.json")
    if cs:
        ruta_secret = TMP / "auto_client_secret.json"
        ruta_secret.write_bytes(base64.b64decode(cs))
    elif local.exists():
        ruta_secret = local
    else:
        raise SystemExit("Necesito CLIENT_SECRET_B64 (entorno) o un client_secret.json local")
    flow = InstalledAppFlow.from_client_secrets_file(str(ruta_secret), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")
    print("TOKEN_OK (copia esta línea COMPLETA en el secreto TOKEN_PICKLE_B64):")
    print(base64.b64encode(pickle.dumps(creds)).decode("ascii"))


if __name__ == "__main__":
    import sys
    if "--autorizar" in sys.argv:
        autorizar()
    else:
        print("uso: python bot/yt.py --autorizar")
