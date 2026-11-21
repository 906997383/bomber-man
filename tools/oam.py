import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
from PIL import Image

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
def run(n,pad=0):
    nes.pad=pad; nes.run_frames(n)
run(120); run(8,0x08); run(20,0); run(200,0)

def dump_oam(tag):
    print("==",tag)
    for i in range(64):
        y,x,t,a = nes.oam[i*4:i*4+4]
        if y>=0xEF: continue
        print("  s%02d y=%3d x=%3d tile=%02X attr=%02X"%(i,y+1,x,t,a))

dump_oam("stage1")
# dump sprite + bg palettes
print("pal", " ".join("%02X"%p for p in nes.pal))
# save a big zoom of the play area
nes.render().resize((768,720), Image.NEAREST).save(r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\stage1_big.png')

# Walk right to see movement frames
run(20,0x80); dump_oam("walk_right")
run(10,0x01); run(20,0); dump_oam("bomb")
run(40,0); dump_oam("explosion")
nes.render().resize((768,720), Image.NEAREST).save(r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\stage1_bomb.png')
