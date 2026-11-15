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
        for k, a in ((2.7, 14), (2.0, 26), (1.45, 40)):
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


def _sprite_personaje(altura_px: int, pose: int = 0, de_espaldas: bool = True,
                      color=(26, 24, 38), piel=(214, 176, 142)) -> Image.Image:
    """Muñeco blocky estilo Roblox. pose 0..3 = ciclo de caminata."""
    u = altura_px / 100.0
    ancho = int(52 * u)
    contorno = (5, 5, 10, 255)
    grosor = max(1, int(1.3 * u))
    sep = (2.0, 5.5, 2.0, 5.5)[pose % 4] * u
    bam = (0.0, 3.5, 0.0, -3.5)[pose % 4] * u

    def dib(d):
        d.rounded_rectangle((50 * u - 11 * u - sep, 66 * u, 50 * u - 3 * u - sep, 97 * u),
                            radius=3 * u, fill=color, outline=contorno, width=grosor)
        d.rounded_rectangle((50 * u + 3 * u + sep, 66 * u, 50 * u + 11 * u + sep, 97 * u),
                            radius=3 * u, fill=color, outline=contorno, width=grosor)
        d.rounded_rectangle((50 * u - 22 * u, 34 * u + bam, 50 * u - 14 * u, 63 * u + bam * 0.5),
                            radius=3 * u, fill=color, outline=contorno, width=grosor)
        d.rounded_rectangle((50 * u + 14 * u, 34 * u - bam, 50 * u + 22 * u, 63 * u - bam * 0.5),
                            radius=3 * u, fill=color, outline=contorno, width=grosor)
        d.rounded_rectangle((50 * u - 16 * u, 33 * u, 50 * u + 16 * u, 68 * u),
                            radius=3 * u, fill=color, outline=contorno,
                            width=max(grosor, int(1.5 * u)))
        d.rounded_rectangle((50 * u - 15 * u, 6 * u, 50 * u + 15 * u, 33 * u),
                            radius=4 * u, fill=color if de_espaldas else piel,
                            outline=contorno, width=max(grosor, int(1.5 * u)))
        if not de_espaldas:
            d.ellipse((50 * u - 9 * u, 15 * u, 50 * u - 5 * u, 19 * u), fill=(250, 250, 250, 255))
            d.ellipse((50 * u + 5 * u, 15 * u, 50 * u + 9 * u, 19 * u), fill=(250, 250, 250, 255))
    return _rgba((ancho, altura_px), dib)


# ------------------------------------------------------------------ #
# escenas
# ------------------------------------------------------------------ #
def _escena_calle():
    """Pueblo de noche: luna, casas blocky, faroles, niebla y caminante."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((7, 9, 22), (36, 24, 48))
    horizonte = int(ESH * 0.60)
    titilantes, nubes = _cielo_noche(base, rng, con_luna=True)
    d = ImageDraw.Draw(base)

    # skyline de casas blocky
    ventanas = []

    def bloque_casas(desde_izquierda: bool) -> None:
        x_cur = 0.0 if desde_izquierda else ESW
        limite = ESW * (0.46 if desde_izquierda else 0.56)
        while x_cur < limite if desde_izquierda else x_cur > limite:
            ancho_c = rng.uniform(0.09, 0.17) * ESW
            alto_c = rng.uniform(0.15, 0.30) * ESH
            x1 = x_cur if desde_izquierda else x_cur - ancho_c
            x2 = x1 + ancho_c
            color_c = rng.choice([(22, 18, 34), (27, 21, 41), (18, 23, 33), (31, 19, 36)])
            d.rectangle((x1, horizonte - alto_c, x2, horizonte), fill=color_c,
                        outline=(6, 6, 12), width=3)
            d.polygon([(x1 - 4, horizonte - alto_c), (x2 + 4, horizonte - alto_c),
                       ((x1 + x2) / 2, horizonte - alto_c - rng.uniform(0.03, 0.07) * ESH)],
                      fill=tuple(max(0, c - 10) for c in color_c))
            for _ in range(rng.randint(2, 4)):
                wx = rng.uniform(x1 + 6, x2 - 0.030 * ESW)
                wy = rng.uniform(horizonte - alto_c + 8, horizonte - 0.045 * ESH)
                if rng.random() < 0.55:
                    d.rectangle((wx, wy, wx + 0.016 * ESW, wy + 0.024 * ESH),
                                fill=(255, 210, 120))
                    ventanas.append((wx - 3, wy - 3, rng.uniform(1.5, 4.5),
                                     rng.uniform(0, 6.3)))
                else:
                    d.rectangle((wx, wy, wx + 0.016 * ESW, wy + 0.024 * ESH),
                                fill=(28, 24, 44), outline=(6, 6, 12), width=2)
            paso = ancho_c * rng.uniform(0.72, 0.95)
            x_cur += paso if desde_izquierda else -paso

    bloque_casas(True)
    bloque_casas(False)

    # calzada en perspectiva
    d.polygon([(ESW * 0.055, ESH), (ESW * 0.945, ESH),
               (ESW * 0.545, horizonte), (ESW * 0.455, horizonte)], fill=(30, 28, 38))
    for i in range(6):
        y1 = horizonte + (ESH - horizonte) * (i / 6.0) ** 1.6
        y2 = horizonte + (ESH - horizonte) * ((i + 0.45) / 6.0) ** 1.6
        f1 = (y1 - horizonte) / (ESH - horizonte)
        f2 = (y2 - horizonte) / (ESH - horizonte)
        d.polygon([(ESW * (0.5 - 0.012 * f1), y1), (ESW * (0.5 + 0.012 * f1), y1),
                   (ESW * (0.5 + 0.012 * f2), y2), (ESW * (0.5 - 0.012 * f2), y2)],
                  fill=(120, 115, 105))

    # faroles con conos de luz
    faroles = []
    for lx, ly, esc in ((0.27, 0.86, 1.0), (0.74, 0.79, 0.85)):
        px, py = lx * ESW, ly * ESH
        h_f = 0.20 * ESH * esc
        d.line((px, py, px, py - h_f), fill=(10, 10, 16), width=max(3, int(6 * esc)))
        d.ellipse((px - 9 * esc, py - h_f - 10 * esc, px + 9 * esc, py - h_f + 10 * esc),
                  fill=(255, 220, 130), outline=(10, 10, 16), width=2)
        faroles.append((_sprite_cono(int(0.20 * ESW * esc), int(0.30 * ESH * esc)),
                        px - 0.10 * ESW * esc, py - h_f + 6 * esc,
                        rng.uniform(1.6, 3.2), rng.uniform(0, 6.3)))

    nieblas = [(_sprite_niebla(int(ESW * 0.75)), rng.uniform(0, ESW),
                horizonte - 0.10 * ESH, rng.uniform(8, 16)),
               (_sprite_niebla(int(ESW * 0.90)), rng.uniform(0, ESW),
                ESH * 0.74, rng.uniform(14, 26)),
               (_sprite_niebla(int(ESW * 0.90)), rng.uniform(0, ESW),
                ESH * 0.86, rng.uniform(20, 34))]
    base = _vineta(base, 0.50)

    glow_ventana = _sprite_brillo(int(0.016 * ESW) + 6, int(0.024 * ESH) + 6)
    alto_pe = int(ESH * 0.185)
    poses = [_sprite_personaje(alto_pe, pose=p, de_espaldas=True) for p in range(4)]

    def animar(t: float, img: Image.Image) -> None:
        for nube, x0, y0, vel in nubes:
            x = (x0 - vel * t) % (ESW + nube.width) - nube.width
            _pegar(img, nube, x, y0, 0.95)
        for wx, wy, frec, fase in ventanas:
            k = 0.62 + 0.38 * np.sin(t * frec + fase)
            if np.sin(t * 0.53 + fase * 2.1) < -0.88:
                k *= 0.15
            _pegar(img, glow_ventana, wx, wy, k)
        for cono, cx, cy, frec, fase in faroles:
            _pegar(img, cono, cx, cy, 0.78 + 0.22 * np.sin(t * frec + fase))
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in titilantes:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.6 + 1.2 * b
            v = int(140 + 110 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, min(255, v + 35)))
        for niebla, x0, y0, vel in nieblas:
            x = (x0 - vel * t) % (ESW + niebla.width) - niebla.width
            _pegar(img, niebla, x, y0, 0.90)
        progreso = (t / 24.0) % 1.0
        f = 1.0 - 0.40 * progreso
        px = ESW * 0.5 + np.sin(t * 0.6) * ESW * 0.012
        py = ESH * (0.88 - 0.155 * progreso)
        pose = poses[int(t * 5.2) % 4]
        w_p, h_p = max(1, int(pose.width * f)), max(1, int(pose.height * f))
        mini = pose.resize((w_p, h_p), Image.BILINEAR)
        _pegar(img, mini, px - w_p / 2, py - h_p + np.sin(t * 6.0) * 0.004 * ESH * f)

    return base, animar


def _escena_casa():
    """Habitación: ventana con luna, puerta entreabierta, sombra que respira."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((44, 30, 46), (24, 16, 26))
    d = ImageDraw.Draw(base)
    for x in range(0, ESW, int(ESW * 0.055)):
        d.rectangle((x, 0, x + int(ESW * 0.022), int(ESH * 0.66)), fill=(52, 36, 54))
    horizonte = int(ESH * 0.66)
    d.rectangle((0, horizonte, ESW, ESH), fill=(52, 36, 26))
    for i in range(7):
        d.line((ESW * 0.5, horizonte, ESW * (i / 6.0), ESH), fill=(36, 24, 18), width=3)
    for yy in (0.74, 0.84, 0.95):
        d.line((0, ESH * yy, ESW, ESH * yy), fill=(40, 27, 20), width=2)

    # ventana con noche y luna
    vx1, vy1, vx2, vy2 = ESW * 0.13, ESH * 0.16, ESW * 0.40, ESH * 0.44
    d.rectangle((vx1 - 10, vy1 - 10, vx2 + 10, vy2 + 10), fill=(74, 52, 34))
    d.rectangle((vx1, vy1, vx2, vy2), fill=(11, 13, 30))
    mx2, my2 = (vx1 + vx2) / 2, (vy1 + vy2) / 2 - (vy2 - vy1) * 0.15
    mr2 = (vy2 - vy1) * 0.16
    d.ellipse((mx2 - mr2, my2 - mr2, mx2 + mr2, my2 + mr2), fill=(230, 232, 205))
    estrellitas = [(rng.uniform(vx1 + 10, vx2 - 10), rng.uniform(vy1 + 10, vy2 - 10),
                    rng.uniform(2.0, 4.0), rng.uniform(0, 6.3)) for _ in range(3)]
    d.rectangle(((vx1 + vx2) / 2 - 5, vy1, (vx1 + vx2) / 2 + 5, vy2), fill=(74, 52, 34))
    d.rectangle((vx1, (vy1 + vy2) / 2 - 5, vx2, (vy1 + vy2) / 2 + 5), fill=(74, 52, 34))
    d.rounded_rectangle((vx1 - 26, vy1 - 18, vx1 + 18, vy2 + 30), radius=10, fill=(96, 30, 44))
    d.rounded_rectangle((vx2 - 18, vy1 - 18, vx2 + 26, vy2 + 30), radius=10, fill=(96, 30, 44))

    # puerta entreabierta con luz cálida
    px1, py1, px2, py2 = ESW * 0.62, ESH * 0.30, ESW * 0.82, ESH * 0.70
    d.rectangle((px1, py1, px2, py2), fill=(58, 40, 26), outline=(30, 20, 14), width=4)
    d.rectangle((px2 - (px2 - px1) * 0.12, py1, px2, py2), fill=(255, 214, 130))
    cono_puerta = _sprite_cono(int(0.30 * ESW), int(0.26 * ESH), (255, 214, 130), 70)
    cono_puerta = cono_puerta.rotate(-90, expand=True, resample=Image.BILINEAR)

    # sombra alargada en la pared (respira)
    w_s, h_s = int(0.075 * ESW), int(0.30 * ESH)
    sombra = _rgba((w_s, h_s), lambda dd: dd.polygon(
        [(w_s * 0.50, 0), (w_s * 0.66, h_s * 0.10), (w_s * 0.62, h_s * 0.30),
         (w_s * 0.95, h_s * 0.96), (w_s * 0.05, h_s * 0.96), (w_s * 0.38, h_s * 0.30),
         (w_s * 0.34, h_s * 0.10)], fill=(8, 5, 10, 235)), 2)

    # lámpara colgante estática + charco de luz animado
    lx = ESW * 0.5
    d.line((lx, 0, lx, ESH * 0.085), fill=(20, 14, 18), width=4)
    d.polygon([(lx - 34, ESH * 0.085 + 22), (lx + 34, ESH * 0.085 + 22),
               (lx + 14, ESH * 0.085), (lx - 14, ESH * 0.085)], fill=(46, 30, 36))
    d.ellipse((lx - 22, ESH * 0.085 + 20, lx + 22, ESH * 0.085 + 44), fill=(255, 224, 150))
    charco = _rgba((int(0.34 * ESW), int(0.10 * ESH)),
                   lambda dd: dd.ellipse((0, 0, 0.34 * ESW, 0.10 * ESH),
                                         fill=(255, 224, 150, 60)), 10)

    base = _vineta(base, 0.46)
    pe = _sprite_personaje(int(0.34 * ESH), pose=0, de_espaldas=True)

    def animar(t: float, img: Image.Image) -> None:
        dd = ImageDraw.Draw(img)
        for sx, sy, frec, fase in estrellitas:
            b = max(0.0, np.sin(t * frec + fase))
            r = 1.4 + 1.2 * b
            v = int(150 + 100 * b)
            dd.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(v, v, 255))
        _pegar(img, cono_puerta, px2 - cono_puerta.width, py2 - cono_puerta.height / 2,
               0.70 + 0.30 * np.sin(t * 2.6 + 1.0))
        f_s = 1.0 + 0.035 * np.sin(t * 1.1)
        mini = sombra.resize((max(1, int(w_s * f_s)), max(1, int(h_s * f_s))), Image.BILINEAR)
        _pegar(img, mini, ESW * 0.47 - mini.width / 2, ESH * 0.20, 1.0)
        _pegar(img, charco, lx - charco.width / 2, ESH * 0.70,
               0.65 + 0.35 * np.sin(t * 2.2))
        _pegar(img, pe, ESW * 0.5 - pe.width / 2 + np.sin(t * 0.5) * 3,
               ESH - pe.height * 0.82)

    return base, animar


def _escena_bosque():
    """Bosque: niebla, linterna que barre y ojos que parpadean entre troncos."""
    rng = random.Random(random.randrange(2 ** 31))
    base = _degradado((6, 10, 9), (16, 26, 20))
    d = ImageDraw.Draw(base)
    horizonte = int(ESH * 0.34)
    d.rectangle((0, horizonte, ESW, ESH), fill=(10, 16, 13))
    for _ in range(50):
        x = rng.uniform(0, ESW)
        y = rng.uniform(0, horizonte * 0.9)
        r = rng.uniform(0.8, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(205, 215, 245))
    for _ in range(14):
        cx = rng.uniform(0, ESW)
        r = rng.uniform(0.05, 0.11) * ESW
        d.ellipse((cx - r, horizonte - r * 0.9, cx + r, horizonte + r * 0.3),
                  fill=(13, 22, 17))
    for _ in range(8):
        tx = rng.uniform(0, ESW)
        tw = rng.uniform(0.018, 0.03) * ESW
        d.polygon([(tx, horizonte), (tx + tw, horizonte),
                   (tx + tw * 1.6, ESH * 0.98), (tx + tw * 0.7, ESH * 0.98)],
                  fill=(20, 30, 24))

    frontales = []
    for _ in range(3):
        tx = rng.uniform(0.05, 0.95) * ESW
        tw = rng.uniform(0.05, 0.085) * ESW
        w_f, h_f = int(tw), int(ESH * 0.85)
        tronco = _rgba((w_f, h_f), lambda dd, w=w_f, h=h_f: dd.polygon(
            [(0, 0), (w, 0), (w * 0.82, h), (w * 0.30, h)], fill=(8, 13, 10, 255)), 1)
        frontales.append((tronco, tx, ESH * 0.18))

    antorcha = _sprite_cono(int(0.42 * ESW), int(0.60 * ESH), (255, 250, 220), 46)
    ojos = _sprite_ojos(1.5)
    ojo_x = rng.uniform(0.55, 0.75) * ESW
    ojo_y = rng.uniform(0.50, 0.62) * ESH
    nieblas = [(_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.50, rng.uniform(10, 18)),
               (_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.66, rng.uniform(16, 28)),
               (_sprite_niebla(int(ESW * 0.95)), rng.uniform(0, ESW),
                ESH * 0.84, rng.uniform(24, 40))]
    base = _vineta(base, 0.55)

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
                           color=(150, 60, 80), piel=(216, 180, 150))
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
    base = _degradado((7, 10, 20), (30, 22, 42))
    horizonte = int(ESH * 0.58)
    titilantes, nubes = _cielo_noche(base, rng, con_luna=True)
    d = ImageDraw.Draw(base)
    d.rectangle((0, horizonte, ESW, ESH), fill=(16, 22, 18))
    for _ in range(120):
        gx = rng.uniform(0, ESW)
        gy = rng.uniform(horizonte, ESH)
        d.line((gx, gy, gx + rng.uniform(-6, 6), gy - rng.uniform(4, 9)),
               fill=(20, 30, 22), width=2)
    for lx, esc in ((0.08, 1.15), (0.90, 1.05)):
        px = lx * ESW
        d.polygon([(px, horizonte), (px + 0.05 * ESW * esc, horizonte),
                   (px + 0.025 * ESW * esc, ESH * 0.30)], fill=(9, 13, 11))
        for k in range(3):
            r = rng.uniform(0.05, 0.09) * ESW * esc
            cy = ESH * 0.30 - k * 0.055 * ESH
            d.ellipse((px + 0.02 * ESW * esc - r, cy - r * 0.6,
                       px + 0.02 * ESW * esc + r, cy + r * 0.6), fill=(11, 17, 14))

    # columpio con asiento animado
    cx1, cy1 = ESW * 0.24, ESH * 0.46
    d.line((cx1 - ESW * 0.08, cy1, cx1 + ESW * 0.08, cy1), fill=(12, 16, 14), width=8)
    for fx in (-0.075, 0.075):
        d.line((cx1 + ESW * fx, cy1, cx1 + ESW * fx * 1.55, ESH * 0.70),
               fill=(12, 16, 14), width=7)
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
                        radius=6, fill=(30, 24, 34))
    d.rounded_rectangle((bx1, ESH * 0.55, bx1 + ESW * 0.14, ESH * 0.575),
                        radius=6, fill=(30, 24, 34))
    for lx2 in (0.01, 0.12):
        d.line((bx1 + ESW * lx2, ESH * 0.58, bx1 + ESW * lx2, ESH * 0.70),
               fill=(30, 24, 34), width=6)

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
    base = _vineta(base, 0.50)

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


_ESCENAS = {
    "calle": _escena_calle,
    "casa": _escena_casa,
    "bosque": _escena_bosque,
    "tienda": _escena_tienda,
    "parque": _escena_parque,
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
    resto = ["casa", "bosque", "tienda", "parque"]
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


