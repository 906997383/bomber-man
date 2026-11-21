"""Preview of the procedural pixel art used by www/js/game.js (bombs, fire, items, door)."""
from PIL import Image, ImageDraw

WHITE = (236, 238, 236, 255)
RED = (236, 106, 100, 255)
DARK = (152, 34, 32, 255)
BLUE = (76, 154, 236, 255)
GREY = (152, 150, 152, 255)
GREEN = (40, 114, 0, 255)


def circle(im, cx, cy, r, color):
    d = ImageDraw.Draw(im)
    for y in range(-r, r + 1):
        w = int((r * r - y * y) ** 0.5 + 0.5)
        d.line([(cx - w, cy + y), (cx + w, cy + y)], fill=color)


def bomb(frame):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([9, 4, 9, 5], fill=(0, 0, 0, 255))
    d.rectangle([10, 2, 10, 3], fill=(0, 0, 0, 255))
    d.rectangle([11, 1, 11, 2], fill=(0, 0, 0, 255))
    circle(im, 8, 10, 6, (0, 0, 0, 255))
    circle(im, 8, 10, 5, GREY)
    circle(im, 7, 9, 4, WHITE)
    circle(im, 6, 8, 1, WHITE)
    sparks = [(10, 1), (11, 0), (12, 1), (11, 0)]
    sx, sy = sparks[frame]
    d.rectangle([sx, sy, sx + 1, sy + 1], fill=RED)
    d.rectangle([sx, sy, sx, sy], fill=WHITE)
    return im


def flame(f):
    cfg = [(2, 4), (3, 6), (5, 8), (7, 9)]
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(16):
        for x in range(16):
            dist = abs(x - 8) + abs(y - 8)
            j = 1 if (x * 7 + y * 13 + f * 31) % 5 == 0 else 0
            if dist <= cfg[f][0]:
                col = WHITE
            elif dist <= cfg[f][1] + j:
                col = RED
            elif f >= 2 and dist <= cfg[f][1] + j + 1:
                col = DARK
            else:
                continue
            d.point((x, y), fill=col)
    return im


def item(kind):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([2, 2, 13, 13], fill=(0, 0, 0, 255))
    d.rectangle([3, 3, 12, 12], fill=WHITE)
    if kind == 'fire':
        d.rectangle([7, 4, 8, 5], fill=RED)
        d.rectangle([6, 6, 9, 7], fill=RED)
        d.rectangle([5, 8, 10, 11], fill=RED)
        d.rectangle([7, 8, 8, 10], fill=WHITE)
    elif kind == 'bomb':
        d.rectangle([6, 7, 9, 7], fill=(0, 0, 0, 255))
        d.rectangle([5, 8, 10, 11], fill=(0, 0, 0, 255))
        d.rectangle([6, 12, 9, 12], fill=(0, 0, 0, 255))
        d.rectangle([6, 9, 6, 9], fill=GREY)
        d.rectangle([10, 6, 10, 6], fill=(0, 0, 0, 255))
        d.rectangle([11, 5, 11, 5], fill=(0, 0, 0, 255))
    else:
        d.polygon([(4, 5), (7, 8), (4, 11)], fill=BLUE)
        d.polygon([(8, 5), (11, 8), (8, 11)], fill=BLUE)
    return im


def door():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([3, 4, 12, 15], fill=(0, 0, 0, 255))
    d.rectangle([4, 2, 11, 2], fill=WHITE)
    d.rectangle([3, 3, 12, 3], fill=WHITE)
    d.rectangle([2, 4, 2, 14], fill=WHITE)
    d.rectangle([13, 4, 13, 14], fill=WHITE)
    d.rectangle([2, 15, 13, 15], fill=WHITE)
    d.rectangle([4, 6, 11, 14], fill=(0, 0, 0, 255))
    d.rectangle([4, 5, 11, 5], fill=BLUE)
    d.rectangle([11, 10, 11, 10], fill=GREY)
    return im


tiles = [bomb(0), bomb(1), bomb(2), bomb(3), flame(0), flame(1), flame(2), flame(3),
         item('fire'), item('bomb'), item('speed'), door()]
S = 6
out = Image.new('RGBA', (S * 18 + 12 * (S * 16 + 6), S * 16 + 24), GREEN)
for i, t in enumerate(tiles):
    big = t.resize((16 * S, 16 * S), Image.NEAREST)
    out.alpha_composite(big, (i * (16 * S + 6) + 6, 12))
out.save('analysis/art_preview.png')
print('ok')
