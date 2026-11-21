"""Minimal NES (NROM / mapper 0) harness on top of py65: enough to render frames."""
import sys
from PIL import Image
from py65.devices.mpu6502 import MPU

NES_PAL = [
 (84,84,84),(0,30,116),(8,16,144),(48,0,136),(68,0,100),(92,0,48),(84,4,0),(60,24,0),(32,42,0),(8,58,0),(0,64,0),(0,60,0),(0,50,60),(0,0,0),(0,0,0),(0,0,0),
 (152,150,152),(8,76,196),(48,50,236),(92,30,228),(136,20,176),(160,20,100),(152,34,32),(120,60,0),(84,90,0),(40,114,0),(8,124,0),(0,118,40),(0,102,120),(0,0,0),(0,0,0),(0,0,0),
 (236,238,236),(76,154,236),(120,124,236),(176,98,236),(228,84,236),(236,88,180),(236,106,100),(212,136,32),(160,170,0),(116,196,0),(76,208,32),(56,204,108),(56,180,204),(60,60,60),(0,0,0),(0,0,0),
 (236,238,236),(168,204,236),(188,188,236),(212,178,236),(236,174,236),(236,174,212),(236,182,176),(228,196,144),(204,210,120),(180,222,120),(168,226,144),(152,226,180),(160,214,228),(160,162,160),(0,0,0),(0,0,0),
]

class Mem(list):
    def __init__(self, nes):
        super().__init__([0]*0x10000)
        self.nes = nes
    def __getitem__(self, a):
        return self.nes.read(a)
    def __setitem__(self, a, v):
        self.nes.write(a, v & 0xFF)

class NES:
    def __init__(self, rom_bytes, zero_page_clear=True):
        d = rom_bytes
        self.prg = d[16:16+16384]
        self.chr = d[16+16384:16+16384+8192]
        self.prg_ram = [0]*0x2000
        self.ram = [0]*0x800
        # PPU state
        self.ctrl = 0; self.mask = 0; self.status = 0
        self.oamaddr = 0; self.oam = [0]*256
        self.ppuaddr = 0; self.tmpaddr = 0; self.xscroll = 0
        self.vram = [0]*0x800          # two nametables (vertical mirroring)
        self.pal = [0x0F]*32
        self.palbuf = 0
        self.latch = 0
        self.cycles = 0
        self.frame = 0
        self.nmi_pending = False
        self.in_vblank = False
        self.strobe = 0
        self.pad = 0
        self.pad_shift = [0,0]
        self.frames_rendered = []
        self.nmi_depth = 0
        self.mem = Mem(self)
        self.mpu = MPU(memory=self.mem)
        self.mpu.processorCycles = 0
        self.mpu.pc = self.read16(0xFFFC)

    # ---------- CPU bus ----------
    def read16(self, a):
        return self.read(a) | (self.read(a+1) << 8)

    def peek(self, a):
        a &= 0xFFFF
        if a < 0x2000:
            return self.ram[a & 0x7FF]
        if a >= 0x8000:
            return self.prg[(a-0x8000) % 16384]
        return 0

    def read(self, a):
        a &= 0xFFFF
        if a < 0x2000:
            return self.ram[a & 0x7FF]
        if a < 0x4000:
            return self.ppu_read(a & 7)
        if a == 0x4014:
            return 0
        if a == 0x4016 or a == 0x4017:
            if self.strobe:
                return 0
            port = 0 if a == 0x4016 else 1
            v = (self.pad >> self.pad_shift[port]) & 1
            self.pad_shift[port] = min(self.pad_shift[port]+1, 8)
            return v
        if a < 0x4020:
            return 0
        if a < 0x6000:
            return 0
        if a < 0x8000:
            return self.prg_ram[a-0x6000]
        return self.prg[(a-0x8000) % 16384]

    def write(self, a, v):
        a &= 0xFFFF
        v &= 0xFF
        if a < 0x2000:
            self.ram[a & 0x7FF] = v
            return
        if a < 0x4000:
            self.ppu_write(a & 7, v)
            return
        if a == 0x4014:
            base = v << 8
            for i in range(256):
                self.oam[(self.oamaddr+i) & 0xFF] = self.read(base+i)
            return
        if a == 0x4016:
            if v & 1:
                self.strobe = 1
            else:
                self.strobe = 0
                self.pad_shift = [0,0]
            return
        if a < 0x4020:
            return
        if a < 0x6000:
            return
        if a < 0x8000:
            self.prg_ram[a-0x6000] = v
            return
        # write to PRG ROM ignored

    # ---------- PPU ----------
    def ppu_read(self, r):
        if r == 2:
            v = self.status
            self.status &= 0x3F
            self.latch = 0
            return v
        if r == 4:
            return self.oam[self.oamaddr]
        if r == 7:
            a = self.ppuaddr & 0x3FFF
            if a < 0x2000:
                v = self.chr[a]
                # buffered reads for chr
                self.ppuaddr = (self.ppuaddr + (32 if self.ctrl & 4 else 1)) & 0x7FFF
                return v
            # buffered
            v = self.palbuf
            self.palbuf = self.vram_read(a)
            self.ppuaddr = (self.ppuaddr + (32 if self.ctrl & 4 else 1)) & 0x7FFF
            if a >= 0x3F00:
                v = self.palbuf
            return v
        return 0

    def vram_read(self, a):
        a &= 0x3FFF
        if a < 0x2000:
            return self.chr[a]
        if a < 0x3000:
            return self.vram[(a-0x2000) % 0x800]
        if a < 0x3F00:
            return self.vram[(a-0x3000) % 0x800]
        i = (a-0x3F00) & 0x1F
        if i % 4 == 0:
            i &= 0x0F
        return self.pal[i]

    def vram_write(self, a, v):
        a &= 0x3FFF
        if a < 0x2000:
            return
        if a < 0x3000:
            self.vram[(a-0x2000) % 0x800] = v
            return
        if a < 0x3F00:
            self.vram[(a-0x3000) % 0x800] = v
            return
        i = (a-0x3F00) & 0x1F
        if i % 4 == 0:
            i &= 0x0F
        self.pal[i] = v & 0x3F

    def ppu_write(self, r, v):
        if r == 0:
            self.ctrl = v
        elif r == 1:
            self.mask = v
        elif r == 3:
            self.oamaddr = v
        elif r == 4:
            self.oam[self.oamaddr] = v
            self.oamaddr = (self.oamaddr+1) & 0xFF
        elif r == 5:
            if self.latch == 0:
                self.xscroll = v
                self.latch = 1
            else:
                self.latch = 0
        elif r == 6:
            if self.latch == 0:
                self.tmpaddr = (v & 0x3F) << 8
                self.latch = 1
            else:
                self.tmpaddr |= v
                self.ppuaddr = self.tmpaddr
                self.latch = 0
        elif r == 7:
            self.vram_write(self.ppuaddr, v)
            self.ppuaddr = (self.ppuaddr + (32 if self.ctrl & 4 else 1)) & 0x7FFF

    def tile_px(self, table, idx, x, y):
        base = (0x1000 if table else 0) + idx*16
        lo = self.chr[base+y]
        hi = self.chr[base+8+y]
        bit = 7-x
        return ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1)

    def render(self):
        img = Image.new('RGB', (256, 240), NES_PAL[self.pal[0] & 0x3F] if self.mask & 0x18 or True else (0,0,0))
        px = img.load()
        bg_table = 0x1000 if self.ctrl & 0x10 else 0
        sp_table = 0x1000 if self.ctrl & 0x08 else 0
        sp16 = bool(self.ctrl & 0x20)
        if self.mask & 0x08:
            for row in range(30):
                nt = (row // 30) * 0x400
                for col in range(32):
                    t = self.vram[(col + row*32) % 0x800]
                    at = self.vram[0x3C0 + (row//4)*8 + (col//4)]
                    sh = ((row % 4)//2)*4 + ((col % 4)//2)*2
                    p = (at >> sh) & 3
                    for yy in range(8):
                        for xx in range(8):
                            c = self.tile_px(bg_table, t, xx, yy)
                            if c:
                                cc = self.pal[p*4 + c] & 0x3F
                                px[col*8+xx, row*8+yy] = NES_PAL[cc]
        if self.mask & 0x10:
            for s in range(63, -1, -1):
                sy = self.oam[s*4]; sx = self.oam[s*4+3]; at = self.oam[s*4+2]; t = self.oam[s*4+1]
                if sy >= 0xEF:
                    continue
                sy += 1
                p = at & 3
                flipH = at & 0x40; flipV = at & 0x80
                for yy in range(8):
                    for xx in range(8):
                        tx = 7-xx if flipH else xx
                        ty = 7-yy if flipV else yy
                        c = self.tile_px(sp_table, t, tx, ty)
                        if c:
                            X = sx+xx; Y = sy+yy
                            if 0 <= X < 256 and 0 <= Y < 240:
                                cc = self.pal[16 + p*4 + c] & 0x3F
                                px[X, Y] = NES_PAL[cc]
        return img

    def run_frames(self, n, on_frame=None):
        cyc_per_frame = 29780
        target = self.cycles + n*cyc_per_frame
        while self.cycles < target:
            c0 = self.cycles
            # track NMI handler nesting via RTI
            if self.nmi_depth > 0 and self.peek(self.mpu.pc) == 0x40:
                self.nmi_depth -= 1
            self.mpu.step()
            self.cycles = self.mpu.processorCycles
            # vblank boundary
            fc = self.cycles % cyc_per_frame
            f_prev = c0 % cyc_per_frame
            if fc < f_prev or (c0 // cyc_per_frame) != (self.cycles // cyc_per_frame):
                # entering new frame: vblank starts
                img = self.render()
                self.frames_rendered.append(img)
                self.status |= 0x80
                if on_frame:
                    on_frame(len(self.frames_rendered)-1, img)
            # NMI vectors a little later so the main thread can observe bit7 first
            elif f_prev < 600 <= fc:
                if (self.ctrl & 0x80) and self.nmi_depth == 0:
                    self.nmi_depth = 1
                    self.mpu.nmi()
            # crude sprite-0 hit pulse mid-visible-frame
            elif f_prev < 20000 <= fc:
                self.status |= 0x40
            elif fc < 20000 <= f_prev:
                self.status |= 0x40
        return img


if __name__ == '__main__':
    rom = open(sys.argv[1], 'rb').read()
    nes = NES(rom)
    frames = int(sys.argv[2]) if len(sys.argv) > 2 else 180
    outdir = sys.argv[3] if len(sys.argv) > 3 else r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\frames'
    import os
    os.makedirs(outdir, exist_ok=True)
    N = frames
    def on_frame(i, img):
        if i in (1,2,5,10,20,40,60,90,120,150,180,240,300,360,420,480,600) or (i < 30):
            img.resize((512,480), Image.NEAREST).save(os.path.join(outdir, f'f{i:04d}.png'))
    nes.run_frames(N, on_frame)
    print("done frames", len(nes.frames_rendered), "pc", hex(nes.mpu.pc), "cycles", nes.cycles)
