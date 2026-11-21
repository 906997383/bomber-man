import sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
nes.pad=0x08
trail=[]
hits=[]
orig_step=nes.mpu.step
count=[0]
def step():
    pc=nes.mpu.pc
    trail.append(pc)
    if len(trail)>60: trail.pop(0)
    if pc in (0xC000,0xC304,0xC30A) and count[0]<20:
        count[0]+=1
        hits.append((pc, list(trail)))
    return orig_step()
nes.mpu.step=step
nes.run_frames(30)
print("hits", count[0])
for pc,t in hits[:3]:
    print(hex(pc), "trail:", " ".join(hex(p) for p in t[-40:]))
print("08..0A", [hex(nes.ram[i]) for i in range(8,11)])
print("60..7F", " ".join("%02X"%nes.ram[i] for i in range(0x60,0x80)))
print("pc", hex(nes.mpu.pc), "depth", nes.nmi_depth)
