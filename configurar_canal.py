# -*- coding: utf-8 -*-
"""
=====================================================================
 MARCA DEL CANAL: genera avatar + banner y aplica nombre/descripción
=====================================================================
 Uso:
   python configurar_canal.py            (genera imágenes y las aplica)
   python configurar_canal.py --solo-imagenes   (sólo genera PNG)

 La API de YouTube SÍ permite: título, descripción y banner.
 La API NO permite: foto de perfil (avatar) ni handle/usuario ->
 esos dos se cambian a mano en studio.youtube.com (te lo recuerdo).
=====================================================================
"""
from __future__ import annotations

import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
FOTO = BASE / "foto_canal.png"
BANNER = BASE / "banner_canal.png"

NOMBRE_CANAL = "Reglas del Pueblo"
DESCRIPCION = (
    "👻 Historias de terror sobre las REGLAS de los pueblos de Roblox.\n"
    "🌙 Cada historia es una advertencia: NUNCA rompas las reglas del pueblo.\n"
    "🎬 Videos nuevos cada pocas horas, todos los días.\n"
    "⚠️ Suscríbete y activa la campana… pero no vuelvas al pueblo después de medianoche.\n"
    "\n"
    "#roblox #terror #reglasdelpueblo #historiasdeterror #shorts"
)
KEYWORDS = "roblox, terror, historias de terror, reglas, pueblos, shorts, creepypasta"


# ------------------------------------------------------------------ #
# generación de imágenes (PIL, estilo del bot)
# ------------------------------------------------------------------ #
def _fuente(tam: int):
    from main import buscar_fuente
    from PIL import ImageFont
    return ImageFont.truetype(buscar_fuente(), tam)


def _dibujo_pueblo(d, w, h, escala: float = 1.0, y_base: float = 0.82):
    """Casitas blocky silueta + caminante."""
    import random as rd
    rng = rd.Random(7)
    horizonte = int(h * y_base)
    d.rectangle((0, horizonte, w, h), fill=(14, 12, 24))
    x_cur = 0.0
    while x_cur < w:
        ancho_c = rng.uniform(0.10, 0.16) * w
        alto_c = rng.uniform(0.10, 0.20) * h * escala
        d.rectangle((x_cur, horizonte - alto_c, x_cur + ancho_c, horizonte),
                    fill=(20, 17, 32), outline=(5, 5, 10), width=2)
        d.polygon([(x_cur - 2, horizonte - alto_c),
                   (x_cur + ancho_c + 2, horizonte - alto_c),
                   (x_cur + ancho_c / 2, horizonte - alto_c - 0.05 * h)],
                  fill=(14, 12, 24))
        for _ in range(rng.randint(1, 2)):
            wx = rng.uniform(x_cur + 6, x_cur + ancho_c - 0.02 * w)
            wy = rng.uniform(horizonte - alto_c + 6, horizonte - 0.03 * h)
            d.rectangle((wx, wy, wx + 0.012 * w, wy + 0.018 * h), fill=(255, 210, 120))
        x_cur += ancho_c * rng.uniform(0.8, 0.98)
    return horizonte


def generar_foto() -> None:
    from PIL import Image, ImageDraw, ImageFilter
    w = h = 800
    img = Image.new("RGB", (w, h))
    y = Image.linear_gradient("L").resize((1, h))
    arriba = (10, 12, 30)
    abajo = (36, 24, 52)
    px = img.load()
    for fila in range(h):
        f = fila / (h - 1)
        r = int(arriba[0] + (abajo[0] - arriba[0]) * f)
        g = int(arriba[1] + (abajo[1] - arriba[1]) * f)
        b = int(arriba[2] + (abajo[2] - arriba[2]) * f)
        for col in range(w):
            px[col, fila] = (r, g, b)
    d = ImageDraw.Draw(img)
    import random as rd
    rng = rd.Random(3)
    for _ in range(60):
        sx, sy = rng.uniform(0, w), rng.uniform(0, h * 0.7)
        r = rng.uniform(0.8, 1.8)
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(210, 216, 250))
    mx, my, mr = w * 0.70, h * 0.24, h * 0.13
    for k, a in ((2.4, 22), (1.7, 40)):
        halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse((mx - mr * k, my - mr * k, mx + mr * k, my + mr * k),
                                     fill=(205, 215, 255, a))
        img.paste(Image.alpha_composite(img.convert("RGBA"), halo).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(238, 240, 216))
    d.ellipse((mx - mr * 0.35, my - mr * 0.4, mx + mr * 0.05, my), fill=(219, 222, 198))
    _dibujo_pueblo(d, w, h, escala=1.0, y_base=0.78)
    # caminante blocky (silueta)
    u = h * 0.155 / 100.0
    cx = w * 0.50
    base_y = h * 0.80
    d.rounded_rectangle((cx - 11 * u, base_y - 31 * u, cx - 3 * u, base_y),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx + 3 * u, base_y - 31 * u, cx + 11 * u, base_y),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx - 16 * u, base_y - 65 * u, cx + 16 * u, base_y - 30 * u),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx - 15 * u, base_y - 92 * u, cx + 15 * u, base_y - 66 * u),
                        radius=4 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    # viñeta
    oscuro = Image.new("L", (w, h), 0)
    ImageDraw.Draw(oscuro).ellipse((-w * 0.35, -h * 0.35, w * 1.35, h * 1.35), fill=255)
    oscuro = oscuro.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(img, Image.new("RGB", (w, h), (6, 6, 12)), oscuro)
    # texto
    d = ImageDraw.Draw(img)
    f1 = _fuente(int(h * 0.115))
    f2 = _fuente(int(h * 0.075))
    for texto, fuente, yy in (("REGLAS", f1, h * 0.30), ("DEL PUEBLO", f2, h * 0.445)):
        caja = d.textbbox((0, 0), texto, font=fuente)
        ancho_t = caja[2] - caja[0]
        x = (w - ancho_t) / 2
        for off in (-3, 3):
            d.text((x + off, yy + off), texto, font=fuente, fill=(0, 0, 0))
        d.text((x, yy), texto, font=fuente, fill=(255, 255, 255))
    img.save(FOTO)
    print(f"🖼️ avatar generado: {FOTO}")


def generar_banner() -> None:
    from PIL import Image, ImageDraw, ImageFilter
    w, h = 2560, 1440
    img = Image.new("RGB", (w, h), (10, 12, 30))
    d = ImageDraw.Draw(img)
    import random as rd
    rng = rd.Random(11)
    for _ in range(140):
        sx, sy = rng.uniform(0, w), rng.uniform(0, h * 0.65)
        r = rng.uniform(1, 2.6)
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(205, 212, 248))
    mx, my, mr = w * 0.78, h * 0.24, h * 0.10
    for k, a in ((2.6, 20), (1.8, 38)):
        halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse((mx - mr * k, my - mr * k, mx + mr * k, my + mr * k),
                                     fill=(205, 215, 255, a))
        img.paste(Image.alpha_composite(img.convert("RGBA"), halo).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(238, 240, 216))
    d.ellipse((mx - mr * 0.35, my - mr * 0.4, mx + mr * 0.05, my), fill=(219, 222, 198))
    _dibujo_pueblo(d, w, h, escala=1.5, y_base=0.92)
    # caminante central
    u = h * 0.24 / 100.0
    cx, base_y = w * 0.5, h * 0.94
    d.rounded_rectangle((cx - 11 * u, base_y - 31 * u, cx - 3 * u, base_y),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx + 3 * u, base_y - 31 * u, cx + 11 * u, base_y),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx - 16 * u, base_y - 65 * u, cx + 16 * u, base_y - 30 * u),
                        radius=3 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    d.rounded_rectangle((cx - 15 * u, base_y - 92 * u, cx + 15 * u, base_y - 66 * u),
                        radius=4 * u, fill=(16, 14, 26), outline=(4, 4, 8), width=2)
    oscuro = Image.new("L", (w, h), 0)
    ImageDraw.Draw(oscuro).ellipse((-w * 0.3, -h * 0.3, w * 1.3, h * 1.3), fill=255)
    oscuro = oscuro.filter(ImageFilter.GaussianBlur(200))
    img = Image.composite(img, Image.new("RGB", (w, h), (6, 6, 12)), oscuro)
    d = ImageDraw.Draw(img)
    f1 = _fuente(int(h * 0.13))
    f2 = _fuente(int(h * 0.055))
    for texto, fuente, yy in (("REGLAS DEL PUEBLO", f1, h * 0.33),):
        caja = d.textbbox((0, 0), texto, font=fuente)
        x = (w - (caja[2] - caja[0])) / 2
        for off in (-4, 4):
            d.text((x + off, yy + off), texto, font=fuente, fill=(0, 0, 0))
        d.text((x, yy), texto, font=fuente, fill=(255, 255, 255))
    sub = "Historias de terror de Roblox · videos nuevos cada pocas horas"
    caja = d.textbbox((0, 0), sub, font=f2)
    x = (w - (caja[2] - caja[0])) / 2
    for off in (-2, 2):
        d.text((x + off, h * 0.485 + off), sub, font=f2, fill=(0, 0, 0))
    d.text((x, h * 0.485), sub, font=f2, fill=(230, 225, 245))
    img.save(BANNER)
    print(f"🖼️ banner generado: {BANNER}")


# ------------------------------------------------------------------ #
# aplicación vía API oficial
# ------------------------------------------------------------------ #
def aplicar() -> None:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    from main import obtener_credenciales

    servicio = build("youtube", "v3", credentials=obtener_credenciales())
    canal = servicio.channels().list(part="brandingSettings,snippet", mine=True).execute()
    items = canal.get("items", [])
    if not items:
        raise RuntimeError("No se encontró el canal de la cuenta autorizada.")
    id_canal = items[0]["id"]
    nombre_actual = items[0]["snippet"].get("title", "?")
    print(f"📺 Canal: {nombre_actual} ({id_canal})")

    branding = items[0].get("brandingSettings", {})
    branding.setdefault("channel", {})
    branding["channel"]["title"] = NOMBRE_CANAL
    branding["channel"]["description"] = DESCRIPCION
    branding["channel"]["keywords"] = KEYWORDS
    servicio.channels().update(part="brandingSettings", body={
        "id": id_canal, "brandingSettings": branding}).execute()
    print("✅ Nombre y descripción aplicados.")

    if BANNER.exists():
        media = MediaFileUpload(str(BANNER), mimetype="image/png")
        resp = servicio.channelBanners().insert(media_body=media).execute()
        url = resp.get("url")
        branding["image"] = branding.get("image", {})
        branding["image"]["bannerExternalUrl"] = url
        servicio.channels().update(part="brandingSettings", body={
            "id": id_canal, "brandingSettings": branding}).execute()
        print("✅ Banner subido y vinculado.")
    print("⚠️ La foto de perfil y el handle se cambian a mano en "
          "studio.youtube.com (Personalización).")


def main() -> None:
    if sys.stdout is not None:
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    solo = "--solo-imagenes" in sys.argv
    generar_foto()
    generar_banner()
    if not solo:
        aplicar()


if __name__ == "__main__":
    main()
