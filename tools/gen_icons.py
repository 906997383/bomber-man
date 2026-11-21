import base64
from PIL import Image

NES = [(84,84,84),(0,30,116),(8,16,144),(48,0,136),(68,0,100),(92,0,48),(84,4,0),(60,24,0),
       (32,42,0),(8,58,0),(0,64,0),(0,60,0),(0,50,60),(0,0,0),(0,0,0),(0,0,0),
       (152,150,152),(8,76,196),(48,50,236),(92,30,228),(136,20,176),(160,20,100),(152,34,32),(120,60,0),
       (84,90,0),(40,114,0),(8,124,0),(0,118,40),(0,102,120),(0,0,0),(0,0,0),(0,0,0),
       (236,238,236),(76,154,236),(120,124,236),(176,98,236),(228,84,236),(236,88,180),(236,106,100),(212,136,32),
       (160,170,0),(116,196,0),(76,208,32),(56,204,108),(56,180,204),(60,60,60),(0,0,0),(0,0,0),
       (236,238,236),(168,204,236),(188,188,236),(212,178,236),(236,174,236),(236,174,212),(236,182,176),(228,196,144),
       (204,210,120),(180,222,120),(168,226,144),(152,226,180),(160,214,228),(160,162,160),(0,0,0),(0,0,0)]

src = r'c:\Users\888\.trae-cn\attachments\a0706d97-15c1-4ab8-b960-04206fb692f0_60ca073e-9d31-402f-a7a9-a1a7a917dad3_326_炸弹人.nes'
d = open(src, 'rb').read()[16 + 16384:]
pal = [0x0F, 0x30, 0x21, 0x26]
green = NES[0x19]
dark = (0, 30, 0)

sprite = Image.new('RGBA', (16, 16))
for t, (ox, oy) in ((0x00, (0, 0)), (0x01, (8, 0)), (0x10, (0, 8)), (0x11, (8, 8))):
    for y in range(8):
        lo = d[t * 16 + y]
        hi = d[t * 16 + 8 + y]
        for x in range(8):
            c = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1)
            if c:
                sprite.putpixel((ox + x, oy + y), NES[pal[c]] + (255,))

for size in (192, 512):
    canvas = Image.new('RGB', (size, size), green)
    # simple checker of darker green squares for texture
    step = size // 8
    for gy in range(8):
        for gx in range(8):
            if (gx + gy) % 2 == 0:
                for yy in range(step):
                    for xx in range(step):
                        canvas.putpixel((gx * step + xx, gy * step + yy), dark)
    inner = int(size * 0.66)
    big = sprite.resize((inner, inner), Image.NEAREST)
    off = (size - inner) // 2
    canvas.paste(big, (off, off), big)
    canvas.save('www/assets/icon-%d.png' % size)
print('icons ok')
