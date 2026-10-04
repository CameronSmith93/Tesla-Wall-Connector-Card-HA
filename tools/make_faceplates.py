#!/usr/bin/env python3
"""
Cut the Gen 3 Wall Connector out of Tesla's product photos, one per faceplate, with the light bar
switched off, in two versions: handle docked, and handle out (in a car).

The four colour-matched photos are framed identically, so the outline is worked out once (from the
Midnight Silver photo) and shared. The white faceplate's glass comes from Tesla's white photo, put
onto the Midnight Silver photo's handle and cables (see white()), so all five match exactly.

Input: assets/photos/<name>.jpg. Output: assets/faceplates/<name>.webp and <name>-in-use.webp, all
the same size, so the card can use one set of positions (light bar, handle) for every faceplate.

Usage (from the repository root):
  pip install -r tools/requirements.txt
  python tools/make_faceplates.py
  python tools/build.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / 'assets' / 'photos'
OUT = ROOT / 'assets' / 'faceplates'
B = 248.0                                    # the photos' background
X0, Y0, W, H = 767, 440, 883, 1560           # crop box, in the colour photos
FACE_BOTTOM = 1452                           # bottom of the faceplate (photo y)
BAR = (997, 1096, 1356)                      # the light bar: x, top, bottom (photo coords)
CHIN_BOTTOM = 1512                           # the faceplate's lowest point (photo y)
CABLE_TOP, CABLE_X = 1488, (966, 1032)       # where the cable leaves the faceplate (photo coords)
RIM = 9                                      # width of the white glass's pale bevel to tone down (px)
WHITE_FIT = (0.781, 0.781, 220.0, 219.5)    # colour photo -> white photo: x scale, y scale, x, y offset
OUT_SCALE = 0.75

COLOURED = ['midnight_silver_metallic', 'solid_black', 'deep_blue_metallic', 'red_multi_coat']


def load(name):
    img = cv2.imread(str(PHOTOS / f'{name}.jpg'))
    if img is None: raise SystemExit(f'Missing {PHOTOS / name}.jpg')
    return img.astype(np.float32)             # BGR


def outline(ref):
    """Masks from the Midnight Silver photo: everything, and the faceplate plus centre cable only."""
    lum = ref.mean(axis=2); diff = np.abs(ref - B).max(axis=2)
    rows = np.arange(ref.shape[0])[:, None]
    # above the faceplate's bottom edge anything off-white is the charger; below it the soft shadow
    # is mid-grey, so only the dark cables count
    core = np.where(rows < FACE_BOTTOM - 12, diff > 45, lum < 135).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab = cv2.connectedComponents((core == 0).astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    for i in range(1, n):                     # fill the TESLA lettering
        if i in border: continue
        ys, _ = np.nonzero(lab == i)
        if ys.max() < 1400 and len(ys) < 30000: core[lab == i] = 1
    n2, lab2, st, _ = cv2.connectedComponentsWithStats(core, 8)
    core = np.isin(lab2, [i for i in range(1, n2) if st[i, cv2.CC_STAT_AREA] > 2000]).astype(np.uint8)
    # the faceplate's right edge, row by row: end of the first opaque run; where the handle touches
    # it there's no gap, so bridge those rows with a smooth fit
    edge = np.full(ref.shape[0], -1.0)
    for y in range(Y0, FACE_BOTTOM):
        xs = np.nonzero(core[y])[0]
        if not len(xs): continue
        gaps = np.nonzero(np.diff(xs) > 1)[0]
        edge[y] = xs[gaps[0]] if len(gaps) else xs[-1]
    ys = np.r_[np.arange(700, 930), np.arange(1160, 1400)]
    fit = np.polyfit(ys, edge[ys], 3)
    for y in range(930, 1160): edge[y] = np.polyval(fit, y)
    keep = np.zeros_like(core)
    for y in range(Y0, FACE_BOTTOM):
        if edge[y] >= 0: keep[y, :int(edge[y]) + 1] = 1
    keep &= cv2.dilate(core, np.ones((3, 3), np.uint8))
    # below the faceplate keep only what's joined to it (the centre cable)
    below = core.copy(); below[:FACE_BOTTOM] = 0
    lab4, n4 = ndimage.label(below | keep)
    joined = lab4 == lab4[1300, 900]
    keep = (keep | (joined & (below > 0))).astype(np.uint8)
    return core, keep, edge


def cut(img, core):
    """Foreground colour and alpha for one photo, given its outline."""
    h, w = core.shape
    inner = cv2.erode(core, np.ones((5, 5), np.uint8))
    small = cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA).astype(np.uint8)
    inner_s = cv2.resize(inner, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
    band = (cv2.dilate(inner_s, np.ones((9, 9), np.uint8)) > 0) & (inner_s == 0)
    F = cv2.resize(cv2.inpaint(small, band.astype(np.uint8), 4, cv2.INPAINT_TELEA), (w, h)).astype(np.float32)
    F = np.where(inner[..., None] > 0, img, F)
    a = np.clip(((B - img) / np.maximum(B - F, 1.0)).mean(axis=2), 0, 1)
    a[inner > 0] = 1
    a[~(cv2.dilate(core, np.ones((5, 5), np.uint8)) > 0)] = 0
    a[a < .05] = 0
    return F, a


def lights_off(F, light_faceplate, bar=BAR):
    """Paint out the lit light bar and its glow, then draw the unlit light guide as a hairline."""
    BAR_X, BAR_TOP, BAR_BOTTOM = bar
    gm = np.zeros(F.shape[:2], np.uint8)
    gm[BAR_TOP - 10:BAR_BOTTOM + 10, BAR_X - 8:BAR_X + 10] = 1
    reg = F[BAR_TOP - 36:BAR_BOTTOM + 44, BAR_X - 37:BAR_X + 43]
    glow = ((reg[..., 1] - np.maximum(reg[..., 0], reg[..., 2])) > 3).astype(np.uint8)
    gm[BAR_TOP - 36:BAR_BOTTOM + 44, BAR_X - 37:BAR_X + 43] |= glow
    gm = cv2.dilate(gm, np.ones((3, 3), np.uint8))
    F = cv2.inpaint(np.clip(F, 0, 255).astype(np.uint8), gm, 8, cv2.INPAINT_TELEA).astype(np.float32)
    step = -9 if light_faceplate else 7       # a darker line on white glass, a lighter one on colour
    for y in range(BAR_TOP, BAR_BOTTOM):
        t = (y - BAR_TOP) / (BAR_BOTTOM - BAR_TOP)
        for dx, k in [(-1, .45), (0, 1), (1, 1), (2, .45)]:
            F[y, BAR_X + dx] = np.clip(F[y, BAR_X + dx] + step * k * (1 - .3 * t), 0, 255)
    return F


def in_use(F, a, keep, edge):
    """Handle out: keep the faceplate and centre cable; re-draw the edge where the handle sat."""
    F2, a2 = F.copy(), a * keep
    for y in range(930, 1160):
        xi = int(edge[y])
        F2[y, xi - 1:xi + 2] = F[y, xi - 4]
        a2[y, xi + 1] = max(0, min(1, edge[y] - xi))
    return F2, a2


def save(F, a, path, white_box=None):
    rgba = np.dstack([F[..., 2], F[..., 1], F[..., 0], a * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    if white_box: im = im.crop(white_box).resize((W, H), Image.LANCZOS)
    else: im = im.crop((X0, Y0, X0 + W, Y0 + H))
    im = im.resize((round(W * OUT_SCALE), round(H * OUT_SCALE)), Image.LANCZOS)
    im.save(str(path), quality=90, method=6)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ref = load('midnight_silver_metallic')
    core, keep, edge = outline(ref)
    for name in COLOURED:
        img = load(name)
        F, a = cut(img, core)
        F = lights_off(F, False)
        save(F, a, OUT / f'{name}.webp')
        save(*in_use(F, a, keep, edge), OUT / f'{name}-in-use.webp')
        print('done', name)
    white(core, keep, edge)


def white(core, keep, edge, photo='white', fit=WHITE_FIT, out='white'):
    """The white faceplate, on exactly the same handle, cables and outline as the colour-matched
    ones.

    Tesla's white photo is a different render: framed differently, and with its own handle. So only
    its glass is used, mapped into the colour photos' frame (WHITE_FIT was fitted to the white
    photo's edges, to about a pixel), and everything else, handle, cables and outline, comes from
    the Midnight Silver photo. White glass on a white background would be hard to cut out anyway;
    this way it doesn't need to be."""
    k = lambda r: np.ones((2 * r + 1, 2 * r + 1), np.uint8)
    sx, sy, tx, ty = fit
    to_white = np.float32([[sx, 0, tx], [0, sy, ty]])
    to_colour = cv2.invertAffineTransform(to_white)
    face_c = keep.copy(); face_c[CHIN_BOTTOM:] = 0     # faceplate and chin, not the cable below it
    face_c[CABLE_TOP:, CABLE_X[0]:CABLE_X[1]] = 0
    # the glass, in the white photo's own frame
    img = load(photo)
    face = np.clip(cv2.warpAffine(face_c.astype(np.float32), to_white, (2000, 2000), flags=cv2.INTER_LINEAR), 0, 1)
    F, _ = cut(img, (face > .5).astype(np.uint8))    # edge colours without the background mixed in
    F = lights_off(F, True, (round(BAR[0] * sx + tx), round(BAR[1] * sy + ty), round(BAR[2] * sy + ty)))
    # The glass's bevel can catch the light as a pale rim, which against a dark card reads as a glow
    # down the shaded left side. Where the rim is paler than the glass just inside it, tone it down
    # towards that glass colour.
    inside = cv2.distanceTransform((face > .5).astype(np.uint8), cv2.DIST_L2, 5)
    ys, xs = np.nonzero(face > .5)
    y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
    deep = inside[y0:y1, x0:x1] > RIM
    inner = cv2.inpaint(np.clip(F[y0:y1, x0:x1], 0, 255).astype(np.uint8), (~deep).astype(np.uint8), 5,
                        cv2.INPAINT_TELEA).astype(np.float32)      # the glass colour, carried out to the edge
    Fc = F[y0:y1, x0:x1]
    w = np.clip(1 - inside[y0:y1, x0:x1] / RIM, 0, 1)[..., None] * .85
    w[(inside[y0:y1, x0:x1] == 0) & (face[y0:y1, x0:x1] > 0)] = 1   # the soft outermost pixels too
    pale = ((Fc.mean(axis=2) - inner.mean(axis=2)) > 4)[..., None] & (face[y0:y1, x0:x1] > 0)[..., None]
    F[y0:y1, x0:x1] = np.where(pale, inner * w + Fc * (1 - w), Fc)
    glass = cv2.warpAffine(F, to_colour, (2000, 2000), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # handle, cables and outline from the Midnight Silver photo
    ref = load('midnight_silver_metallic')
    Fr, a = cut(ref, core)
    rest = cv2.dilate((core & (1 - face_c)).astype(np.uint8), k(1)) > 0   # handle and cables
    region = (cv2.dilate(face_c, k(3)) > 0) & ~(rest & (face_c == 0))
    F = np.where(region[..., None], glass, Fr)
    save(F, a, OUT / f'{out}.webp')
    save(*in_use(F, a, keep, edge), OUT / f'{out}-in-use.webp')
    print('done', out)


if __name__ == '__main__':
    main()
