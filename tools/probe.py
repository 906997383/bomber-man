import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD

rom=open(sys.argv[1],'rb').read()
nes=NESMOD.NES(rom)
print("nmi vec", hex(nes.read16(0xFFFA)), "reset", hex(nes.read16(0xFFFC)), "irq", hex(nes.read16(0xFFFE)))
nes.pad=0
nes.run_frames(150)
print("hold none:", " ".join("%02X"%nes.ram[i] for i in range(0x10,0x20)))
nes.pad=0x10
for f in range(6):
    nes.run_frames(1)
    print("start f%d:"%f, " ".join("%02X"%nes.ram[i] for i in range(0x10,0x20)), "pc", hex(nes.mpu.pc))
nes.pad=0
for f in range(6):
    nes.run_frames(1)
    print("none f%d:"%f, " ".join("%02X"%nes.ram[i] for i in range(0x10,0x20)), "pc", hex(nes.mpu.pc))
