"""Generate Android launcher icons from the original player sprite."""
from PIL import Image, ImageDraw

NES = [(84,84,84),(0,30,116),(8,16,144),(48,0,136),(68,0,100),(92,0,48),(84,4,0),(60,24,0),
       (32,42,0),(8,58,0),(0,64,0),(0,60,0),(0,50,60),(0,0,0),(0,0,0),(0,0,0),
       (152,150,152),(8,76,196),(48,50,236),(92,30,228),(136,20,176),(160,20,100),(152,34,32),(120,60,0),
       (84,90,0),(40,114,0),(8,124,0),(0,118,40),(0,102,120),(0,0,0),(0,0,0),(0,0,0),
       (236,238,236),(76,154,236),(120,124,236),(176,98,236),(228,84,236),(236,88,180),(236,106,100),(212,136,32),
       (160,170,0),(116,196,0),(76,208,32),(56,204,108),(56,180,204),(60,60,60),(0,0,0),(0,0,0),
       (236,238,236),(168,204,236),(188,188,236),(212,178,236),(236,174,236),(236,174,212),(236,182,176),(228,196,144),
       (204,210,120),(180,222,120),(168,226,144),(152,226,180),(160,214,228),(160,162,160),(0,0,0),(0,0,0)]

ROM = r'c:\Users\888\.trae-cn\attachments\a0706d97-15c1-4ab8-b960-04206fb692f0_60ca073e-9d31-402f-a7a9-a1a7a917dad3_326_炸弹人.nes'
chr_data = open(ROM, 'rb').read()[16 + 16384:]
PAL = [0x0F, 0x30, 0x21, 0x26]
GREEN = NES[0x19]
DARK = (8, 40, 0)

sprite = Image.new('RGBA', (16, 16))
for t, (ox, oy) in ((0x00, (0, 0)), (0x01, (8, 0)), (0x10, (0, 8)), (0x11, (8, 8))):
    for y in range(8):
        lo = chr_data[t * 16 + y]
        hi = chr_data[t * 16 + 8 + y]
        for x in range(8):
            c = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1)
            if c:
                sprite.putpixel((ox + x, oy + y), NES[PAL[c]] + (255,))


def background(size, circle=False):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # subtle checker
    if circle:
        d.ellipse([0, 0, size - 1, size - 1], fill=GREEN)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=GREEN)
    step = max(2, size // 8)
    for gy in range(0, size, step):
        for gx in range(0, size, step):
            if ((gx // step) + (gy // step)) % 2 == 0:
                d.rectangle([gx, gy, gx + step - 1, gy + step - 1], fill=DARK)
    if circle:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        im.putalpha(mask)
    return im


def compose(size, ratio, circle=False, transparent_bg=False):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if not transparent_bg:
        im = background(size, circle)
    inner = int(size * ratio)
    inner = max(16, inner - inner % 16)
    big = sprite.resize((inner, inner), Image.NEAREST)
    off = (size - inner) // 2
    im.alpha_composite(big, (off, off))
    return im


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
base = 'android/app/src/main/res'

for name, mult in DENSITIES.items():
    legacy = int(48 * mult)
    fg = int(108 * mult)
    compose(legacy, 0.72).convert('RGBA').save('%s/mipmap-%s/ic_launcher.png' % (base, name))
    compose(legacy, 0.72, circle=True).save('%s/mipmap-%s/ic_launcher_round.png' % (base, name))
    compose(fg, 0.5, transparent_bg=True).save('%s/mipmap-%s/ic_launcher_foreground.png' % (base, name))

with open('%s/values/ic_launcher_background.xml' % base, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            '    <color name="ic_launcher_background">#0A2A00</color>\n</resources>\n')

print('android icons ok')
