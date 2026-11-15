"""Small tileable textures (PNG) for TV skins — tiled via background-repeat, no filters."""
from PIL import Image, ImageDraw, ImageFilter
import random, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
random.seed(7)
def tileable_noise(w, h, amp, base, blur=0, streak=False):
    im = Image.new('L', (w, h), base); px = im.load()
    for y in range(h):
        row = random.randint(-amp//2, amp//2) if streak else 0
        for x in range(w):
            px[x, y] = max(0, min(255, base + row + random.randint(-amp, amp)))
    if streak:  # horizontal brushing: blur along x only (wrap)
        big = Image.new('L', (w*3, h)); [big.paste(im, (i*w, 0)) for i in range(3)]
        big = big.resize((w*3//8, h)).resize((w*3, h), Image.BILINEAR); im = big.crop((w, 0, 2*w, h))
    if blur:
        big = Image.new('L', (w*3, h*3)); [big.paste(im, (i*w, j*h)) for i in range(3) for j in range(3)]
        im = big.filter(ImageFilter.GaussianBlur(blur)).crop((w, h, 2*w, 2*h))
    return im
# brushed steel (grayscale, tinted in CSS via blend-free overlay: we bake a dark steel tone)
s = tileable_noise(256, 128, 14, 58, streak=True)
Image.merge('RGB', [s.point(lambda v: v), s.point(lambda v: v+2), s.point(lambda v: v+6)]).save(f'{OUT}/tex-steel.png', optimize=True)
# diamond plate 48x48 tile
d = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); dr = ImageDraw.Draw(d)
def bead(cx, cy, ang):
    import math
    L, W = 10, 3
    dx, dy = math.cos(ang)*L, math.sin(ang)*L; nx, ny = -math.sin(ang)*W, math.cos(ang)*W
    dr.polygon([(cx-dx, cy-dy), (cx+nx, cy+ny), (cx+dx, cy+dy), (cx-nx, cy-ny)], fill=(255, 255, 255, 34))
    dr.line([(cx-dx+1, cy-dy), (cx+dx-1, cy+dy)], fill=(0, 0, 0, 60), width=1)
import math
bead(12, 12, math.radians(45)); bead(36, 36, math.radians(45)); bead(36, 12, math.radians(-45)); bead(12, 36, math.radians(-45))
d.save(f'{OUT}/tex-diamond.png', optimize=True)
# chalkboard 256x256: dark slate green with soft smudges + fine grain
g = tileable_noise(256, 256, 10, 128, blur=0.6)
sm = tileable_noise(64, 64, 40, 128, blur=2).resize((256, 256), Image.BICUBIC)
def mix(a, b): return Image.blend(a, b, .5)
m = mix(g, sm)
r = m.point(lambda v: int(32 + (v-128)*.16)); gg = m.point(lambda v: int(48 + (v-128)*.18)); b = m.point(lambda v: int(42 + (v-128)*.16))
Image.merge('RGB', [r, gg, b]).save(f'{OUT}/tex-chalkboard.png', optimize=True)
# chalk dust (white specks, alpha) 128 tile for chalk strokes / borders
c = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); cp = c.load()
for _ in range(700):
    x, y = random.randrange(128), random.randrange(128); cp[x, y] = (255, 255, 255, random.randint(20, 70))
c.save(f'{OUT}/tex-chalkdust.png', optimize=True)
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(f'{OUT}/{f}')//1024, 'KB')
