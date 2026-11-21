import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
print("vectors NMI %04X RESET %04X IRQ %04X"%(nes.read16(0xFFFA),nes.read16(0xFFFC),nes.read16(0xFFFE)))
nes.pad=0x08
nes.run_frames(120)
print("depth", nes.nmi_depth, "sp", hex(nes.mpu.sp), "pc", hex(nes.mpu.pc))
# stack dump: return addresses
sp=nes.mpu.sp
print("stack:", " ".join("%02X"%nes.ram[0x100+i] for i in range(sp+1, 0x100)))
print("zero page 60-95:", " ".join("%02X"%nes.ram[i] for i in range(0x60,0x96)))
print("vram$2140.. ", " ".join("%02X"%nes.vram[i] for i in range(0,32)))
