import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

reads = {'r4016':0,'r4017':0,'w4016':0,'vals':{}}
orig_read = NESMOD.NES.read
orig_write = NESMOD.NES.write
def read(self, a):
    a &= 0xFFFF
    if a in (0x4016, 0x4017):
        reads['r4016' if a==0x4016 else 'r4017'] += 1
        v = orig_read(self, a)
        reads['vals'][v] = reads['vals'].get(v,0)+1
        return v
    return orig_read(self, a)
def write(self, a, v):
    if (a & 0xFFFF) == 0x4016:
        reads['w4016'] += 1
    return orig_write(self, a, v)
NESMOD.NES.read = read
NESMOD.NES.write = write

rom = open(sys.argv[1],'rb').read()
nes = NESMOD.NES(rom)
nes.pad = 0x08
nes.run_frames(200)
print(reads)
print("pc", hex(nes.mpu.pc))
# where does it read pad? trace pc on read of 4016
hits=[]
def read2(self, a):
    if (a&0xFFFF)==0x4016:
        hits.append(hex(self.mpu.pc))
    return read(self,a)
NESMOD.NES.read = read2
nes.run_frames(3)
print("pc hits", hits[:20], "count", len(hits))
