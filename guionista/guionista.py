# -*- coding: utf-8 -*-
"""El guionista: convierte una tarjeta de tema (español) en los 3 archivos de un video.

  python guionista/guionista.py --estilo inside-out --tarjeta chicle --salida <proyecto>

Tarjetas: guionista/pools/<estilo>.json  →  { estilo, voz, velocidad, musica, lead, outro, gap,
  tarjetas: [ { id, titulo, desc, tags, fuentes, lineas: [{texto, pausa?, caps?, break?}], tomas: [...] } ] }

Escribe en el proyecto:
  script.json  { title, voice, speed, lead, outro, gap, music, sources, lines }
  plan.json    { estilo, titulo, lineas, tomas }   (lo consume src/shots.js del proyecto)
  meta.json    { titulo, descripcion, tags, fuente_estilo }   (lo consume el publicador)

Valida ANTES de escribir:
  · toda palabra ancla (ancla_* en params) existe en el texto de su línea (normalizada como timing.js)
  · escena y objeto existen en la biblioteca del estilo
  · líneas terminan en . ? ! o , según cierre de frase (avisa si el guion no cierra bien)

Los "caps" los hace el motor solo (chunking 2-3 palabras); la tarjeta puede forzar "caps": "A | B *C".
"""
import argparse, json, re, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
POOLS = RAIZ / 'guionista' / 'pools'

# bibliotecas por estilo: escenas válidas y objetos válidos (deben coincidir con src/core/gen.js de cada estilo)
BIBLIOTECAS = {
    'inside-out': {
        'escenas': ['hablando', 'viaje', 'estomago', 'dibujo', 'mito', 'intestino', 'crono', 'lluvia', 'bloqueo', 'final', 'peligro', 'organo'],
        'objetos': ['chicle', 'moneda', 'iman', 'bateria', 'hueso', 'cerebro', 'pastilla', 'gota', 'bacteria', 'nota', 'corazon', 'reloj', 'pelo'],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
    'deep-dive': {
        'escenas': ['hablando', 'respira', 'corazon', 'cerebro', 'sangre', 'alarma', 'golpe', 'dato', 'apagon', 'final', 'esqueleto', 'pesas'],
        'objetos': [],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
    'night-file': {
        'escenas': ['caso', 'hablando', 'documento', 'foto', 'hilo', 'dato', 'girar', 'apagon', 'final'],
        'objetos': [],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
    'tall-tale': {
        'escenas': ['mundo', 'heroe', 'camina', 'bestia', 'choque', 'giro', 'tormenta', 'final'],
        'objetos': [],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
    'paper-atlas': {
        'escenas': ['mapa', 'ruta', 'pin', 'zona', 'dato', 'sello', 'brujula', 'final'],
        'objetos': [],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
    'stick-story': {
        'escenas': ['figura', 'habla', 'accion', 'obstaculo', 'caida', 'idea', 'duelo', 'final'],
        'objetos': [],
        'voces': ['em_alex', 'ef_dora', 'em_santa'],
    },
}

norm = lambda w: re.sub(r"[^a-z0-9']+", '', w.lower())


def palabras(ln_texto):
    return re.sub(r'[¿?¡!.,;:«»"]', ' ', ln_texto).split()


def caps_auto(texto):
    """chunking 2-3 palabras (4 → 2+2), * en la más larga — la misma regla que el motor aplica solo."""
    ws = texto.upper().split()
    out, i = [], 0
    while i < len(ws):
        n = 2 if len(ws) - i == 4 else min(3, len(ws) - i)
        ch = ws[i:i + n]
        k = max(range(n), key=lambda j: len(re.sub(r'[^A-ZÁÉÍÓÚÜÑ]', '', ch[j])))
        out.append(' '.join(('*' + w if j == k else w) for j, w in enumerate(ch)))
        i += n
    return ' | '.join(out)


def validar_tarjeta(est, t, biblio):
    err = []
    nlin = len(t['lineas'])
    vistos = set()
    for i, ln in enumerate(t['lineas']):
        tx = ln['texto'].strip()
        if not tx:
            err.append(f'linea {i} vacía'); continue
        ws = [norm(w) for w in palabras(tx)]
        ws = [w for w in ws if w]
        if not ws:
            err.append(f'linea {i} sin palabras útiles'); continue
        for w in ws:
            vistos.add((i, w))
        # cierre de frase: . ! ? o coma (una línea nunca debe terminar en ":" o "¿")
        if tx[-1] not in '.!?,…':
            err.append(f'linea {i} termina en "{tx[-1]}" (usa , . ! ?)')
    for tomo in t.get('tomas', []):
        lid = tomo.get('linea', 0)
        if lid < 0 or lid >= nlin:
            err.append(f'toma {tomo.get("id")}: linea {lid} fuera de rango (0..{nlin - 1})'); continue
        if tomo.get('escena') not in biblio['escenas']:
            err.append(f'toma {tomo.get("id")}: escena desconocida "{tomo.get("escena")}"'); continue
        p = tomo.get('params') or {}
        if p.get('objeto') and p['objeto'] not in biblio['objetos']:
            err.append(f'toma {tomo.get("id")}: objeto desconocido "{p["objeto"]}"'); continue
        for k, v in p.items():
            if k.startswith('ancla_'):
                ws = {norm(w) for w in palabras(t['lineas'][lid]['texto'])}
                if norm(v) not in ws:
                    err.append(f'toma {tomo.get("id")}: ancla "{v}" no está en la línea {lid} ("{t["lineas"][lid]["texto"]}")')
    return err


def construir(est, t, biblio):
    """tarjeta → (script, plan, meta)"""
    # guion
    lineas = []
    for ln in t['lineas']:
        e = {'text': ln['texto'].strip()}
        if ln.get('caps'):
            e['caps'] = ln['caps']
        if ln.get('break'):
            e['break'] = True
        if ln.get('pausa') is not None:
            e['gap'] = float(ln['pausa'])
        lineas.append(e)
    script = {
        'title': t['titulo'],
        'voice': est.get('voz', 'em_alex'),
        'speed': float(est.get('velocidad', 1.0)),
        'lead': float(est.get('lead', 0.45)),
        'outro': float(est.get('outro', 0.9)),
        'gap': float(est.get('gap', 0.32)),
        'music': est.get('musica', 'bed'),
        'sources': t.get('fuentes', []),
        'lines': lineas,
    }
    # caps automáticos donde no hay caps propio
    for e in script['lines']:
        if 'caps' not in e:
            auto = caps_auto(e['text'])
            if auto:
                e['caps'] = auto
    # plan
    plan = {
        'estilo': est['estilo'],
        'titulo': t['titulo'],
        'lineas': [{'texto': ln['texto'].strip()} for ln in t['lineas']],
        'tomas': t.get('tomas', []),
    }
    # meta de YouTube
    tags = t.get('tags', [])[:25]
    fuentes = ' · '.join(t.get('fuentes', [])[:2]) or 'Fuentes verificadas en el guion.'
    meta = {
        'titulo': t.get('meta_titulo', t['titulo'])[:100],
        'descripcion': (t.get('desc', '') + '\n\n' + fuentes).strip()[:4900],
        'tags': tags,
        'fuente_estilo': est['estilo'],
    }
    return script, plan, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--estilo', required=True, choices=sorted(BIBLIOTECAS))
    ap.add_argument('--tarjeta', required=True, help='id de la tarjeta en la pool del estilo')
    ap.add_argument('--salida', required=True, help='carpeta del proyecto (con src/, tools/…)')
    a = ap.parse_args()
    pool = json.loads((POOLS / f'{a.estilo}.json').read_text(encoding='utf-8'))
    biblio = BIBLIOTECAS[a.estilo]
    if a.tarjeta not in {t['id'] for t in pool['tarjetas']}:
        sys.exit(f'tarjeta "{a.tarjeta}" no está en pools/{a.estilo}.json')
    t = next(t for t in pool['tarjetas'] if t['id'] == a.tarjeta)
    est = {'estilo': a.estilo, **{k: v for k, v in pool.items() if k != 'tarjetas'}}
    errores = validar_tarjeta(est, t, biblio)
    if errores:
        sys.exit('GUION INVÁLIDO:\n  ' + '\n  '.join(errores))
    script, plan, meta = construir(est, t, biblio)
    P = Path(a.salida)
    (P / 'script.json').write_text(json.dumps(script, ensure_ascii=False, indent=1), encoding='utf-8')
    (P / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')
    (P / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'guionista: {a.estilo}/{a.tarjeta} → {P}/script.json + plan.json + meta.json ({len(script["lines"])} líneas, {len(plan["tomas"])} tomas)')


if __name__ == '__main__':
    main()
