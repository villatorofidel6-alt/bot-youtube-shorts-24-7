# -*- coding: utf-8 -*-
"""
=====================================================================
 ESCENAS ANIMADAS PROCEDURALES (estilo Roblox nocturno, sin assets)
=====================================================================
 Cada escena = fondo dibujado con PIL + capas animadas por cuadro:
 nubes a la deriva, niebla flotante, ventanas/faroles que parpadean,
 muñecos blocky que caminan, sombras que respiran, columpios que se
 mecen, linterna que barre el bosque... y cámara con paneo + zoom.
 Todo procedural: cero archivos externos, funciona igual en tu PC
 y en GitHub Actions.
=====================================================================
"""
from __future__ import annotations

import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# dimensiones (las fija main.py vía configurar())
ANCHO, ALTO, FPS = 720, 1280, 30
ESW, ESH = int(ANCHO * 1.35), int(ALTO * 1.35)   # lienzo grande para paneo
DESVANECIMIENTO = 1.2                            # fundido entre escenas (s)


def configurar(ancho: int, alto: int, fps: int) -> None:
    global ANCHO, ALTO, FPS, ESW, ESH
    ANCHO, ALTO, FPS = ancho, alto, fps
    ESW, ESH = int(ANCHO * 1.35), int(ALTO * 1.35)


# ------------------------------------------------------------------ #
# utilidades de dibujo
# ------------------------------------------------------------------ #
def _degradado(arriba, abajo) -> Image.Image:
    y = np.linspace(0.0, 1.0, ESH, dtype=np.float32)[:, None, None]
    color = ((1.0 - y) * np.array(arriba, np.float32)[None, None, :]
             + y * np.array(abajo, np.float32)[None, None, :])
    arr = np.repeat(color, ESW, axis=1)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def _vineta(img: Image.Image, fuerza: float = 0.48) -> Image.Image:
    xx = np.linspace(-1, 1, img.width, dtype=np.float32)[None, :]
    yy = np.linspace(-1, 1, img.height, dtype=np.float32)[:, None]
    dist = np.sqrt(xx * xx + yy * yy)
    osc = 1.0 - fuerza * np.clip(dist / 1.25, 0, 1)
    arr = np.asarray(img).astype(np.float32) * osc[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def _rgba(tam, dibujo, desenfoque: float = 0.0) -> Image.Image:
    capa = Image.new("RGBA", tam, (0, 0, 0, 0))
    dibujo(ImageDraw.Draw(capa))
    if desenfoque:
        capa = capa.filter(ImageFilter.GaussianBlur(desenfoque))
    return capa


def _pegar(img: Image.Image, capa: Image.Image, x: float, y: float,
           alfa: float = 1.0) -> None:
    """Pega un sprite RGBA (con atenuación opcional de brillo)."""
    if alfa <= 0.02:
        return
    if alfa < 0.995:
        capa = capa.point(lambda v: int(v * alfa))
    img.paste(capa, (int(x), int(y)), capa)


def _cielo_noche(base: Image.Image, rng, con_luna: bool = True):
    """Estrellas + luna con halo + nubes. Devuelve (titilantes, nubes)."""
    d = ImageDraw.Draw(base)
    horizonte = int(ESH * 0.58)
    titilantes = []
    for _ in range(70):
        x = rng.uniform(0, ESW)
        y = rng.uniform(0, horizonte * 0.9)
        r = rng.uniform(0.8, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(212, 218, 250))
    for _ in range(3):
        titilantes.append((rng.uniform(0.05, 0.95) * ESW,
                           rng.uniform(0.03, 0.35) * ESH,
                           rng.uniform(2.0, 4.0), rng.uniform(0, 6.3)))
    if con_luna:
        mx, my, mr = ESW * 0.72, ESH * 0.14, ESH * 0.065
        for k, a in ((2.0, 5), (1.6, 9), (1.25, 14)):
            halo = Image.new("RGBA", base.size, (0, 0, 0, 0))
            ImageDraw.Draw(halo).ellipse(
                (mx - mr * k, my - mr * k, mx + mr * k, my + mr * k),
                fill=(205, 215, 255, a))
            base.paste(
                Image.alpha_composite(base.convert("RGBA"), halo).convert("RGB"),
                (0, 0))
        dd = ImageDraw.Draw(base)
        dd.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(238, 240, 216))
        dd.ellipse((mx - mr * 0.35, my - mr * 0.40, mx + mr * 0.05, my), fill=(219, 222, 198))
        dd.ellipse((mx + mr * 0.10, my + mr * 0.15, mx + mr * 0.50, my + mr * 0.55), fill=(219, 222, 198))
    nubes = [(_sprite_nube(int(ESW * 0.40)), rng.uniform(0, ESW),
              rng.uniform(ESH * 0.04, ESH * 0.18), rng.uniform(5, 10))
             for _ in range(3)]
    return titilantes, nubes


# ------------------------------------------------------------------ #
# sprites reutilizables
# ------------------------------------------------------------------ #
def _sprite_nube(ancho: int) -> Image.Image:
    alto = int(ancho * 0.32)
    rng = random.Random(random.randrange(2 ** 31))

    def dib(d):
        for _ in range(9):
            cx = rng.uniform(0.18, 0.82) * ancho
            cy = rng.uniform(0.35, 0.65) * alto
            r = rng.uniform(0.13, 0.26) * ancho
            d.ellipse((cx - r, cy - r * 0.52, cx + r, cy + r * 0.52),
                      fill=(13, 15, 28, 150))
    return _rgba((ancho, alto), dib, 6)


def _sprite_niebla(ancho: int, tinte=(150, 158, 190)) -> Image.Image:
    alto = max(40, int(ancho * 0.16))
    rng = random.Random(random.randrange(2 ** 31))

    def dib(d):
        for _ in range(max(4, int(ancho / 34))):
            cx = rng.uniform(0.10, 0.90) * ancho
            cy = rng.uniform(0.35, 0.65) * alto
            rx = rng.uniform(0.08, 0.18) * ancho
            ry = rx * rng.uniform(0.20, 0.36)
            d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry),
                      fill=(*tinte, rng.randint(10, 26)))
    return _rgba((ancho, alto), dib, 12)


def _sprite_cono(ancho: int, alto: int, color=(255, 228, 150),
                 alfa: int = 55) -> Image.Image:
    def dib(d):
        d.polygon([(ancho * 0.5, 0), (ancho * 0.02, alto), (ancho * 0.98, alto)],
                  fill=(*color, alfa))
    return _rgba((ancho, alto), dib, 9)


def _sprite_brillo(ancho: int, alto: int, color=(255, 224, 130),
                   alfa: int = 210) -> Image.Image:
    def dib(d):
        d.rounded_rectangle((0, 0, ancho - 1, alto - 1),
                            radius=max(2, min(ancho, alto) // 4),
                            fill=(*color, alfa))
    return _rgba((ancho, alto), dib, 3)


def _sprite_ojos(escala: float = 1.0) -> Image.Image:
    a = int(14 * escala)

    def dib(d):
        d.ellipse((0, 0, a, a * 0.70), fill=(255, 240, 160, 255))
        d.ellipse((a + int(3 * escala), 0, 2 * a + int(3 * escala), a * 0.70),
                  fill=(255, 240, 160, 255))
    return _rgba((2 * a + int(3 * escala), a), dib, 2)


# --- paleta del protagonista (chico joven, ropa de calle) --- #
PIEL = (176, 122, 84)        # moreno claro
PELO = (16, 14, 18)          # negro
SUDADERA = (42, 52, 86)      # hoodie azul marino
JEAN = (58, 82, 124)         # jeans de mezclilla
TENIS = (238, 236, 230)      # zapatos blancos


def _sprite_personaje(altura_px: int, pose: int = 0, de_espaldas: bool = True,
                      expresion: str = "neutro") -> Image.Image:
    """PROTAGONISTA: chico joven Roblox R6 — moreno claro, pelo negro
    (puntas en la frente), sudadera con capucha, jeans y tenis blancos.
    pose 0..3 = ciclo de caminata. expresion: feliz|neutro|preocupado.
    Lienzo de 100u de ancho (50u = centro), pies en el borde inferior."""
    u = altura_px / 100.0
    ancho = int(100 * u)
    alto_c = altura_px + int(12 * u)
    oy = 12 * u                      # margen superior para el pelo
    contorno = (14, 12, 16, 255)
    g = max(1, int(1.4 * u))
    sep = (2.0, 5.5, 2.0, 5.5)[pose % 4] * u
    bam = (0.0, 3.0, 0.0, -3.0)[pose % 4] * u

    def dib(d):
        # piernas: jeans con dobladillo
        d.rounded_rectangle((50 * u - 12 * u - sep, oy + 65 * u,
                             50 * u - 3.5 * u - sep, oy + 90 * u),
                            radius=2.5 * u, fill=JEAN, outline=contorno, width=g)
        d.rounded_rectangle((50 * u + 3.5 * u + sep, oy + 65 * u,
                             50 * u + 12 * u + sep, oy + 90 * u),
                            radius=2.5 * u, fill=JEAN, outline=contorno, width=g)
        # tenis blancos con suela oscura (uno por pierna)
        d.rounded_rectangle((50 * u - 13.5 * u - sep, oy + 88 * u,
                             50 * u - 2.5 * u - sep, oy + 97 * u),
                            radius=2.5 * u, fill=TENIS, outline=contorno, width=g)
        d.line((50 * u - 13.5 * u - sep, oy + 92.5 * u,
                50 * u - 2.5 * u - sep, oy + 92.5 * u),
               fill=(70, 66, 62, 255), width=g)
        d.rounded_rectangle((50 * u + 2.5 * u + sep, oy + 88 * u,
                             50 * u + 13.5 * u + sep, oy + 97 * u),
                            radius=2.5 * u, fill=TENIS, outline=contorno, width=g)
        d.line((50 * u + 2.5 * u + sep, oy + 92.5 * u,
                50 * u + 13.5 * u + sep, oy + 92.5 * u),
               fill=(70, 66, 62, 255), width=g)
        # brazos: mangas de la sudadera (solapadas al torso) + manos de piel
        for lado, bam_l in ((-1, bam), (1, -bam)):
            xa, xb = sorted((50 * u + lado * 13 * u, 50 * u + lado * 23 * u))
            d.rounded_rectangle((xa, oy + 32 * u + bam_l, xb, oy + 58 * u + bam_l * 0.5),
                                radius=2.5 * u, fill=SUDADERA, outline=contorno,
                                width=g)
            d.rounded_rectangle((xa, oy + 56 * u + bam_l * 0.5, xb,
                                 oy + 65 * u + bam_l * 0.5), radius=2 * u, fill=PIEL,
                                outline=contorno, width=g)
        # torso: sudadera con capucha
        d.rounded_rectangle((50 * u - 17 * u, oy + 31 * u, 50 * u + 17 * u, oy + 67 * u),
                            radius=4 * u, fill=SUDADERA, outline=contorno,
                            width=max(g, int(1.5 * u)))
        if not de_espaldas:
            # bolsillo canguro + cordones blancos (solo de frente)
            d.rounded_rectangle((50 * u - 10 * u, oy + 52 * u, 50 * u + 10 * u, oy + 66 * u),
                                radius=3 * u, fill=tuple(max(0, c - 14) for c in SUDADERA),
                                outline=contorno, width=g)
            d.line((50 * u - 5 * u, oy + 36 * u, 50 * u - 5 * u, oy + 46 * u),
                   fill=(238, 236, 230, 255), width=max(1, int(1.6 * u)))
            d.line((50 * u + 5 * u, oy + 36 * u, 50 * u + 5 * u, oy + 46 * u),
                   fill=(238, 236, 230, 255), width=max(1, int(1.6 * u)))
        # cabeza grande redondeada (piel morena clara)
        d.rounded_rectangle((50 * u - 17 * u, oy + 2 * u, 50 * u + 17 * u, oy + 33 * u),
                            radius=7 * u, fill=PIEL, outline=contorno,
                            width=max(g, int(1.6 * u)))
        # orejas
        for lado in (-1, 1):
            ex0, ex1 = sorted((50 * u + lado * 17 * u, 50 * u + lado * 21 * u))
            d.rounded_rectangle((ex0, oy + 15 * u, ex1, oy + 22 * u), radius=2 * u,
                                fill=PIEL, outline=contorno, width=g)
        # PELO NEGRO con puntas sobre la frente (vista frontal)
        if not de_espaldas:
            picos = [(-17, 6), (-12, 10), (-7, 7), (-2, 11), (3, 8), (8, 11), (13, 8), (17, 6)]
            d.polygon([(50 * u - 17.5 * u, oy + 3 * u), (50 * u + 17.5 * u, oy + 3 * u)]
                      + [(50 * u + px * u, oy + (9 + py * 0.28) * u) for px, py in picos],
                      fill=(*PELO, 255))
            d.rounded_rectangle((50 * u - 18 * u, oy - 2 * u, 50 * u + 18 * u, oy + 10 * u),
                                radius=6 * u, fill=(*PELO, 255), outline=contorno, width=g)
        else:
            # vista trasera: melena completa
            d.rounded_rectangle((50 * u - 18 * u, oy - 2 * u, 50 * u + 18 * u, oy + 20 * u),
                                radius=7 * u, fill=(*PELO, 255), outline=contorno, width=g)
            d.line((50 * u - 13 * u, oy + 8 * u, 50 * u - 13 * u, oy + 18 * u),
                   fill=(36, 32, 40, 255), width=g)
            d.line((50 * u + 13 * u, oy + 8 * u, 50 * u + 13 * u, oy + 18 * u),
                   fill=(36, 32, 40, 255), width=g)
        # cara
        if not de_espaldas:
            for ox in (-7.5, 7.5):
                d.ellipse((50 * u + ox * u - 2.6 * u, oy + 14 * u,
                           50 * u + ox * u + 2.6 * u, oy + 20.5 * u), fill=(22, 18, 22, 255))
                d.ellipse((50 * u + ox * u - 1.0 * u, oy + 15 * u,
                           50 * u + ox * u + 0.8 * u, oy + 17 * u), fill=(245, 244, 240, 255))
            if expresion == "feliz":
                d.arc((50 * u - 5 * u, oy + 19 * u, 50 * u + 5 * u, oy + 28 * u), 10, 170,
                      fill=(70, 44, 38, 255), width=max(1, int(1.7 * u)))
            elif expresion == "preocupado":
                d.arc((50 * u - 5 * u, oy + 24 * u, 50 * u + 5 * u, oy + 30 * u), 195, 345,
                      fill=(70, 44, 38, 255), width=max(1, int(1.7 * u)))
                for ox in (-7.5, 7.5):
                    d.line((50 * u + (ox - 2.5) * u, oy + 12.4 * u,
                            50 * u + (ox + 2.5) * u, oy + 13.4 * u),
                           fill=(60, 40, 32, 255), width=max(1, int(1.5 * u)))
            else:
                d.line((50 * u - 4 * u, oy + 24.5 * u, 50 * u + 4 * u, oy + 24.5 * u),
                       fill=(70, 44, 38, 255), width=max(1, int(1.7 * u)))
    return _rgba((ancho, alto_c), dib)


def _sprite_palido(altura_px: int, pose: int = 0) -> Image.Image:
    """PÁLIDO: figura blanca, rostro en blanco (sin rasgos) y sombrero de
    ala ancha. Camina rígido, casi sin balanceo. Pies en el borde inferior."""
    u = altura_px / 100.0
    ancho = int(100 * u)
    alto_c = altura_px + int(12 * u)
    oy = 12 * u
    contorno = (40, 40, 48, 255)
    g = max(1, int(1.4 * u))
    ropa = (44, 42, 52)
    sep = (1.0, 2.5, 1.0, 2.5)[pose % 4] * u

    def dib(d):
        piel = (233, 230, 222)
        # piernas
        d.rounded_rectangle((50 * u - 11 * u - sep, oy + 65 * u,
                             50 * u - 3 * u - sep, oy + 96 * u),
                            radius=2 * u, fill=ropa, outline=contorno, width=g)
        d.rounded_rectangle((50 * u + 3 * u + sep, oy + 65 * u,
                             50 * u + 11 * u + sep, oy + 96 * u),
                            radius=2 * u, fill=ropa, outline=contorno, width=g)
        # brazos pegados al cuerpo
        d.rounded_rectangle((50 * u - 22 * u, oy + 33 * u, 50 * u - 14 * u, oy + 64 * u),
                            radius=2 * u, fill=ropa, outline=contorno, width=g)
        d.rounded_rectangle((50 * u + 14 * u, oy + 33 * u, 50 * u + 22 * u, oy + 64 * u),
                            radius=2 * u, fill=ropa, outline=contorno, width=g)
        # torso
        d.rounded_rectangle((50 * u - 16 * u, oy + 31 * u, 50 * u + 16 * u, oy + 67 * u),
                            radius=3 * u, fill=ropa, outline=contorno,
                            width=max(g, int(1.5 * u)))
        # cabeza blanca SIN cara (inquietante)
        d.rounded_rectangle((50 * u - 16 * u, oy + 3 * u, 50 * u + 16 * u, oy + 33 * u),
                            radius=6 * u, fill=piel, outline=contorno,
                            width=max(g, int(1.5 * u)))
        # sombrero de ala ancha
        d.rounded_rectangle((50 * u - 23 * u, oy + 0.5 * u, 50 * u + 23 * u, oy + 6 * u),
                            radius=2.5 * u, fill=ropa, outline=contorno, width=g)
        d.rounded_rectangle((50 * u - 14 * u, oy - 6 * u, 50 * u + 14 * u, oy + 3 * u),
                            radius=3.5 * u, fill=ropa, outline=contorno, width=g)
    return _rgba((ancho, alto_c), dib)


def _bloque3d(d, x: float, y: float, w: float, h: float, color,
              prof: float = 0.16, lado: int = 1) -> None:
    """Bloque Roblox con volumen falso: cara frontal + lateral (oscuro)
    + tapa superior (clara). lado=1 volumen a la derecha, -1 a la izquierda."""
    px = abs(w * prof) * lado
    py = h * prof * 0.45
    lateral = tuple(max(0, int(c * 0.68)) for c in color)
    tapa = tuple(min(255, int(c * 1.28)) for c in color)
    borde = tuple(max(0, int(c * 0.45)) for c in color)
    # cara frontal
    d.rectangle((x, y, x + w, y + h), fill=color, outline=borde, width=2)
    # lateral (hacia el lado indicado)
    if lado > 0:
        d.polygon([(x + w, y + py * 0.6), (x + w + px, y + py * 0.2),
                   (x + w + px, y + h - py * 0.2), (x + w, y + h - py * 0.6)],
                  fill=lateral)
    else:
        d.polygon([(x, y + py * 0.6), (x + px, y + py * 0.2),
                   (x + px, y + h - py * 0.2), (x, y + h - py * 0.6)],
                  fill=lateral)
    # tapa superior
    if lado > 0:
        d.polygon([(x, y), (x + px, y - py), (x + w + px, y - py),
                   (x + w, y + py * 0.6)], fill=tapa)
    else:
        d.polygon([(x, y), (x + px, y - py), (x + w + px, y - py),
                   (x + w, y + py * 0.6)], fill=tapa)
    # aristas
    d.line((x, y, x + px, y - py), fill=borde, width=2)
    if lado > 0:
        d.line((x + w, y + py * 0.6, x + w + px, y + py * 0.2), fill=borde, width=2)


def _sombra_suelo(ancho: int) -> Image.Image:
    return _rgba((ancho, max(6, ancho // 3)),
                 lambda dd: dd.ellipse((0, 0, ancho - 1, ancho // 3 - 1),
                                       fill=(0, 0, 0, 80)), 4)


# ------------------------------------------------------------------ #
# escenas
# ------------------------------------------------------------------ #
def _escena_calle():
    """Calle Roblox de noche: casas coloridas con volumen 3D, acera de
    losetas, asfalto con franjas amarillas, faroles modernos de barra
    blanca y el chico (pelo negro, sudadera) caminando hacia el pueblo."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((18, 20, 44), (42, 28, 52))
    horizonte = int(ESH * 0.56)
    titilantes, nubes = _cielo_noche(base, rng, con_luna=True)
    d = ImageDraw.Draw(base)

    vx = ESW * 0.50
    prof_y = 1.5          # curva de perspectiva

    def yf(f: float) -> float:
        """y de un punto a profundidad f (0 = horizonte, 1 = borde inferior)."""
        return horizonte + (ESH - horizonte) * f ** prof_y

    def xf(f: float) -> float:
        """factor de perspectiva para interpolar x (misma curva que yf)."""
        return f ** prof_y

    # --- calzada de asfalto en perspectiva ---
    d.polygon([(ESW * 0.16, ESH), (ESW * 0.84, ESH),
               (vx + ESW * 0.052, horizonte), (vx - ESW * 0.052, horizonte)],
              fill=(40, 38, 46))
    # franjas amarillas centrales (encogiéndose con la profundidad)
    franjas = []
    for i in range(7):
        f1 = i / 7.0
        f2 = (i + 0.42) / 7.0
        y1, y2 = yf(f1), yf(f2)
        hw1 = ESW * (0.006 + 0.016 * f1)
        hw2 = ESW * (0.006 + 0.016 * f2)
        pts = [(vx - hw1, y1), (vx + hw1, y1), (vx + hw2, y2), (vx - hw2, y2)]
        d.polygon(pts, fill=(216, 174, 54))
        franjas.append((pts, rng.uniform(1.5, 4.0), rng.uniform(0, 6.3)))

    # --- aceras de losetas a ambos lados ---
    losetas = []
    for lado, xh_in, xh_out, xb_in, xb_out in (
            (-1, vx - ESW * 0.052, vx - ESW * 0.062, ESW * 0.16, ESW * 0.015),
            (1, vx + ESW * 0.052, vx + ESW * 0.062, ESW * 0.84, ESW * 0.985)):
        pts = [(xh_out, horizonte), (xh_in, horizonte), (xb_in, ESH), (xb_out, ESH)]
        d.polygon(pts, fill=(158, 156, 150), outline=(108, 106, 100), width=2)
        # juntas horizontales de las losetas
        for k in range(1, 9):
            f = k / 9.0
            y = yf(f)
            g_f = xf(f)
            xa = xh_out + (xb_out - xh_out) * g_f
            xb = xh_in + (xb_in - xh_in) * g_f
            d.line((xa, y, xb, y), fill=(116, 114, 108), width=max(1, int(1 + 2.5 * f)))
            losetas.append((f, rng.uniform(0, 6.3)))

    # --- casas coloridas con volumen 3D y techos ---
    paleta = [(168, 54, 50), (198, 158, 64), (196, 116, 124), (62, 96, 148),
              (54, 122, 108), (188, 106, 54), (120, 78, 140), (150, 66, 96)]
    ventanas, puertas, casas = [], [], []
    for lado in (-1, 1):
        for f in (0.14, 0.32, 0.52, 0.74):
            yb = yf(f)
            esc = 0.30 + 0.70 * f
            w_c = ESW * (0.055 + 0.085 * f) * rng.uniform(0.85, 1.15)
            h_c = ESH * (0.055 + 0.135 * f) * rng.uniform(0.85, 1.15)
            color = tuple(int(c * 0.78) for c in rng.choice(paleta))
            g_f = xf(f)
            if lado < 0:                      # fila izquierda
                x2 = (vx - ESW * 0.062) + (ESW * 0.015 - (vx - ESW * 0.062)) * g_f
                x1 = x2 - w_c
            else:                             # fila derecha
                x1 = (vx + ESW * 0.062) + (ESW * 0.985 - (vx + ESW * 0.062)) * g_f
                x2 = x1 + w_c
            # el lateral del bloque mira hacia la calle
            _bloque3d(d, x1, yb - h_c, w_c, h_c, color,
                      prof=0.16, lado=-lado)
            # techo a dos aguas (blocky)
            rh = max(8, h_c * 0.40)
            techo = tuple(max(0, int(c * 0.45)) for c in color)
            d.polygon([(x1 - w_c * 0.04, yb - h_c), (x2 + w_c * 0.04, yb - h_c),
                       ((x1 + x2) / 2 + w_c * 0.02, yb - h_c - rh),
                       ((x1 + x2) / 2 - w_c * 0.02, yb - h_c - rh)], fill=techo)
            d.line((((x1 + x2) / 2 - w_c * 0.02, yb - h_c - rh),
                    ((x1 + x2) / 2 + w_c * 0.02, yb - h_c - rh)),
                   fill=tuple(min(255, int(c * 0.65)) for c in color), width=2)
            # puerta y ventanas en la cara frontal
            w_p = max(5, w_c * 0.22)
            d.rectangle((((x1 + x2) / 2 - w_p / 2, yb - h_c * 0.42),
                         ((x1 + x2) / 2 + w_p / 2, yb - 1)),
                        fill=(30, 24, 26), outline=(18, 14, 16), width=2)
            puertas.append((((x1 + x2) / 2, yb - h_c * 0.42),
                            rng.uniform(1.6, 4.0), rng.uniform(0, 6.3)))
            for vw in (x1 + w_c * 0.14, x2 - w_c * 0.30):
                vy = yb - h_c * 0.80
                ww, wh = max(4, w_c * 0.16), max(4, h_c * 0.20)
                if rng.random() < 0.62:
                    d.rectangle((vw, vy, vw + ww, vy + wh), fill=(255, 214, 120),
                                outline=(24, 18, 22), width=2)
                    ventanas.append((vw - 3, vy - 3, rng.uniform(1.2, 3.6),
                                     rng.uniform(0, 6.3)))
                else:
                    d.rectangle((vw, vy, vw + ww, vy + wh), fill=(26, 22, 32),
                                outline=(16, 12, 18), width=2)
            casas.append((lado, f))

    # --- faroles modernos: poste negro + barra blanca luminosa ---
    faroles, barras = [], []
    for lado, f in ((-1, 0.42), (1, 0.30), (-1, 0.72), (1, 0.60)):
        yb = yf(f)
        esc = 0.34 + 0.66 * f
        h_l = ESH * (0.085 + 0.115 * f)
        w_l = max(5, ESW * 0.013 * esc)
        g_f = xf(f)
        if lado < 0:
            x_out = (vx - ESW * 0.062) + (ESW * 0.015 - (vx - ESW * 0.062)) * g_f
            x_in = (vx - ESW * 0.052) + (ESW * 0.16 - (vx - ESW * 0.052)) * g_f
        else:
            x_out = (vx + ESW * 0.062) + (ESW * 0.985 - (vx + ESW * 0.062)) * g_f
            x_in = (vx + ESW * 0.052) + (ESW * 0.84 - (vx + ESW * 0.052)) * g_f
        xa = x_out + (x_in - x_out) * 0.45
        d.rounded_rectangle((xa - w_l / 2, yb - h_l, xa + w_l / 2, yb),
                            radius=w_l / 2, fill=(32, 32, 40), outline=(14, 14, 18),
                            width=1)
        # barra blanca horizontal arriba (farol moderno)
        w_b = w_l * 4.2
        d.rounded_rectangle((xa - w_b / 2, yb - h_l - 5 * esc, xa + w_b / 2,
                             yb - h_l + 2 * esc), radius=max(2, 3 * esc),
                            fill=(252, 252, 246), outline=(120, 120, 130), width=1)
        barras.append((xa, yb - h_l - 5 * esc, esc))
        faroles.append((_sprite_cono(int(0.13 * ESW * esc), int(0.19 * ESH * esc),
                                     (240, 246, 255), 22),
                        xa - 0.065 * ESW * esc, yb - h_l,
                        rng.uniform(1.8, 3.4), rng.uniform(0, 6.3)))

    nieblas = [(_sprite_niebla(int(ESW * 0.72)), rng.uniform(0, ESW),
                horizonte - 0.08 * ESH, rng.uniform(8, 14)),
               (_sprite_niebla(int(ESW * 0.88)), rng.uniform(0, ESW),
                ESH * 0.74, rng.uniform(14, 24)),
               (_sprite_niebla(int(ESW * 0.88)), rng.uniform(0, ESW),
                ESH * 0.87, rng.uniform(20, 32))]
    base = _vineta(base, 0.48)

    glow_ventana = _sprite_brillo(int(0.030 * ESW), int(0.020 * ESH), (255, 214, 120), 200)
    glow_barra = _sprite_brillo(int(0.055 * ESW), int(0.014 * ESH), (250, 250, 255), 210)
    alto_pe = int(ESH * 0.155)
    poses = [_sprite_personaje(alto_pe, pose=p, de_espaldas=True) for p in range(4)]
    sombra_pe = _sombra_suelo(int(ESW * 0.11))
    palido = _sprite_palido(int(ESH * 0.09), pose=0)

    def animar(t: float, img: Image.Image) -> None:
        for nube, x0, y0, vel in nubes:
            x = (x0 - vel * t) % (ESW + nube.width) - nube.width
            _pegar(img, nube, x, y0, 0.95)
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in titilantes:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.6 + 1.2 * b
            v = int(140 + 110 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, min(255, v + 35)))
        for pts, frec, fase in franjas:
            k = 0.55 + 0.45 * np.sin(t * frec + fase)
            dd.polygon(pts, fill=(int(216 * (0.45 + 0.55 * k)),
                                  int(174 * (0.45 + 0.55 * k)), int(54 * (0.45 + 0.55 * k))))
        for wx, wy, frec, fase in ventanas:
            k = 0.60 + 0.40 * np.sin(t * frec + fase)
            if np.sin(t * 0.47 + fase * 2.3) < -0.86:
                k *= 0.20
            _pegar(img, glow_ventana, wx, wy, k)
        for cono, cx, cy, frec, fase in faroles:
            _pegar(img, cono, cx, cy, 0.80 + 0.20 * np.sin(t * frec + fase))
        # resplandor de las barras de los faroles
        for xa_b, y_b, esc_b in barras:
            _pegar(img, glow_barra, xa_b - glow_barra.width / 2, y_b - 2 * esc_b,
                   0.70 + 0.30 * np.sin(t * 2.0 + xa_b * 0.01))
        # pálido asomado junto a una puerta (aparece y se esfuma)
        k_p = max(0.0, np.sin(t * 0.33 + 1.9)) ** 8
        if k_p > 0.03:
            g_32 = xf(0.32)
            x_pal = (vx - ESW * 0.062) + (ESW * 0.015 - (vx - ESW * 0.062)) * g_32 \
                - ESW * 0.045
            _pegar(img, palido, x_pal - palido.width / 2,
                   yf(0.32) - palido.height + 4, k_p)
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.90)
        # protagonista caminando hacia el pueblo
        progreso = (t / 26.0) % 1.0
        f_pe = 0.97 - 0.52 * progreso
        esc_f = 1.0 - 0.42 * progreso
        px = vx - ESW * 0.055 + np.sin(t * 0.55) * ESW * 0.012
        py = yf(f_pe)
        pose = poses[int(t * 5.4) % 4]
        w_p, h_p = max(1, int(pose.width * esc_f)), max(1, int(pose.height * esc_f))
        mini = pose.resize((w_p, h_p), Image.BILINEAR)
        salto = abs(np.sin(t * 5.4)) * 0.006 * ESH * esc_f
        _pegar(img, sombra_pe, px - sombra_pe.width * esc_f / 2, py - 6,
               0.75, )
        img.paste(mini, (int(px - w_p / 2), int(py - h_p - salto + 4)), mini)

    return base, animar


def _escena_casa():
    """Habitación pastel tipo Roblox: litera de madera, ventana con luna,
    luz nocturna y una sombra que respira junto a la cama."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((226, 182, 196), (186, 158, 202))   # rosa pastel arriba
    d = ImageDraw.Draw(base)

    # piso de madera clara
    horizonte = int(ESH * 0.68)
    d.rectangle((0, horizonte, ESW, ESH), fill=(158, 122, 88))
    for i in range(8):
        x_p = ESW * (i / 7.0)
        d.line((ESW * 0.5, horizonte, x_p, ESH), fill=(142, 108, 78), width=2)
    for yy in (0.76, 0.85, 0.94):
        d.line((0, ESH * yy, ESW, ESH * yy), fill=(142, 108, 78), width=2)

    # ventana con noche y luna (derecha)
    vx1, vy1, vx2, vy2 = ESW * 0.60, ESH * 0.14, ESW * 0.90, ESH * 0.42
    d.rectangle((vx1 - 12, vy1 - 12, vx2 + 12, vy2 + 12), fill=(250, 244, 238))
    d.rectangle((vx1, vy1, vx2, vy2), fill=(16, 18, 40))
    mx2, my2 = (vx1 + vx2) / 2, (vy1 + vy2) / 2 - (vy2 - vy1) * 0.14
    mr2 = (vy2 - vy1) * 0.13
    d.ellipse((mx2 - mr2, my2 - mr2, mx2 + mr2, my2 + mr2), fill=(238, 240, 214))
    d.ellipse((mx2 - mr2 * 0.3, my2 - mr2 * 0.35, mx2 + mr2 * 0.1, my2),
              fill=(222, 224, 198))
    estrellitas = [(rng.uniform(vx1 + 10, vx2 - 10), rng.uniform(vy1 + 10, vy2 - 10),
                    rng.uniform(2.0, 4.0), rng.uniform(0, 6.3)) for _ in range(4)]
    d.rectangle(((vx1 + vx2) / 2 - 6, vy1, (vx1 + vx2) / 2 + 6, vy2),
                fill=(250, 244, 238))
    d.rectangle((vx1, (vy1 + vy2) / 2 - 6, vx2, (vy1 + vy2) / 2 + 6),
                fill=(250, 244, 238))
    # cortinas pastel
    d.rounded_rectangle((vx1 - 30, vy1 - 22, vx1 + 24, vy2 + 34), radius=12,
                        fill=(216, 150, 168), outline=(176, 116, 134), width=2)
    d.rounded_rectangle((vx2 - 24, vy1 - 22, vx2 + 30, vy2 + 34), radius=12,
                        fill=(216, 150, 168), outline=(176, 116, 134), width=2)

    # LITERA de madera (izquierda), estilo Roblox blocky
    bx1, bx2 = ESW * 0.12, ESW * 0.44
    madera = (150, 106, 70)
    madera_s = (116, 80, 52)
    borde_m = (84, 56, 38)
    y_suelo = ESH * 0.72
    # postes
    for xx in (bx1, bx2 - ESW * 0.024):
        d.rectangle((xx, y_suelo - ESH * 0.58, xx + ESW * 0.024, y_suelo),
                    fill=madera_s, outline=borde_m, width=2)

    def cama_nivel(y_sup, color_cobija):
        # cobija colgando por el frente
        d.rectangle((bx1 + ESW * 0.004, y_sup - ESH * 0.020, bx2 - ESW * 0.024,
                     y_sup + ESH * 0.075), fill=color_cobija, outline=borde_m, width=2)
        # base de madera
        d.rectangle((bx1 - ESW * 0.004, y_sup, bx2 - ESW * 0.020, y_sup + ESH * 0.045),
                    fill=madera, outline=borde_m, width=2)
        # almohada al fondo
        d.rounded_rectangle((bx1 + ESW * 0.010, y_sup - ESH * 0.026,
                             bx1 + ESW * 0.070, y_sup + ESH * 0.012),
                            radius=ESH * 0.012, fill=(246, 242, 238),
                            outline=(190, 184, 178), width=2)

    cama_nivel(y_suelo - ESH * 0.44, (92, 158, 172))
    cama_nivel(y_suelo - ESH * 0.20, (214, 130, 150))
    # escalera
    d.line((bx2 + ESW * 0.014, y_suelo, bx2 + ESW * 0.014, y_suelo - ESH * 0.50),
           fill=madera_s, width=max(4, int(ESW * 0.007)))
    d.line((bx2 + ESW * 0.044, y_suelo, bx2 + ESW * 0.044, y_suelo - ESH * 0.50),
           fill=madera_s, width=max(4, int(ESW * 0.007)))
    for k in (0.12, 0.30, 0.48, 0.66, 0.84):
        d.line((bx2 + ESW * 0.014, y_suelo - ESH * 0.50 * k,
                bx2 + ESW * 0.044, y_suelo - ESH * 0.50 * k),
               fill=madera, width=max(3, int(ESW * 0.005)))

    # alfombra redonda
    d.ellipse((ESW * 0.34, ESH * 0.80, ESW * 0.80, ESH * 0.97), fill=(210, 170, 190),
              outline=(180, 140, 162), width=3)
    d.ellipse((ESW * 0.42, ESH * 0.83, ESW * 0.72, ESH * 0.94), fill=(222, 186, 204))

    # osito blocky junto a la alfombra
    tx, ty, tu = ESW * 0.80, ESH * 0.80, ESH * 0.055
    d.rectangle((tx - 7, ty - tu * 0.6, tx + 7, ty), fill=(168, 120, 84),
                outline=(120, 84, 58), width=2)
    d.ellipse((tx - 10, ty - tu, tx + 10, ty - tu * 0.5), fill=(168, 120, 84),
              outline=(120, 84, 58), width=2)
    for ox in (-11, 6):
        d.ellipse((tx + ox, ty - tu * 1.12, tx + ox + 7, ty - tu * 0.82),
                  fill=(168, 120, 84))
    d.ellipse((tx - 5, ty - tu * 0.86, tx - 2, ty - tu * 0.74), fill=(40, 30, 26))
    d.ellipse((tx + 2, ty - tu * 0.86, tx + 5, ty - tu * 0.74), fill=(40, 30, 26))

    # puerta entreabierta al fondo (derecha) con penumbra
    px1, py1, px2, py2 = ESW * 0.47, ESH * 0.30, ESW * 0.565, ESH * 0.68
    d.rectangle((px1, py1, px2, py2), fill=(196, 152, 132), outline=(120, 88, 70), width=3)
    d.rectangle((px2 - (px2 - px1) * 0.38, py1 + 4, px2 - 4, py2 - 4),
                fill=(24, 16, 24))
    cono_puerta = _sprite_cono(int(0.16 * ESW), int(0.20 * ESH), (120, 90, 130), 45)
    cono_puerta = cono_puerta.rotate(-90, expand=True, resample=Image.BILINEAR)

    # luz nocturna sobre la mesita (derecha)
    lx, ly = ESW * 0.94, ESH * 0.56
    d.rectangle((lx - ESW * 0.035, ly, lx + ESW * 0.035, ly + ESH * 0.09),
                fill=(198, 150, 160), outline=(150, 110, 122), width=2)
    d.rounded_rectangle((lx - ESW * 0.018, ly - ESH * 0.055, lx + ESW * 0.018, ly),
                        radius=6, fill=(255, 226, 150), outline=(190, 150, 90), width=2)

    # sombra que respira bajo la litera
    w_s, h_s = int(0.10 * ESW), int(0.09 * ESH)
    sombra = _rgba((w_s, h_s), lambda dd: dd.polygon(
        [(w_s * 0.42, 0), (w_s * 0.62, h_s * 0.35), (w_s * 0.90, h_s * 0.96),
         (w_s * 0.10, h_s * 0.96), (w_s * 0.30, h_s * 0.35)],
        fill=(60, 30, 50, 210)), 3)
    ojitos = [(w_s * 0.40, h_s * 0.55), (w_s * 0.56, h_s * 0.55)]

    charco = _rgba((int(0.26 * ESW), int(0.08 * ESH)),
                   lambda dd: dd.ellipse((0, 0, 0.26 * ESW, 0.08 * ESH),
                                         fill=(255, 226, 150, 70)), 10)

    base = _vineta(base, 0.40)

    def animar(t: float, img: Image.Image) -> None:
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in estrellitas:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.4 + 1.2 * b
            v = int(150 + 100 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, 255))
        # luz nocturna: parpadeo cálido, a veces se apaga un instante
        k = 0.65 + 0.35 * np.sin(t * 2.1)
        if np.sin(t * 0.63) > 0.965:
            k *= 0.08
        _pegar(img, charco, lx - charco.width / 2, ly + ESH * 0.09, 0.4 + 0.6 * k)
        dd.rounded_rectangle((lx - ESW * 0.018, ly - ESH * 0.055, lx + ESW * 0.018, ly),
                             radius=6, fill=(255, int(226 * (0.35 + 0.65 * k)),
                                             int(150 * (0.35 + 0.65 * k))))
        # sombra que respira bajo la litera
        f_s = 1.0 + 0.06 * np.sin(t * 1.05)
        mini = sombra.resize((max(1, int(w_s * f_s)), max(1, int(h_s * f_s))), Image.BILINEAR)
        _pegar(img, mini, ESW * 0.17 - mini.width / 2,
               y_suelo - ESH * 0.14 - mini.height + 2, 1.0)
        brillo_ojo = max(0.0, np.sin(t * 0.9 + 1.2))
        if brillo_ojo > 0.55:
            y_ojos = y_suelo - ESH * 0.14 - h_s * 0.45
            for ox, oy_o in ojitos:
                dd.ellipse((ESW * 0.17 + ox * f_s - 2, y_ojos + oy_o * 0.2 - 2,
                            ESW * 0.17 + ox * f_s + 2, y_ojos + oy_o * 0.2 + 2),
                           fill=(200, 60, 70))
        _pegar(img, cono_puerta, px2 - cono_puerta.width * 0.55,
               py2 - cono_puerta.height * 0.75, 0.35 + 0.25 * np.sin(t * 1.7))

    return base, animar


def _escena_plaza():
    """Plaza de adoquines: torre del reloj a medianoche, Pálidos en fila
    y el chico de espaldas frente a ellos (la escena del video referido)."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((14, 16, 38), (30, 24, 44))
    horizonte = int(ESH * 0.50)
    titilantes, nubes = _cielo_noche(base, rng, con_luna=True)
    d = ImageDraw.Draw(base)

    # --- adoquinado en perspectiva ---
    d.rectangle((0, horizonte, ESW, ESH), fill=(96, 94, 100))
    for i in range(14):
        f = i / 14.0
        y = horizonte + (ESH - horizonte) * f ** 1.5
        f2 = (i + 1) / 14.0
        y2 = horizonte + (ESH - horizonte) * f2 ** 1.5
        esc = 0.35 + 0.65 * f
        n_ados = max(6, int(22 * esc))
        for j in range(n_ados + 1):
            x0 = -ESW * 0.05 + (ESW * 1.1) * j / n_ados
            w_a = (ESW * 1.1) / n_ados * 0.86
            h_a = (y2 - y) * 0.55
            tono = rng.choice((0, 4, 8, 12))
            d.rounded_rectangle((x0, y, x0 + w_a, y + h_a),
                                radius=max(2, 4 * esc),
                                fill=(100 + tono, 98 + tono, 106 + tono),
                                outline=(70, 68, 76), width=max(1, int(1.2 * esc)))

    # --- torre del reloj al fondo (centro) ---
    tx1, tx2 = ESW * 0.40, ESW * 0.60
    ty_top = horizonte - ESH * 0.34
    _bloque3d(d, tx1, ty_top, tx2 - tx1, horizonte - ty_top + 4, (116, 112, 128),
              prof=0.14, lado=1)
    # cornisa y remate
    d.rectangle((tx1 - ESW * 0.025, ty_top - ESH * 0.018, tx2 + ESW * 0.015,
                 ty_top), fill=(92, 88, 104), outline=(60, 56, 72), width=2)
    d.polygon([(tx1 - ESW * 0.035, ty_top - ESH * 0.018),
               (tx2 + ESW * 0.025, ty_top - ESH * 0.018),
               ((tx1 + tx2) / 2, ty_top - ESH * 0.075)], fill=(70, 64, 82))
    # campanario pequeño
    d.rectangle(((tx1 + tx2) / 2 - ESW * 0.016, ty_top - ESH * 0.115,
                 (tx1 + tx2) / 2 + ESW * 0.016, ty_top - ESH * 0.075),
                fill=(98, 94, 110), outline=(60, 56, 72), width=2)
    d.polygon([((tx1 + tx2) / 2 - ESW * 0.028, ty_top - ESH * 0.115),
               ((tx1 + tx2) / 2 + ESW * 0.028, ty_top - ESH * 0.115),
               ((tx1 + tx2) / 2, ty_top - ESH * 0.15)], fill=(64, 58, 78))
    # RELOJ grande: medianoche (12:00)
    rcx, rcy = (tx1 + tx2) / 2, ty_top + (horizonte - ty_top) * 0.30
    rr = ESH * 0.052
    d.ellipse((rcx - rr * 1.12, rcy - rr * 1.12, rcx + rr * 1.12, rcy + rr * 1.12),
              fill=(84, 80, 96), outline=(52, 48, 64), width=3)
    d.ellipse((rcx - rr, rcy - rr, rcx + rr, rcy + rr), fill=(244, 240, 222),
              outline=(70, 64, 80), width=4)
    for k in range(12):
        ang = k * np.pi / 6
        x1 = rcx + np.sin(ang) * rr * 0.82
        y1 = rcy - np.cos(ang) * rr * 0.82
        x2 = rcx + np.sin(ang) * rr * 0.92
        y2 = rcy - np.cos(ang) * rr * 0.92
        d.line((x1, y1, x2, y2), fill=(60, 56, 72), width=max(2, int(3)))
    d.line((rcx, rcy, rcx, rcy - rr * 0.55), fill=(40, 36, 52), width=max(3, int(5)))
    d.line((rcx, rcy, rcx, rcy - rr * 0.80), fill=(40, 36, 52), width=max(2, int(3)))
    d.ellipse((rcx - 5, rcy - 5, rcx + 5, rcy + 5), fill=(40, 36, 52))

    # puertas del ayuntamiento a los lados de la torre
    for lado in (-1, 1):
        dx = (tx2 + ESW * 0.05) if lado > 0 else (tx1 - ESW * 0.13)
        d.rectangle((dx, horizonte - ESH * 0.16, dx + ESW * 0.08, horizonte + 4),
                    fill=(84, 80, 94), outline=(56, 52, 66), width=2)
        d.polygon([(dx - ESW * 0.008, horizonte - ESH * 0.16),
                   (dx + ESW * 0.088, horizonte - ESH * 0.16),
                   (dx + ESW * 0.04, horizonte - ESH * 0.21)], fill=(60, 56, 72))

    # árboles blocky a los costados
    for ax, esc in ((ESW * 0.08, 1.0), (ESW * 0.92, 0.85)):
        d.rectangle((ax - ESW * 0.012 * esc, horizonte - ESH * 0.10 * esc,
                     ax + ESW * 0.012 * esc, horizonte + 2),
                    fill=(74, 54, 40), outline=(48, 36, 28), width=2)
        for fy in (0.10, 0.155):
            d.rectangle((ax - ESW * 0.05 * esc, horizonte - ESH * fy * esc,
                         ax + ESW * 0.05 * esc, horizonte - ESH * (fy - 0.05) * esc),
                        fill=(44, 74, 54), outline=(28, 48, 36), width=2)

    base = _vineta(base, 0.44)

    glow_reloj = _rgba((int(rr * 3.2), int(rr * 3.2)),
                       lambda dd: dd.ellipse((0, 0, rr * 3.2, rr * 3.2),
                                             fill=(255, 240, 200, 55)), 18)
    nieblas = [(_sprite_niebla(int(ESW * 0.80)), rng.uniform(0, ESW),
                horizonte - 0.06 * ESH, rng.uniform(8, 15)),
               (_sprite_niebla(int(ESW * 0.90)), rng.uniform(0, ESW),
                ESH * 0.80, rng.uniform(16, 28))]
    # Pálidos en fila (profundidades escalonadas, mirando al frente)
    pals = []
    for i, (f, fx_lado) in enumerate(((0.28, -1), (0.34, 1), (0.42, -0.5),
                                      (0.48, 0.5), (0.56, 0))):
        alto = int(ESH * (0.09 + 0.13 * f))
        spr = _sprite_palido(alto, pose=i % 4)
        px = ESW * 0.5 + fx_lado * ESW * (0.10 + 0.16 * f)
        py = horizonte + (ESH - horizonte) * f ** 1.5
        pals.append((spr, px, py, rng.uniform(0.4, 1.4), rng.uniform(0, 6.3)))
    alto_pe = int(ESH * 0.17)
    poses_pe = [_sprite_personaje(alto_pe, pose=p, de_espaldas=True) for p in range(4)]
    sombra_pe = _sombra_suelo(int(ESW * 0.13))

    def animar(t: float, img: Image.Image) -> None:
        for nube, x0, y0, vel in nubes:
            x = (x0 - vel * t) % (ESW + nube.width) - nube.width
            _pegar(img, nube, x, y0, 0.95)
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in titilantes:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.6 + 1.2 * b
            v = int(140 + 110 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, min(255, v + 35)))
        # resplandor del reloj
        _pegar(img, glow_reloj, rcx - glow_reloj.width / 2, rcy - glow_reloj.height / 2,
               0.55 + 0.45 * np.sin(t * 1.6))
        # Pálidos estáticos con leve oscilación (inquietante)
        for spr, px, py, frec, fase in pals:
            k = 0.80 + 0.20 * np.sin(t * frec + fase)
            _pegar(img, spr, px - spr.width / 2, py - spr.height + 2, k)
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.85)
        # protagonista de espaldas, acercándose a la fila
        progreso = (t / 26.0) % 1.0
        esc_f = 1.0 - 0.35 * progreso
        px = ESW * 0.5 + np.sin(t * 0.5) * ESW * 0.02
        py = ESH * (0.97 - 0.10 * progreso)
        pose = poses_pe[int(t * 5.0) % 4]
        w_p, h_p = max(1, int(pose.width * esc_f)), max(1, int(pose.height * esc_f))
        mini = pose.resize((w_p, h_p), Image.BILINEAR)
        salto = abs(np.sin(t * 5.0)) * 0.006 * ESH * esc_f
        _pegar(img, sombra_pe, px - sombra_pe.width * esc_f / 2, py - 8, 0.7)
        img.paste(mini, (int(px - w_p / 2), int(py - h_p - salto + 6)), mini)

    return base, animar


def _escena_bosque():
    """Bosque: niebla, linterna que barre y ojos que parpadean entre troncos."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((14, 24, 20), (34, 52, 42))
    d = ImageDraw.Draw(base)
    horizonte = int(ESH * 0.34)
    d.rectangle((0, horizonte, ESW, ESH), fill=(18, 30, 23))
    for _ in range(50):
        x = rng.uniform(0, ESW)
        y = rng.uniform(0, horizonte * 0.9)
        r = rng.uniform(0.8, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(205, 215, 245))
    for _ in range(14):
        cx = rng.uniform(0, ESW)
        r = rng.uniform(0.05, 0.11) * ESW
        d.ellipse((cx - r, horizonte - r * 0.9, cx + r, horizonte + r * 0.3),
                  fill=(24, 40, 30))
    for _ in range(8):
        tx = rng.uniform(0, ESW)
        tw = rng.uniform(0.018, 0.03) * ESW
        d.polygon([(tx, horizonte), (tx + tw, horizonte),
                   (tx + tw * 1.6, ESH * 0.98), (tx + tw * 0.7, ESH * 0.98)],
                  fill=(34, 52, 40))

    frontales = []
    for _ in range(3):
        tx = rng.uniform(0.05, 0.95) * ESW
        tw = rng.uniform(0.05, 0.085) * ESW
        w_f, h_f = int(tw), int(ESH * 0.85)
        tronco = _rgba((w_f, h_f), lambda dd, w=w_f, h=h_f: dd.polygon(
            [(0, 0), (w, 0), (w * 0.82, h), (w * 0.30, h)], fill=(18, 28, 22, 255)), 1)
        frontales.append((tronco, tx, ESH * 0.18))

    antorcha = _sprite_cono(int(0.42 * ESW), int(0.60 * ESH), (255, 250, 220), 62)
    ojos = _sprite_ojos(1.5)
    ojo_x = rng.uniform(0.55, 0.75) * ESW
    ojo_y = rng.uniform(0.50, 0.62) * ESH
    nieblas = [(_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.50, rng.uniform(10, 18)),
               (_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.66, rng.uniform(16, 28)),
               (_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.84, rng.uniform(24, 40))]
    base = _vineta(base, 0.40)

    def animar(t: float, img: Image.Image) -> None:
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.85)
        rot = antorcha.rotate(20 * np.sin(t * 0.55), expand=True, resample=Image.BILINEAR)
        _pegar(img, rot, ESW * 0.5 - rot.width / 2, ESH - rot.height * 0.92,
               0.75 + 0.25 * np.sin(t * 7.0))
        k = max(0.0, np.sin(t * 1.25 + 1.0)) ** 3 * (0.6 + 0.4 * np.sin(t * 0.4))
        _pegar(img, ojos, ojo_x, ojo_y, 0.25 + 0.75 * k)
        for tronco, tx, ty in frontales:
            _pegar(img, tronco, tx, ty)

    return base, animar


def _escena_tienda():
    """Tienda estilo pastel (como la heladería del video de referencia)."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((110, 62, 84), (60, 30, 48))
    d = ImageDraw.Draw(base)
    for ey in (0.30, 0.46):
        y = int(ESH * ey)
        d.rectangle((ESW * 0.06, y, ESW * 0.94, y + 0.016 * ESH), fill=(80, 44, 58))
        x = ESW * 0.08
        while x < ESW * 0.88:
            w_i = rng.uniform(0.035, 0.065) * ESW
            h_i = rng.uniform(0.045, 0.075) * ESH
            col = rng.choice([(238, 150, 180), (250, 205, 140), (160, 220, 200),
                              (210, 160, 220), (245, 230, 200)])
            d.rounded_rectangle((x, y - h_i, x + w_i, y - 2), radius=6, fill=col,
                                outline=(40, 20, 30), width=3)
            x += w_i + rng.uniform(0.008, 0.02) * ESW
    ym = int(ESH * 0.62)
    d.rectangle((ESW * 0.04, ym, ESW * 0.96, ESH * 0.88), fill=(196, 120, 140))
    d.rectangle((ESW * 0.04, ym, ESW * 0.96, ym + 0.035 * ESH), fill=(232, 168, 178))
    for i in range(1, 5):
        d.line((ESW * 0.04, ym + i * 0.052 * ESH, ESW * 0.96, ym + i * 0.052 * ESH),
               fill=(160, 92, 112), width=3)

    neon = _sprite_brillo(int(0.20 * ESW), int(0.06 * ESH), (255, 120, 190), 190)
    neon_pos = (ESW * 0.66, ESH * 0.08)

    def bulbo():
        w_b, h_b = int(0.03 * ESW), int(0.10 * ESH)

        def dib(dd):
            dd.line((w_b / 2, 0, w_b / 2, h_b * 0.62), fill=(30, 20, 26, 255), width=3)
            dd.ellipse((w_b / 2 - 9, h_b * 0.60, w_b / 2 + 9, h_b * 0.60 + 18),
                       fill=(255, 230, 160, 255))
        return _rgba((w_b, h_b), dib)

    bulbos = [(bx * ESW, int(ESH * 0.16), rng.uniform(0.8, 1.4), rng.uniform(0, 6.3), bulbo())
              for bx in (0.25, 0.50, 0.75)]
    pe = _sprite_personaje(int(0.26 * ESH), pose=0, de_espaldas=False,
                           expresion="feliz")
    bruma = _sprite_niebla(int(ESW * 0.80), (220, 170, 200))
    base = _vineta(base, 0.42)

    def animar(t: float, img: Image.Image) -> None:
        k = 0.55 + 0.45 * np.sin(t * 9.0 + 1.0)
        if np.sin(t * 0.7) > 0.94:
            k *= 0.10
        _pegar(img, neon, neon_pos[0], neon_pos[1], k)
        for bx, by, frec, fase, sprite in bulbos:
            rot = sprite.rotate(np.sin(t * 1.3 + fase) * 4.0,
                                center=(sprite.width / 2, 0), resample=Image.BILINEAR)
            _pegar(img, rot, bx - rot.width / 2, by, 0.85 + 0.15 * np.sin(t * 3.0 + fase))
        f = 1.0 + 0.012 * np.sin(t * 1.8)
        mini = pe.resize((max(1, int(pe.width * f)), max(1, int(pe.height * f))),
                         Image.BILINEAR)
        _pegar(img, mini, ESW * 0.5 - mini.width / 2, ym - mini.height + 2)
        x = (ESW * 0.6 - 18 * t) % (ESW + bruma.width) - bruma.width
        _pegar(img, bruma, x, ESH * 0.80, 0.55)

    return base, animar


def _escena_parque():
    """Parque nocturno: columpio que se mece solo, banco, farol y niebla."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((16, 22, 42), (52, 38, 62))
    horizonte = int(ESH * 0.58)
    titilantes, nubes = _cielo_noche(base, rng, con_luna=True)
    d = ImageDraw.Draw(base)
    d.rectangle((0, horizonte, ESW, ESH), fill=(26, 38, 30))
    for _ in range(120):
        gx = rng.uniform(0, ESW)
        gy = rng.uniform(horizonte, ESH)
        d.line((gx, gy, gx + rng.uniform(-6, 6), gy - rng.uniform(4, 9)),
               fill=(34, 50, 38), width=2)
    for lx, esc in ((0.08, 1.15), (0.90, 1.05)):
        px = lx * ESW
        d.polygon([(px, horizonte), (px + 0.05 * ESW * esc, horizonte),
                   (px + 0.025 * ESW * esc, ESH * 0.30)], fill=(16, 24, 19))
        for k in range(3):
            r = rng.uniform(0.05, 0.09) * ESW * esc
            cy = ESH * 0.30 - k * 0.055 * ESH
            d.ellipse((px + 0.02 * ESW * esc - r, cy - r * 0.6,
                       px + 0.02 * ESW * esc + r, cy + r * 0.6), fill=(20, 34, 25))

    # columpio con asiento animado
    cx1, cy1 = ESW * 0.24, ESH * 0.46
    d.line((cx1 - ESW * 0.08, cy1, cx1 + ESW * 0.08, cy1), fill=(28, 38, 32), width=8)
    for fx in (-0.075, 0.075):
        d.line((cx1 + ESW * fx, cy1, cx1 + ESW * fx * 1.55, ESH * 0.70),
               fill=(28, 38, 32), width=7)
    w_sw, h_sw = int(0.075 * ESW), int(0.17 * ESH)

    def dib_sw(dd):
        dd.line((w_sw * 0.28, 0, w_sw * 0.40, h_sw * 0.82), fill=(40, 36, 44, 255), width=3)
        dd.line((w_sw * 0.72, 0, w_sw * 0.60, h_sw * 0.82), fill=(40, 36, 44, 255), width=3)
        dd.rounded_rectangle((w_sw * 0.30, h_sw * 0.80, w_sw * 0.70, h_sw * 0.92),
                             radius=4, fill=(50, 42, 52, 255))
    columpio = _rgba((w_sw, h_sw), dib_sw)

    # banco
    bx1 = ESW * 0.62
    d.rounded_rectangle((bx1, ESH * 0.62, bx1 + ESW * 0.14, ESH * 0.645),
                        radius=6, fill=(48, 40, 54))
    d.rounded_rectangle((bx1, ESH * 0.55, bx1 + ESW * 0.14, ESH * 0.575),
                        radius=6, fill=(48, 40, 54))
    for lx2 in (0.01, 0.12):
        d.line((bx1 + ESW * lx2, ESH * 0.58, bx1 + ESW * lx2, ESH * 0.70),
               fill=(48, 40, 54), width=6)

    # farol con cono
    px, py = ESW * 0.50, ESH * 0.84
    h_f = 0.22 * ESH
    d.line((px, py, px, py - h_f), fill=(10, 10, 16), width=7)
    d.ellipse((px - 10, py - h_f - 12, px + 10, py - h_f + 12),
              fill=(255, 220, 130), outline=(10, 10, 16), width=2)
    cono = _sprite_cono(int(0.22 * ESW), int(0.32 * ESH))
    nieblas = [(_sprite_niebla(int(ESW * 0.9)), rng.uniform(0, ESW),
                ESH * 0.66, rng.uniform(14, 26)),
               (_sprite_niebla(int(ESW * 0.9)), rng.uniform(0, ESW),
                ESH * 0.82, rng.uniform(20, 34))]
    base = _vineta(base, 0.42)

    def animar(t: float, img: Image.Image) -> None:
        for nube, x0, y0, vel in nubes:
            x = (x0 - vel * t) % (ESW + nube.width) - nube.width
            _pegar(img, nube, x, y0, 0.95)
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in titilantes:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.6 + 1.2 * b
            v = int(140 + 110 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, min(255, v + 35)))
        rot = columpio.rotate(9 * np.sin(t * 1.05), center=(w_sw / 2, 0),
                              resample=Image.BILINEAR)
        _pegar(img, rot, cx1 - rot.width / 2, cy1)
        _pegar(img, cono, px - cono.width / 2, py - h_f + 6,
               0.78 + 0.22 * np.sin(t * 2.4))
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.90)

    return base, animar


def _escena_cementerio():
    """Cementerio: lápidas, árbol muerto, luz errante y figura que aparece."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((8, 12, 20), (24, 34, 30))
    horizonte = int(ESH * 0.55)
    mx, my, mr = ESW * 0.68, ESH * 0.13, ESH * 0.085
    for k, a in ((2.0, 5), (1.6, 9), (1.25, 14)):
        halo = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse((mx - mr * k, my - mr * k, mx + mr * k, my + mr * k),
                                     fill=(205, 215, 255, a))
        base.paste(Image.alpha_composite(base.convert("RGBA"), halo).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(base)
    d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=(235, 238, 214))
    d.ellipse((mx - mr * 0.35, my - mr * 0.4, mx + mr * 0.05, my), fill=(216, 220, 196))
    d.rectangle((0, horizonte, ESW, ESH), fill=(14, 20, 16))
    for _ in range(8):
        cx = rng.uniform(0, ESW)
        r = rng.uniform(0.04, 0.09) * ESW
        cy = horizonte + rng.uniform(0.02, 0.14) * ESH
        d.ellipse((cx - r, cy - r * 0.25, cx + r, cy + r * 0.25), fill=(17, 24, 19))
    # árbol muerto con ramas
    ax = ESW * 0.16
    d.line((ax, horizonte + 0.10 * ESH, ax, horizonte - 0.16 * ESH), fill=(8, 10, 8), width=9)
    for ang, largo in ((-0.9, 0.09), (-0.5, 0.11), (0.4, 0.10), (0.8, 0.08)):
        import math
        x2 = ax + math.sin(ang) * largo * ESW
        y2 = horizonte - 0.16 * ESH - math.cos(ang) * largo * ESH
        d.line((ax, horizonte - 0.10 * ESH, x2, y2), fill=(8, 10, 8), width=5)
        d.line((x2, y2, x2 + math.sin(ang * 1.6) * 0.05 * ESW, y2 - 0.05 * ESH),
               fill=(8, 10, 8), width=3)
    # lápidas y cruces (más lejos = más pequeñas)
    for _ in range(11):
        tx = rng.uniform(0.03, 0.95) * ESW
        ty = rng.uniform(0.60, 0.93) * ESH
        esc = max(0.35, 1.0 - (ty - horizonte) / (ESH - horizonte) * 0.5)
        if rng.random() < 0.5:
            w_t = max(8, int(0.045 * ESW * esc))
            h_t = max(12, int(0.075 * ESH * esc))
            inclin = rng.uniform(-6, 6)
            tumba = _rgba((w_t, h_t), lambda dd, w=w_t, h=h_t: dd.rounded_rectangle(
                (0, int(h * 0.25), w - 1, h - 1), radius=w // 2, fill=(48, 50, 58, 255),
                outline=(22, 24, 30, 255), width=2), 1).rotate(inclin, expand=True)
            _paste = True
        else:
            w_t = max(8, int(0.04 * ESW * esc))
            h_t = max(14, int(0.085 * ESH * esc))
            tumba = _rgba((w_t, h_t), lambda dd, w=w_t, h=h_t: (
                dd.line((w // 2, int(h * 0.05), w // 2, h - 1), fill=(62, 57, 50, 255),
                        width=max(3, w // 4)),
                dd.line((0, int(h * 0.30), w - 1, int(h * 0.30)), fill=(62, 57, 50, 255),
                        width=max(3, w // 4))), 1)
        base.paste(tumba, (int(tx - tumba.width / 2), int(ty - tumba.height)), tumba)
    nieblas = [(_sprite_niebla(int(ESW * 0.9), (130, 165, 150)), rng.uniform(0, ESW),
                ESH * 0.60, rng.uniform(10, 18)),
               (_sprite_niebla(int(ESW * 0.9), (130, 165, 150)), rng.uniform(0, ESW),
                ESH * 0.80, rng.uniform(18, 30))]
    base = _vineta(base, 0.55)
    brasa = _sprite_brillo(int(0.055 * ESW), int(0.055 * ESW), (170, 255, 200), 230)
    pe = _sprite_personaje(int(ESH * 0.145), de_espaldas=True)

    def animar(t: float, img: Image.Image) -> None:
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.85)
        bx = ESW * (0.30 + 0.18 * np.sin(t * 0.23))
        by = ESH * (0.60 + 0.10 * np.sin(t * 0.41 + 1.3))
        _pegar(img, brasa, bx, by, max(0.15, 0.5 + 0.5 * np.sin(t * 2.1)))
        k = max(0.0, np.sin(t * 0.35 + 2.0)) ** 6
        if k > 0.02:
            _pegar(img, pe, ESW * 0.74 - pe.width / 2, ESH * 0.80 - pe.height, k)

    return base, animar


def _escena_pasillo():
    """Corredor interminable: puertas entreabiertas y figura que se desvanece."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((30, 22, 32), (12, 8, 14))
    d = ImageDraw.Draw(base)
    vx, vy = ESW * 0.5, ESH * 0.52
    d.polygon([(0, ESH), (ESW, ESH), (vx + ESW * 0.05, vy + 0.06 * ESH),
               (vx - ESW * 0.05, vy + 0.06 * ESH)], fill=(38, 28, 30))
    for i in range(1, 9):
        f = (i / 9) ** 1.6
        yy = vy + 0.06 * ESH + (ESH - vy - 0.06 * ESH) * f
        d.line((0, yy, ESW, yy), fill=(30, 21, 23), width=2)
    d.polygon([(0, 0), (vx - ESW * 0.05, vy - 0.09 * ESH), (vx - ESW * 0.05, vy + 0.06 * ESH),
               (0, ESH)], fill=(36, 26, 38))
    d.polygon([(ESW, 0), (vx + ESW * 0.05, vy - 0.09 * ESH), (vx + ESW * 0.05, vy + 0.06 * ESH),
               (ESW, ESH)], fill=(32, 23, 34))
    d.polygon([(0, 0), (ESW, 0), (vx + ESW * 0.05, vy - 0.09 * ESH),
               (vx - ESW * 0.05, vy - 0.09 * ESH)], fill=(24, 16, 22))
    # puerta del fondo
    d.rectangle((vx - 0.045 * ESW, vy - 0.09 * ESH, vx + 0.045 * ESW, vy + 0.07 * ESH),
                fill=(10, 7, 12), outline=(4, 3, 6), width=3)
    # puertas laterales (algunas con luz)
    puertas = []
    for lado in (-1, 1):
        for k in (0.30, 0.55, 0.78):
            px = (0 if lado < 0 else ESW) * (1 - k) + (vx + lado * 0.048 * ESW) * k
            py_t = 0.16 * ESH * (1 - k) + (vy - 0.088 * ESH) * k
            py_b = ESH * (1 - k) + (vy + 0.068 * ESH) * k
            w_d = 0.075 * ESW * (1 - k * 0.75)
            x_d = px + lado * 0.012 * ESW
            d.rectangle((x_d, py_t, x_d + w_d * (1 if lado > 0 else 1), py_b),
                        fill=(26, 18, 24), outline=(10, 7, 10), width=2)
            if rng.random() < 0.5:
                puertas.append((x_d + w_d / 2, py_t, w_d * 0.9, py_b - py_t,
                                rng.uniform(1.2, 3.0), rng.uniform(0, 6.3)))
    # lámparas del techo
    conos = []
    for k in (0.25, 0.55, 0.85):
        y_c = 0.06 * ESH * (1 - k) + (vy - 0.09 * ESH) * k
        tam = 0.13 * ESW * (1 - k * 0.7) + 0.02 * ESW
        d.ellipse((vx - 6 * (1 - k) - 3, y_c - 4, vx + 6 * (1 - k) + 3, y_c + 4),
                  fill=(255, 226, 150))
        conos.append((_sprite_cono(int(tam), int(tam * 2.2)), vx - tam / 2, y_c,
                      rng.uniform(1.5, 3.0), rng.uniform(0, 6.3)))
    base = _vineta(base, 0.52)
    glow_p = _sprite_brillo(int(0.05 * ESW), int(0.05 * ESW), (255, 214, 130), 190)
    pe = _sprite_personaje(int(ESH * 0.105), de_espaldas=True)

    def animar(t: float, img: Image.Image) -> None:
        for cx, cy, w_d, h_d, frec, fase in puertas:
            _pegar(img, glow_p, cx - glow_p.width / 2, cy + h_d * 0.35,
                   0.55 + 0.45 * np.sin(t * frec + fase))
        for cono, cx, cy, frec, fase in conos:
            _pegar(img, cono, cx, cy, 0.75 + 0.25 * np.sin(t * frec + fase))
        k = max(0.0, np.sin(t * 0.4 + 1.0)) ** 10
        if k > 0.02:
            _pegar(img, pe, vx - pe.width / 2, vy + 0.068 * ESH - pe.height, k)

    return base, animar


def _escena_tunel():
    """Túnel infinito: anillos que se pierden, luces de emergencia y caminante."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((10, 9, 14), (20, 17, 24))
    d = ImageDraw.Draw(base)
    vx, vy = ESW * 0.5, ESH * 0.52
    d.polygon([(0, ESH), (ESW, ESH), (vx + ESW * 0.05, vy + 0.05 * ESH),
               (vx - ESW * 0.05, vy + 0.05 * ESH)], fill=(20, 18, 24))
    for i in range(1, 8):
        f = (i / 8) ** 1.6
        yy = vy + 0.05 * ESH + (ESH - vy - 0.05 * ESH) * f
        d.line((0, yy, ESW, yy), fill=(16, 14, 19), width=2)
    for i in range(10):
        f = (i / 10) ** 1.8
        rx = ESW * 0.48 * (1 - f) + ESW * 0.035
        ry = ESH * 0.44 * (1 - f) + ESH * 0.05
        d.ellipse((vx - rx, vy - ry, vx + rx, vy + ry),
                  outline=(28 + i * 3, 26 + i * 3, 36 + i * 3),
                  width=max(3, int(12 * (1 - f)) + 2))
    luces = []
    for i in range(6):
        f = (i / 6) ** 1.7
        rx = ESW * 0.46 * (1 - f) + 0.04 * ESW
        yy = vy + 0.055 * ESH * (1 - f)
        esc = 1.0 - f * 0.65
        for lado in (-1, 1):
            lx = vx + lado * rx
            r_l = max(2, int(6 * esc))
            d.ellipse((lx - r_l, yy - r_l, lx + r_l, yy + r_l), fill=(255, 180, 70))
            luces.append((lx, yy, esc, rng.uniform(2.0, 5.0), rng.uniform(0, 6.3)))
    niebla_t = _sprite_niebla(int(ESW * 0.9), (100, 96, 120))
    base = _vineta(base, 0.55)
    alto_pe = int(ESH * 0.16)
    poses = [_sprite_personaje(alto_pe, pose=p, de_espaldas=True) for p in range(4)]

    def animar(t: float, img: Image.Image) -> None:
        x = (ESW * 0.4 - 20 * t) % (ESW + niebla_t.width) - niebla_t.width
        _pegar(img, niebla_t, x, ESH * 0.70, 0.6)
        for lx, ly, esc, frec, fase in luces:
            k = 0.55 + 0.45 * np.sin(t * frec + fase)
            if np.sin(t * 0.9 + fase * 1.7) < -0.92:
                k *= 0.10
            brillo = _sprite_brillo(max(6, int(0.035 * ESW * esc)),
                                    max(6, int(0.035 * ESW * esc)), (255, 180, 70), 200)
            _pegar(img, brillo, lx - brillo.width / 2, ly - brillo.height / 2, k)
        progreso = (t / 26.0) % 1.0
        f = 1.0 - 0.45 * progreso
        py = ESH * (0.82 - 0.20 * progreso)
        pose = poses[int(t * 5.0) % 4]
        w_p, h_p = max(1, int(pose.width * f)), max(1, int(pose.height * f))
        mini = pose.resize((w_p, h_p), Image.BILINEAR)
        _pegar(img, mini, ESW * 0.5 - w_p / 2, py - h_p + np.sin(t * 6.0) * 3 * f)

    return base, animar


def _escena_iglesia():
    """Iglesia: vitral, velas que tiemblan y bancos en perspectiva."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((28, 24, 40), (14, 10, 18))
    d = ImageDraw.Draw(base)
    vx, vy = ESW * 0.5, ESH * 0.50
    d.polygon([(0, ESH), (ESW, ESH), (vx + ESW * 0.10, vy + 0.10 * ESH),
               (vx - ESW * 0.10, vy + 0.10 * ESH)], fill=(40, 36, 34))
    for i in range(1, 8):
        f = (i / 8) ** 1.6
        yy = vy + 0.10 * ESH + (ESH - vy - 0.10 * ESH) * f
        d.line((0, yy, ESW, yy), fill=(32, 28, 27), width=2)
    # vitral
    wx1, wy1 = vx - 0.14 * ESW, vy - 0.26 * ESH
    wx2, wy2 = vx + 0.14 * ESW, vy + 0.02 * ESH
    d.rounded_rectangle((wx1, wy1, wx2, wy2), radius=int(0.07 * ESW), fill=(56, 44, 20),
                        outline=(20, 16, 12), width=4)
    colores = [(140, 60, 80), (60, 90, 140), (150, 120, 50), (80, 120, 90), (120, 60, 130)]
    for gy in range(6):
        for gx in range(4):
            cx_g = wx1 + (wx2 - wx1) * (gx + 0.5) / 4
            cy_g = wy1 + (wy2 - wy1) * (gy + 0.5) / 6
            r_g = min((wx2 - wx1) / 4, (wy2 - wy1) / 6) * 0.42
            d.polygon([(cx_g, cy_g - r_g), (cx_g + r_g, cy_g), (cx_g, cy_g + r_g),
                       (cx_g - r_g, cy_g)], fill=rng.choice(colores))
    # cruz y altar
    d.rectangle((vx - 0.09 * ESW, vy + 0.02 * ESH, vx + 0.09 * ESW, vy + 0.10 * ESH),
                fill=(50, 40, 30), outline=(24, 18, 14), width=3)
    d.line((vx, vy - 0.20 * ESH, vx, vy - 0.06 * ESH), fill=(205, 195, 165), width=9)
    d.line((vx - 0.05 * ESW, vy - 0.16 * ESH, vx + 0.05 * ESW, vy - 0.16 * ESH),
           fill=(205, 195, 165), width=7)
    # velas sobre el altar
    velas = []
    for off in (-0.06, 0.06):
        x_v = vx + ESW * off
        y_v = vy + 0.018 * ESH
        d.rectangle((x_v - 4, y_v - 22, x_v + 4, y_v), fill=(214, 204, 184),
                    outline=(90, 80, 70), width=1)
        velas.append((x_v, y_v - 24, rng.uniform(4, 8), rng.uniform(0, 6.3)))
    # bancos a los lados
    for k in (0.85, 0.68, 0.53, 0.40, 0.29, 0.20):
        y_base = (vy + 0.10 * ESH) + (ESH * 0.99 - (vy + 0.10 * ESH)) * ((k - 0.20) / 0.65)
        w_b = ESW * 0.16 * k
        h_b = ESH * 0.055 * k
        sep = ESW * (0.50 * k + 0.055)
        for lado in (-1, 1):
            cx_b = vx + lado * sep
            d.rounded_rectangle((cx_b - w_b / 2, y_base - h_b * 1.7, cx_b + w_b / 2, y_base - h_b),
                                radius=max(2, int(3 * k)), fill=(30, 24, 20),
                                outline=(12, 9, 8), width=max(1, int(2 * k)))
            d.rounded_rectangle((cx_b - w_b / 2, y_base - h_b, cx_b + w_b / 2, y_base),
                                radius=max(2, int(3 * k)), fill=(26, 21, 18),
                                outline=(12, 9, 8), width=max(1, int(2 * k)))
    haz = _sprite_cono(int(0.30 * ESW), int(0.36 * ESH), (255, 240, 190), 36)
    base = _vineta(base, 0.45)

    def animar(t: float, img: Image.Image) -> None:
        dd = ImageDraw.Draw(img)
        for x_v, y_v, frec, fase in velas:
            k = 0.6 + 0.4 * np.sin(t * frec * 3 + fase)
            v = int(180 + 70 * k)
            dd.ellipse((x_v - 3, y_v - 9, x_v + 3, y_v), fill=(255, v, int(v * 0.45)))
        _pegar(img, haz, vx - haz.width / 2, wy2 - 6,
               0.75 + 0.25 * np.sin(t * 0.5))

    return base, animar


def _escena_sotano():
    """Sótano: muro de piedra, escalera, bombilla que oscila y sombra."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((24, 18, 16), (10, 8, 10))
    d = ImageDraw.Draw(base)
    horizonte = int(ESH * 0.60)
    bh = ESH * 0.055
    for fy in range(int(horizonte / bh) + 1):
        y0 = fy * bh
        off = (fy % 2) * ESH * 0.03
        for fx in range(int(ESW / (ESH * 0.075)) + 2):
            x0 = fx * ESH * 0.075 - off
            col = rng.choice([(38, 30, 26), (32, 25, 22), (42, 33, 28)])
            d.rectangle((x0, y0, x0 + ESH * 0.07, y0 + bh * 0.94), fill=col,
                        outline=(16, 12, 10), width=2)
    d.rectangle((0, horizonte, ESW, ESH), fill=(20, 16, 14))
    # escalera hacia arriba (derecha)
    d.polygon([(ESW * 0.70, horizonte + 0.02 * ESH), (ESW * 0.99, horizonte + 0.02 * ESH),
               (ESW * 0.99, ESH * 0.28), (ESW * 0.84, ESH * 0.28)],
              fill=(30, 24, 20), outline=(12, 9, 8), width=3)
    for i in range(6):
        f = i / 6.0
        x1 = ESW * (0.72 + 0.13 * f)
        y1 = (horizonte + 0.01 * ESH) * (1 - f) + ESH * 0.30 * f
        x2 = ESW * (0.84 + 0.13 * f)
        d.rectangle((x1, y1 - 6, x2, y1 + 4), fill=(44, 34, 26), outline=(12, 9, 8), width=2)
    # cajas
    d.rounded_rectangle((ESW * 0.10, horizonte - 0.10 * ESH, ESW * 0.22, horizonte + 0.02 * ESH),
                        radius=4, fill=(44, 32, 20), outline=(14, 10, 8), width=3)
    d.rounded_rectangle((ESW * 0.18, horizonte - 0.05 * ESH, ESW * 0.31, horizonte + 0.06 * ESH),
                        radius=4, fill=(40, 29, 18), outline=(14, 10, 8), width=3)
    # bombilla colgante (sprite para que oscile) + charco de luz
    w_b, h_b = int(0.05 * ESW), int(0.20 * ESH)
    bulbo = _rgba((w_b, h_b), lambda dd: (
        dd.line((w_b / 2, 0, w_b / 2, h_b * 0.70), fill=(30, 22, 18, 255), width=3),
        dd.ellipse((w_b / 2 - 10, h_b * 0.66, w_b / 2 + 10, h_b * 0.66 + 22),
                   fill=(255, 226, 150, 255))))
    charco = _rgba((int(0.30 * ESW), int(0.09 * ESH)),
                   lambda dd: dd.ellipse((0, 0, 0.30 * ESW, 0.09 * ESH),
                                         fill=(255, 220, 140, 55)), 10)
    w_s, h_s = int(0.09 * ESW), int(0.34 * ESH)
    sombra = _rgba((w_s, h_s), lambda dd: dd.polygon(
        [(w_s * 0.50, 0), (w_s * 0.72, h_s * 0.12), (w_s * 0.66, h_s * 0.40),
         (w_s * 1.05, h_s * 0.98), (w_s * 0.10, h_s * 0.98), (w_s * 0.30, h_s * 0.40),
         (w_s * 0.28, h_s * 0.12)], fill=(8, 5, 8, 220)), 2)
    bruma = _sprite_niebla(int(ESW * 0.85), (120, 70, 70))
    base = _vineta(base, 0.55)
    bx = ESW * 0.45

    def animar(t: float, img: Image.Image) -> None:
        ang = 7.0 * np.sin(t * 0.9)
        rot = bulbo.rotate(ang, center=(w_b / 2, 0), resample=Image.BILINEAR)
        _pegar(img, rot, bx - rot.width / 2, 0)
        _pegar(img, charco, bx - charco.width / 2 + np.sin(t * 0.9) * 0.02 * ESW,
               horizonte + 0.02 * ESH, 0.7 + 0.3 * np.sin(t * 2.0))
        f_s = 1.0 + 0.03 * np.sin(t * 1.2 + 0.5)
        mini = sombra.resize((max(1, int(w_s * f_s)), max(1, int(h_s * f_s))), Image.BILINEAR)
        _pegar(img, mini, ESW * 0.60 - mini.width / 2, ESH * 0.28, 1.0)
        x = (ESW * 0.5 - 16 * t) % (ESW + bruma.width) - bruma.width
        _pegar(img, bruma, x, ESH * 0.72, 0.55)

    return base, animar


_ESCENAS = {
    "calle": _escena_calle,
    "plaza": _escena_plaza,
    "casa": _escena_casa,
    "bosque": _escena_bosque,
    "tienda": _escena_tienda,
    "parque": _escena_parque,
    "cementerio": _escena_cementerio,
    "pasillo": _escena_pasillo,
    "tunel": _escena_tunel,
    "iglesia": _escena_iglesia,
    "sotano": _escena_sotano,
}


def elegir_escenas(historia: dict) -> list:
    """3 escenas por video: 'calle' siempre abre; el resto según la historia."""
    texto = (str(historia.get("texto", "")) + " " + str(historia.get("entidad", ""))).lower()
    extra = []
    if any(k in texto for k in ("tienda", "helad", "vendid", "compr", "vended", "cucuruc")):
        extra.append("tienda")
    if any(k in texto for k in ("bosque", "árbol", "arbol", "camino", "sendero", "linde")):
        extra.append("bosque")
    if any(k in texto for k in ("casa", "habitaci", "ventana", "puerta", "cuarto")):
        extra.append("casa")
    if any(k in texto for k in ("parque", "columpi", "juegos", "tobogán", "tobogan")):
        extra.append("parque")
    if any(k in texto for k in ("cementerio", "tumba", "muerto", "murió", "murio",
                                "cadáver", "cadaver")):
        extra.append("cementerio")
    if any(k in texto for k in ("iglesia", "rezar", "santo", "oración", "oracion", "cruz")):
        extra.append("iglesia")
    if any(k in texto for k in ("sótano", "sotano", "maquinaria", "escondite")):
        extra.append("sotano")
    if any(k in texto for k in ("túnel", "tunel", "tubería", "tuberia", "pasaje")):
        extra.append("tunel")
    if any(k in texto for k in ("plaza", "reloj", "torre", "pueblo", "campanario",
                                "pálidos", "palidos")):
        extra.append("plaza")
    if any(k in texto for k in ("pasillo", "escuela", "puertas", "habitación", "habitacion")):
        extra.append("pasillo")
    resto = ["plaza", "casa", "bosque", "tienda", "parque", "cementerio", "pasillo",
             "tunel", "iglesia", "sotano"]
    random.shuffle(resto)
    escenas = ["calle"]
    for tipo in extra + resto:
        if tipo not in escenas:
            escenas.append(tipo)
        if len(escenas) == 3:
            break
    random.shuffle(escenas[1:])
    return escenas


def clip_escena(tipo: str, duracion: float):
    """VideoClip con cámara (paneo + zoom) y grano de película."""
    from moviepy import VideoClip

    base, animar = _ESCENAS[tipo]()
    sem_x = random.uniform(0, 6.28)
    sem_y = random.uniform(0, 6.28)
    granos = [np.random.normal(0, 5.0, (ALTO, ANCHO, 1)).astype(np.int16)
              for _ in range(6)]

    def cuadro(t: float) -> np.ndarray:
        lienzo = base.copy()
        animar(t, lienzo)
        progreso = 0.0 if duracion <= 0 else min(1.0, t / duracion)
        h_c = int(ALTO * (1.0 - 0.05 * progreso))
        w_c = int(h_c * ANCHO / ALTO)
        u_x = 0.5 + 0.42 * np.sin(progreso * 1.5 + sem_x)
        u_y = 0.5 + 0.30 * np.sin(progreso * 0.9 + sem_y)
        x0 = int(np.clip(u_x, 0.0, 1.0) * (base.width - w_c))
        y0 = int(np.clip(u_y, 0.0, 1.0) * (base.height - h_c))
        img = lienzo.crop((x0, y0, x0 + w_c, y0 + h_c)).resize((ANCHO, ALTO),
                                                               Image.BILINEAR)
        arr = np.asarray(img).astype(np.int16)
        arr += granos[int(t * FPS) % len(granos)]
        return np.clip(arr, 0, 255).astype(np.uint8)

    return VideoClip(cuadro, duration=duracion)


