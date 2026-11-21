import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
from PIL import Image

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
outdir=r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\g2'
os.makedirs(outdir,exist_ok=True)

def snap(name):
    nes.render().resize((512,480), Image.NEAREST).save(os.path.join(outdir,name+'.png'))
    nt=nes.vram[0:0x400]
    open(os.path.join(outdir,name+'.txt'),'w').write(
      "pal="+" ".join("%02X"%p for p in nes.pal)+"\n"+
      "\n".join(" ".join("%02X"%t for t in nt[r*32:(r+1)*32]) for r in range(30)))

def run(n, pad=0):
    nes.pad=pad
    nes.run_frames(n)

run(120)
run(8,0x08); run(20,0)      # press start, release -> game
for i in range(20):
    run(30,0)
    snap('s%02d'%i)
print("pc",hex(nes.mpu.pc),"0x12",hex(nes.ram[0x12]),"0x59",nes.ram[0x59],"0x60",nes.ram[0x60],"0x68",nes.ram[0x68])
