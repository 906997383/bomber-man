import sys, re
rom = sys.argv[1]
d = open(rom,'rb').read()
prg = d[16:16+16384]
# search printable ascii runs
s = ''.join(chr(b) if 32 <= b < 127 else '.' for b in prg)
runs = re.findall(r'[ -~]{4,}', s)
print("ASCII runs:", len(runs))
for r in runs[:80]:
    print(repr(r))
