#!/usr/bin/env python3
"""
Build dist/tesla-wall-connector-card.js: the card from src/, with every faceplate photo from
assets/faceplates/ inlined, so the card is a single file that works from HACS or /config/www.

Usage (from the repository root): python tools/build.py
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'tesla-wall-connector-card.js'
OUT = ROOT / 'dist' / 'tesla-wall-connector-card.js'
FACEPLATES = ROOT / 'assets' / 'faceplates'


def data_uri(path):
    return 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode()


def main():
    code = SRC.read_text()

    def inline(m):
        name, in_use = m.group(1), m.group(2)
        path = FACEPLATES / f'{name}{"-in-use" if in_use else ""}.webp'
        if not path.exists():
            raise SystemExit(f'Missing {path.relative_to(ROOT)} (run tools/make_faceplates.py)')
        return data_uri(path)

    code, n = re.subn(r'__FP_([a-z_]+?)(_in_use)?__', inline, code)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text('/* Built by tools/build.py from src/tesla-wall-connector-card.js. Edit that file, not this one. */\n' + code)
    print(f'{OUT.relative_to(ROOT)}: {n} images, {OUT.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
