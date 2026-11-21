import sys
from PIL import Image, ImageDraw
d=open(sys.argv[1],'rb').read()
chr_=d[16+16384:16+16384+8192]
PAL=[(0,0,0),(221,136,136),(85,136,221),(255,255,255)]
def tile(idx, base=4096):
    im=Image.new('RGBA',(8,8),(0,0,0,0)); px=im.load(); o=base+idx*16
    for y in range(8):
        lo=chr_[o+y]; hi=chr_[o+8+y]
        for x in range(8):
            b=7-x; v=((lo>>b)&1)|(((hi>>b)&1)<<1)
            if v: px[x,y]=PAL[v]+(255,)
    return im
S=6; W=16
img=Image.new('RGB',(W*8*S, W*8*S),(20,20,30)); dr=ImageDraw.Draw(img)
for i in range(256):
    cx=(i%W)*8*S; cy=(i//W)*8*S
    im=tile(i).resize((8*S,8*S),Image.NEAREST)
    img.paste(im,(cx,cy),im)
    dr.text((cx+2,cy+1),"%02X"%i,fill=(255,255,0))
    dr.rectangle([cx,cy,cx+8*S-1,cy+8*S-1],outline=(60,60,80))
img.save(r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\bg_labeled.png')
print('ok')
