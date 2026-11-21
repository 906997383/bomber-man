import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import nes as NESMOD
from py65.devices.mpu6502 import MPU

SIZES = {'imp':1,'acc':1,'imm':2,'zpg':2,'zpx':2,'zpy':2,'abs':3,'abx':3,'aby':3,
         'ind':3,'inx':2,'iny':2,'rel':2}

def dis(nes, pc, end):
    out=[]
    while pc < end:
        op = nes.read(pc)
        mn, mode = MPU.disassemble[op]
        size = SIZES.get(mode, 1)
        b = [nes.read(pc+i) for i in range(size)]
        if mode=='imm': arg = "#$%02X"%b[1]
        elif mode=='zpg': arg="$%02X"%b[1]
        elif mode=='zpx': arg="$%02X,X"%b[1]
        elif mode=='zpy': arg="$%02X,Y"%b[1]
        elif mode=='abs': arg="$%04X"%(b[1]|b[2]<<8)
        elif mode=='abx': arg="$%04X,X"%(b[1]|b[2]<<8)
        elif mode=='aby': arg="$%04X,Y"%(b[1]|b[2]<<8)
        elif mode=='ind': arg="($%04X)"%(b[1]|b[2]<<8)
        elif mode=='inx': arg="($%02X,X)"%b[1]
        elif mode=='iny': arg="($%02X),Y"%b[1]
        elif mode=='rel': arg="$%04X"%((pc+2+((b[1]^0x80)-0x80))&0xFFFF)
        else: arg=""
        out.append("%04X  %-8s %-24s ; raw %s"%(pc, mn+('' if mode in ('imp','acc') else ' '+mode), arg, ' '.join('%02X'%x for x in b)))
        pc += size
    return out

if __name__=='__main__':
    rom=open(sys.argv[1],'rb').read()
    nes=NESMOD.NES(rom)
    for l in dis(nes, int(sys.argv[2],16), int(sys.argv[3],16)):
        print(l)
