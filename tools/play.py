import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
from PIL import Image

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
outdir=r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\g'
os.makedirs(outdir,exist_ok=True)

def snap(name):
    nes.render().resize((512,480), Image.NEAREST).save(os.path.join(outdir,name+'.png'))
    nt=nes.vram[0:0x400]
    open(os.path.join(outdir,name+'.txt'),'w').write(
      "pal="+" ".join("%02X"%p for p in nes.pal)+"\n"+
      "\n".join(" ".join("%02X"%t for t in nt[r*32:(r+1)*32]) for r in range(30)))
    print("snap",name,"pc",hex(nes.mpu.pc),"0x59",nes.ram[0x59],"0x5F",nes.ram[0x5F],"0x60",nes.ram[0x60],"0x68",nes.ram[0x68])

def run(n, pad=0):
    nes.pad=pad
    nes.run_frames(n)

run(120); snap('t0_title')
run(10,0x08); run(20,0); snap('t1_after_release')   # title anim
run(20,0x08); run(8,0x08); snap('t2_start_held')    # press start in menu
run(30,0); snap('t3_30f')
run(60,0); snap('t4_60f')
run(120,0); snap('t5_180f')
run(30,0x80); snap('t6_right')
run(30,0x10); snap('t7_up')
run(10,0x01); run(30,0); snap('t8_bomb')
