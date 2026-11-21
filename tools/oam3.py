import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
from PIL import Image
rom = open(sys.argv[1], 'rb').read()
nes = NESMOD.NES(rom)

def run(n, pad=0):
    nes.pad = pad
    nes.run_frames(n)

def dump(tag):
    sp = []
    for i in range(64):
        y, x, t, a = nes.oam[i*4:i*4+4]
        if y < 0xEF:
            sp.append((i, y, x, t, a))
    print(tag, ' '.join('%d:y%02X x%02X t%02X a%02X p%d%s%s' % (
        i, y, x, t, a, a & 3, '/flipH' if a & 0x40 else '', '/flipV' if a & 0x80 else '') for i, y, x, t, a in sp))

outdir = r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\oam'
os.makedirs(outdir, exist_ok=True)

run(120)
run(8, 0x08); run(20, 0)
for i in range(30):
    run(10, 0)
dump('pre%d' % i)
# place bomb (A = 0x01)
run(3, 0x01); run(3, 0)
for f in range(22):
    run(10, 0)
    dump('t%02d' % (f*10))
    if f % 2 == 0:
        nes.render().resize((512, 480), Image.NEAREST).save(os.path.join(outdir, 'e%02d.png' % f))
