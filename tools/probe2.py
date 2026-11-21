import sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
nes.run_frames(100)
def st(tag):
    print(tag, "pc", hex(nes.mpu.pc), {hex(a): nes.ram[a] for a in (0x12,0x59,0x5F,0x60,0x68,0x70,0x71,0x72)})
st("at100")
for f in range(90):
    nes.pad = 0x08 if f < 6 else 0
    nes.run_frames(1)
    if f in (0,1,2,5,10,20,40,60,89):
        st("f%d"%f)
