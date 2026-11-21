"""Generate Android splash screens from the emulated title screen."""
import glob
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TITLE = os.path.join(ROOT, 'analysis', 'g', 't0_title.png')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
BG = (0, 0, 0)

img = Image.open(TITLE).convert('RGB')
tw, th = img.size

for path in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    with Image.open(path) as cur:
        w, h = cur.size
    scale = int(min(w * 0.72 / tw, h * 0.72 / th))
    scale = max(1, scale)
    big = img.resize((tw * scale, th * scale), Image.NEAREST)
    canvas = Image.new('RGB', (w, h), BG)
    canvas.paste(big, ((w - big.width) // 2, (h - big.height) // 2))
    canvas.save(path)
    print(os.path.basename(os.path.dirname(path)), w, h, 'scale', scale)
print('splash ok')
