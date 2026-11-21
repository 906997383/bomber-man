import sys
d=open(sys.argv[1],'rb').read(); prg=d[16:16+16384]
for pat,label in [(b'\xa9\x01\x85\xb5','LDA#1 STA $B5'),(b'\x29\x80','AND #$80'),(b'\x29\x40','AND #$40'),(b'\x29\x20','AND #$20'),(b'\x29\x08','AND #$08'),(b'\x29\x04','AND #$04'),(b'\x29\x02','AND #$02'),(b'\x29\x01','AND #$01')]:
    idx=0;hits=[]
    while True:
        i=prg.find(pat,idx)
        if i<0:break
        hits.append(hex(0x8000+i)); idx=i+1
    print(label,hits[:16])
