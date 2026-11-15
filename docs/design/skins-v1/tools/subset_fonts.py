"""Subset fonts for TV: KS X 1001 Hangul 2,350 + ASCII + a few symbols -> woff2."""
import subprocess, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
G = '/usr/share/fonts/truetype/sand-box/google/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'fonts')
hangul = []
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try: hangul.append(bytes([hi, lo]).decode('euc-kr'))
        except Exception: pass
ascii_ = ''.join(chr(c) for c in range(0x20, 0x7F))
sym = '·×→←↑↓…“”‘’•–—°%'
open('/tmp/ks.txt', 'w').write(''.join(hangul) + ascii_ + sym)
open('/tmp/latin.txt', 'w').write(ascii_ + sym)
def inst(src, dst, axes):
    f = TTFont(src); f = instantiateVariableFont(f, axes); f.save(dst); return dst
def sub(src, name, text):
    out = os.path.join(OUT, name)
    subprocess.run([sys.executable, '-m', 'fontTools.subset', src, f'--text-file={text}', '--flavor=woff2',
                    '--layout-features=kern,liga,tnum', f'--output-file={out}', '--no-hinting', '--desubroutinize'], check=True)
    print(name, os.path.getsize(out)//1024, 'KB')
pv = '/workspace/mvm/design/fonts/PretendardVariable.ttf'
sub(inst(pv, '/tmp/pre800.ttf', {'wght': 800}), 'Pretendard-ExtraBold.subset.woff2', '/tmp/ks.txt')
sub(inst(pv, '/tmp/pre600.ttf', {'wght': 600}), 'Pretendard-SemiBold.subset.woff2', '/tmp/ks.txt')
sub(G + 'Black Han Sans/BlackHanSans-Regular.ttf', 'BlackHanSans.subset.woff2', '/tmp/ks.txt')
sub(G + 'Gaegu/Gaegu-Bold.ttf', 'Gaegu-Bold.subset.woff2', '/tmp/ks.txt')
sub(inst(G + 'Archivo/Archivo-VariableFont_wdth,wght.ttf', '/tmp/arc.ttf', {'wght': 900, 'wdth': 125}), 'Archivo-BlackExpanded.latin.woff2', '/tmp/latin.txt')
sub(inst(G + 'Archivo/Archivo-VariableFont_wdth,wght.ttf', '/tmp/arcc.ttf', {'wght': 800, 'wdth': 75}), 'Archivo-ExtraBoldCondensed.latin.woff2', '/tmp/latin.txt')
sub(inst(G + 'Archivo/Archivo-Italic-VariableFont_wdth,wght.ttf', '/tmp/arci.ttf', {'wght': 900, 'wdth': 112}), 'Archivo-BlackItalic.latin.woff2', '/tmp/latin.txt')
sub(inst('/workspace/mvm/design/fonts/JetBrainsMono.ttf', '/tmp/jb.ttf', {'wght': 800}), 'JetBrainsMono-ExtraBold.latin.woff2', '/tmp/latin.txt')
