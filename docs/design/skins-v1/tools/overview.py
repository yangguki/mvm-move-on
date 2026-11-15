from PIL import Image, ImageDraw, ImageFont
import os
R = os.path.join(os.path.dirname(__file__), '..')
skins = [('neon-arcade','네온 아케이드'),('iron-gym','아이언 짐'),('live-broadcast','라이브 중계'),('power-energy','파워 에너지'),('wod-chalkboard','WOD 칠판')]
states = [('countdown','시작 카운트다운'),('exercise','운동'),('rest','휴식'),('complete','완료')]
W, H = 480, 270; L = 220; T = 120; G = 16
img = Image.new('RGB', (L + 4*(W+G) + 24, T + 5*(H+G) + 24), '#F4F5F3'); d = ImageDraw.Draw(img)
f = '/home/box/.local/share/fonts/PretendardVariable.ttf'
fb = ImageFont.truetype(f, 34); fb.set_variation_by_axes([800]); fm = ImageFont.truetype(f, 22); fm.set_variation_by_axes([650]); fs = ImageFont.truetype(f, 16); fs.set_variation_by_axes([500])
d.text((24, 24), 'MOVE ON TV 플레이어 · 기본 스킨 5종 × 상태 4종', font=fb, fill='#0B0D0C')
for j, (s, sn) in enumerate(states): d.text((L + j*(W+G), T - 36), sn, font=fm, fill='#4F5652')
for i, (k, kn) in enumerate(skins):
    y = T + i*(H+G)
    d.text((24, y + H//2 - 22), kn, font=fm, fill='#0B0D0C'); d.text((24, y + H//2 + 10), k, font=fs, fill='#6B736D')
    for j, (s, _) in enumerate(states):
        im = Image.open(f'{R}/png/{k}--{s}.png').convert('RGB').resize((W, H), Image.LANCZOS)
        img.paste(im, (L + j*(W+G), y))
img.save(f'{R}/overview.png', optimize=True); print(img.size)
