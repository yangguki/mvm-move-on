"""Builds index.html from src/index.src.html.
- {{WORDMARK}}  : MOVE ON wordmark paths (fill=currentColor) inlined
- {{SKETCH:w:h}}: hand-drawn rectangle SVG at exact px size (used by wod-chalkboard only)
- {{SQUIGGLE:w}}: hand-drawn underline
Fixed layout means every panel size is known, so sketches are generated per size (no scaling distortion)."""
import re, os, random, math
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..')
src = open(os.path.join(R, 'src', 'index.src.html')).read()
wm = open(os.path.join(R, 'assets', 'logo-wordmark-white.svg')).read()
vb = re.search(r'viewBox="([^"]+)"', wm).group(1)
paths = re.findall(r'<path[^>]*/>', wm)
def shorten(p):
    p = p.replace('fill="#FFFFFF"', '')
    return re.sub(r'\d+\.\d+', lambda m: ('%.1f' % float(m.group(0))).rstrip('0').rstrip('.'), p)
wordmark = f'<svg class="wm" viewBox="{vb}" aria-label="MOVE ON" fill="currentColor">' + ''.join(shorten(p) for p in paths) + '</svg>'

def wobble_line(x0, y0, x1, y1, rnd, amp=2.2, seg=60):
    n = max(2, int(math.hypot(x1-x0, y1-y0) / seg)); pts = []
    for i in range(n+1):
        t = i/n; x = x0+(x1-x0)*t; y = y0+(y1-y0)*t
        if 0 < i < n:
            nx, ny = -(y1-y0), (x1-x0); l = math.hypot(nx, ny) or 1
            o = rnd.uniform(-amp, amp); x += nx/l*o; y += ny/l*o
        pts.append((x, y))
    return pts
def sketch(w, h, seed):
    rnd = random.Random(seed); m = 6; r = 14
    d = ''
    for k in range(2):  # two passes = chalk drawn twice
        j = lambda: rnd.uniform(-2.5, 2.5)
        c = [(m+j(), m+r+j()), (m+r+j(), m+j()), (w-m-r+j(), m+j()), (w-m+j(), m+r+j()), (w-m+j(), h-m-r+j()), (w-m-r+j(), h-m+j()), (m+r+j(), h-m+j()), (m+j(), h-m-r+j())]
        pts = []
        segs = [(c[1], c[2]), (c[3], c[4]), (c[5], c[6]), (c[7], c[0])]
        d += f'M{c[0][0]:.1f} {c[0][1]:.1f}Q{m+j():.1f} {m+j():.1f} {c[1][0]:.1f} {c[1][1]:.1f}'
        corners = [(w-m, m), (w-m, h-m), (m, h-m), (m, m)]
        for i, (a, b) in enumerate(segs):
            for (x, y) in wobble_line(*a, *b, rnd)[1:]: d += f'L{x:.1f} {y:.1f}'
            nxt = c[(2*i+3) % 8]; cx, cy = corners[i]
            d += f'Q{cx+j():.1f} {cy+j():.1f} {nxt[0]:.1f} {nxt[1]:.1f}'
    return (f'<svg class="sketch" width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true">'
            f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>')
def squiggle(w, seed):
    rnd = random.Random(seed); d = f'M4 {10+rnd.uniform(-2,2):.1f}'
    for x in range(24, w-4, 20): d += f'L{x} {10+rnd.uniform(-3.5,3.5):.1f}'
    return f'<svg class="squiggle" width="{w}" height="20" viewBox="0 0 {w} 20" aria-hidden="true"><path d="{d}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
seed = [0]
def rep_sketch(m):
    seed[0] += 1; return sketch(int(m.group(1)), int(m.group(2)), seed[0])
def rep_sq(m):
    seed[0] += 1; return squiggle(int(m.group(1)), seed[0])
out = src.replace('{{WORDMARK}}', wordmark)
out = re.sub(r'\{\{SKETCH:(\d+):(\d+)\}\}', rep_sketch, out)
out = re.sub(r'\{\{SQUIGGLE:(\d+)\}\}', rep_sq, out)
open(os.path.join(R, 'index.html'), 'w').write(out)
print('index.html', len(out)//1024, 'KB')
