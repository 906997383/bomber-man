import sys, os
sys.path.insert(0, os.path.dirname(__file__))
lines=[l.strip() for l in open(r'C:\Users\888\Documents\Trae-CN\temp_20261121_02\analysis\g2\s05.txt') if l.strip()]
pal=lines[0]; rows=[l.split() for l in lines[1:]]
print("rows",len(rows))
# playfield starts nt row 4, 22 rows tall, 32 cols
def cell(cx, cy):
    t = rows[4+cy*2][cx*2], rows[4+cy*2][cx*2+1], rows[4+cy*2+1][cx*2], rows[4+cy*2+1][cx*2+1]
    return t
HARD={('64','65','66','67')}
BRICK={('68','69','6A','6B')}
FLOOR={('5F','5F','5F','5F')}
out=[]
for cy in range(13):
    line=''
    for cx in range(16):
        t=cell(cx,cy)
        if t==('64','65','66','67'): line+='#'
        elif t==('68','69','6A','6B'): line+='B'
        elif t==('5F','5F','5F','5F'): line+='.'
        else: line+='?'
    out.append(line)
for l in out: print(l)
print(pal)
