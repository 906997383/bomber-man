import json

rows = []
for line in open('analysis/g/t0_title.txt', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('pal='):
        continue
    vals = [int(x, 16) for x in line.split()]
    assert len(vals) == 32, len(vals)
    rows.append(''.join('%02X' % v for v in vals))
rows = rows[:30]

out = ['// Auto-generated from the original NES title screen nametable', 'window.TITLE_ROWS=[']
for i, r in enumerate(rows):
    out.append('  "%s"%s' % (r, ',' if i < len(rows) - 1 else ''))
out.append('];')
open('www/js/title.js', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(rows), 'rows')
