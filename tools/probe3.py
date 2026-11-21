import sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
nes.pad=0x08
nes.run_frames(400)
print("pad byte", hex(nes.ram[0x12]), "0x59", nes.ram[0x59], "0x70", nes.ram[0x70], "0x60", nes.ram[0x60], "0x72", nes.ram[0x72])
# histogram of PCs encountered while not in NMI
hist=collections.Counter()
orig_render = nes.render
def render_wrap():
    return orig_render()
nes.run_frames(3)
print("depth", nes.nmi_depth)

# sample pc during execution: patch step loop by sampling every instruction
class Tap:
    pass
pcs=collections.Counter()
orig_step = nes.mpu.step
def step():
    if nes.nmi_depth == 0:
        pcs[nes.mpu.pc]+=1
    return orig_step()
nes.mpu.step = step
nes.pad=0
nes.run_frames(2)
print("main pcs:", [(hex(p),c) for p,c in pcs.most_common(15)])
print("stack sp", hex(nes.mpu.sp))
