import sys,re
d=open(sys.argv[1],'rb').read()
prg=d[16:16+16384]
patterns={
 'LDA $12':b'\xa5\x12','AND $12':b'\x25\x12','BIT $12':b'\x24\x12',
 'LDA $10':b'\xa5\x10','AND $10':b'\x25\x10','BIT $10':b'\x24\x10',
 'STA $60':b'\x85\x60','LDA $60':b'\xa5\x60',
}
for name,p in patterns.items():
    idx=0; hits=[]
    while True:
        i=prg.find(p,idx)
        if i<0: break
        hits.append(0x8000+i); idx=i+1
    print(name, [hex(x) for x in hits][:20])
