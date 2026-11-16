# -*- coding: utf-8 -*-
"""Valida TODAS las tarjetas de una pool sin escribir proyectos.

  python guionista/validar_pool.py inside-out
  python guionista/validar_pool.py            (todas las pools)
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from guionista import validar_tarjeta, BIBLIOTECAS, POOLS


def chequear(est):
    pool = json.loads((POOLS / f'{est}.json').read_text(encoding='utf-8'))
    bad = 0
    for t in pool['tarjetas']:
        e = {'estilo': est, **{k: v for k, v in pool.items() if k != 'tarjetas'}}
        err = validar_tarjeta(e, t, BIBLIOTECAS[est])
        if err:
            bad += 1
            print(f'FAIL {t["id"]}:')
            for m in err:
                print('   ' + m)
    total = len(pool['tarjetas'])
    print(f'{est}: {total} tarjetas, {bad} con errores' + (' -- TODO OK' if bad == 0 else ''))
    return bad


if __name__ == '__main__':
    estilos = sys.argv[1:] or sorted(BIBLIOTECAS)
    n = sum(chequear(e) for e in estilos)
    sys.exit(1 if n else 0)
