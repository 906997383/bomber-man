import sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
nes.pad=0
nes.run_frames(120)
pcs=collections.Counter()
orig=nes.mpu.step
def step():
    if nes.nmi_depth==0:
        pcs[nes.mpu.pc]+=1
    return orig()
nes.mpu.step=step
nes.pad=0
nes.run_frames(2)
print("title main pc:", [(hex(p),c) for p,c in pcs.most_common(12)])
print("ram 0x70..0x73", [hex(nes.ram[i]) for i in range(0x70,0x74)], "0x5f", hex(nes.ram[0x5f]))
pcs.clear()
nes.pad=0x08
nes.run_frames(3)
print("pressed main pc:", [(hex(p),c) for p,c in pcs.most_common(12)])
print("0x59",nes.ram[0x59],"0x5f",nes.ram[0x5f],"0x60",nes.ram[0x60],"0x68",nes.ram[0x68],"0x70",nes.ram[0x70],"0x72",nes.ram[0x72])
