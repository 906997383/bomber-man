import base64

src = r'c:\Users\888\.trae-cn\attachments\a0706d97-15c1-4ab8-b960-04206fb692f0_60ca073e-9d31-402f-a7a9-a1a7a917dad3_326_炸弹人.nes'
d = open(src, 'rb').read()
chr_data = d[16 + 16384:16 + 16384 + 8192]
assert len(chr_data) == 8192
b64 = base64.b64encode(chr_data).decode()
with open('www/js/chr.js', 'w', encoding='utf-8') as f:
    f.write('window.CHR_B64="' + b64 + '";\n')
print(len(b64))
