"""Extract per-skin tokens from src/index.src.html -> tokens.json + tokens.md"""
import re, json, os
R = os.path.join(os.path.dirname(__file__), '..')
css = open(f'{R}/src/index.src.html').read()
def props(block): return dict(re.findall(r'(--[\w-]+):([^;]+);', block))
base = props(re.search(r'/\* ---------- token defaults.*?\*/\s*\.stage\{(.*?)\n\}', css, re.S).group(1))
skins = {'neon-arcade': dict(base)}
for name, block in re.findall(r'\[data-skin=([\w-]+)\]\{\n(.*?)\n\}', css, re.S):
    t = dict(base); t.update(props(block)); skins[name] = t
order = ['neon-arcade', 'iron-gym', 'live-broadcast', 'power-energy', 'wod-chalkboard']
skins = {k: {p: v.strip() for p, v in skins[k].items()} for k in order}
json.dump({'layout': {'stage': [1920, 1080], 'top': {'x': 48, 'y': 28, 'w': 1824, 'h': 200, 'columns': [240, 742, 330, 440], 'gap': 24},
           'progress': {'x': 48, 'y': 244, 'w': 1824, 'h': 12}, 'video': {'x': 263, 'y': 272, 'w': 1394, 'h': 784, 'aspect': '16:9'},
           'gutterLeft': {'x': 48, 'y': 272, 'w': 191, 'h': 784}, 'gutterRight': {'x': 1681, 'y': 272, 'w': 191, 'h': 784},
           'ringRule': 'ring-w >= 0.42 * video-radius (opaque ring hides the square video corners)'},
           'skins': skins}, open(f'{R}/tokens.json', 'w'), ensure_ascii=False, indent=2)
keys = list(base.keys())
md = ['# MOVE ON TV 플레이어 · 스킨 토큰 (ADM-SKIN-09)', '',
      '`<div class="stage" data-skin="...">`에 아래 CSS 변수를 덮어쓰는 방식이에요. 레이아웃 좌표는 모든 스킨이 같아요 (tokens.json `layout`).', '',
      '| token | ' + ' | '.join(order) + ' |', '|---|' + '---|'*len(order)]
for k in keys:
    md.append(f'| `{k}` | ' + ' | '.join('`' + skins[s][k].replace('|', '\\|') + '`' for s in order) + ' |')
md += ['', '## 스킨별 장식 (토큰 밖, 클래스 규칙)',
 '- **neon-arcade**: `.deco.scan` 스캔라인(4px 반복 그라디언트), `.deco.floor` 바닥 그리드. 글자 네온은 text-shadow 2겹(정적).',
 '- **iron-gym**: 배경 `tex-steel.png`(6KB) 타일, 하단 `tex-diamond.png`(0.4KB) 체크판, 좌우 해저드 스트라이프, 영상 모서리 볼트 4개, 패널 모서리 컷(clip-path polygon).',
 '- **live-broadcast**: 이름 = 흰 로어서드 플레이트 + 빨간 탭, 타이머 = 스코어보드 숫자 칸(`.d`), 로고 칸 LIVE 배지(1.2초 opacity 점멸만), 영상 하단 티커 바.',
 '- **power-energy**: 사선 스트라이프 + 3색 그라디언트 배경, 진행바/게이지 세그먼트(에너지 게이지), 이름·상태 문구 skewX(-8°), 사선 슬래시 2개.',
 '- **wod-chalkboard**: 배경 `tex-chalkboard.png`(17KB) 타일, 나무 테두리(inset box-shadow), 패널 테두리 = 고정 크기 손그림 SVG(`.sketch`), 이름 밑줄 `.squiggle`, 점선 진행바.',
 '', '## 상태 화면', '- `data-state` = `countdown | exercise | rest | complete`. 영상 박스 안 오버레이(`.ov.cd / .ov.rs / .ov.cp`)만 바뀌고 상단·좌우 정보 위치는 그대로예요.']
open(f'{R}/tokens.md', 'w').write('\n'.join(md) + '\n')
print(len(keys), 'tokens x', len(order))
