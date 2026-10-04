#!/usr/bin/env python3
"""
Finish the README images: docs/charging.gif from the frames tools/screenshots.js rendered, and
docs/faceplates.png, the five faceplates side by side.

Usage (from the repository root): python tools/make_docs.py
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
FACEPLATES = [('white', 'White (standard glass)'), ('solid_black', 'Solid Black'),
              ('midnight_silver_metallic', 'Midnight Silver Metallic'),
              ('deep_blue_metallic', 'Deep Blue Metallic'), ('red_multi_coat', 'Red Multi-Coat')]


def font(size):
    for f in ['/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def gif():
    frames_dir = DOCS / 'frames'
    paths = sorted(frames_dir.glob('*.png'))
    if not paths:
        print('No frames in docs/frames (run tools/screenshots.js first); skipping the GIF')
        return
    frames = [Image.open(p).convert('RGB') for p in paths]
    pal = frames[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    frames = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    frames[0].save(DOCS / 'charging.gif', save_all=True, append_images=frames[1:], duration=100, loop=0,
                   optimize=True, disposal=1)
    shutil.rmtree(frames_dir)
    print(f'docs/charging.gif ({(DOCS / "charging.gif").stat().st_size / 1024:.0f} KB)')


def gallery():
    tile_w, tile_h, label_h, pad = 260, 400, 44, 18
    sheet = Image.new('RGB', (tile_w * len(FACEPLATES), tile_h + label_h), (19, 20, 22))
    draw = ImageDraw.Draw(sheet)
    f = font(16)
    for i, (key, name) in enumerate(FACEPLATES):
        unit = Image.open(ROOT / 'assets' / 'faceplates' / f'{key}.webp').convert('RGBA')
        s = min((tile_w - 2 * pad) / unit.width, (tile_h - pad) / unit.height)
        unit = unit.resize((round(unit.width * s), round(unit.height * s)), Image.LANCZOS)
        sheet.paste(unit, (i * tile_w + (tile_w - unit.width) // 2, pad), unit)
        tw = draw.textlength(name, font=f)
        draw.text((i * tile_w + (tile_w - tw) / 2, tile_h + 12), name, fill=(200, 203, 208), font=f)
    sheet.save(DOCS / 'faceplates.png', optimize=True)
    print('docs/faceplates.png')


if __name__ == '__main__':
    gif()
    gallery()
