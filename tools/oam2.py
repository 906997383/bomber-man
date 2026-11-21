import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
def run(n,pad=0):
    nes.pad=pad; nes.run_frames(n)
run(120); run(8,0x08); run(20,0); run(200,0)
def dump(tag):
    sp=[(i,nes.oam[i*4],nes.oam[i*4+1],nes.oam[i*4+2],nes.oam[i*4+3]) for i in range(64) if nes.oam[i*4]<0xEF]
    print(tag, [(i,hex(t),hex(a)) for i,y,x,t,a in sp])
dump("idle")
run(3,0x01); run(2,0); dump("after A")
for f in range(6): run(4,0); dump("t%d"%f)
