# MOVE ON TV 플레이어 · 스킨 토큰 (ADM-SKIN-09)

`<div class="stage" data-skin="...">`에 아래 CSS 변수를 덮어쓰는 방식이에요. 레이아웃 좌표는 모든 스킨이 같아요 (tokens.json `layout`).

| token | neon-arcade | iron-gym | live-broadcast | power-energy | wod-chalkboard |
|---|---|---|---|---|---|
| `--bg` | `#07051A` | `#202428` | `#081634` | `#FF4A1C` | `#24312B` |
| `--bg-image` | `radial-gradient(ellipse at 50% -10%,#2A0D5C 0%,#07051A 60%)` | `url(assets/tex-steel.png)` | `repeating-linear-gradient(115deg,rgba(255,255,255,.025) 0 2px,transparent 2px 16px),linear-gradient(180deg,#0C1F4A 0%,#050C20 100%)` | `repeating-linear-gradient(-60deg,rgba(255,255,255,.07) 0 40px,transparent 40px 120px),linear-gradient(115deg,#FF1F5A 0%,#FF5A12 48%,#FFB800 100%)` | `url(assets/tex-chalkboard.png)` |
| `--fg` | `#FFFFFF` | `#F3F5F6` | `#FFFFFF` | `#FFFFFF` | `#F4F1E6` |
| `--muted` | `#CFC8FF` | `#A7B0B8` | `#A9BBE0` | `#FFE2CF` | `#C6CEC3` |
| `--primary` | `#00F0FF` | `#FF6A00` | `#E10600` | `#FFE600` | `#FFE58A` |
| `--secondary` | `#FF2BD6` | `#C9CFD5` | `#1F52FF` | `#111111` | `#FF9DB4` |
| `--accent` | `#B6FF3B` | `#FFC21A` | `#FFC72C` | `#FFE600` | `#9EDBFF` |
| `--on-accent` | `#07051A` | `#111315` | `#081634` | `#111111` | `#1E2A24` |
| `--font-head` | `"MO Pretendard"` | `"MO BlackHan"` | `"MO Pretendard"` | `"MO Pretendard"` | `"MO Gaegu"` |
| `--head-weight` | `800` | `400` | `800` | `800` | `700` |
| `--font-num` | `"MO Mono"` | `"MO ArchivoX"` | `"MO ArchivoC"` | `"MO ArchivoI"` | `"MO Gaegu"` |
| `--num-tracking` | `0` | `-.02em` | `.01em` | `-.02em` | `0` |
| `--panel-bg` | `#120A2E` | `linear-gradient(180deg,#3B4147 0%,#2A2F34 100%)` | `#0F2557` | `#111111` | `transparent` |
| `--panel-border` | `2px solid #3A2A7A` | `2px solid #0F1113` | `0` | `0` | `0` |
| `--panel-radius` | `16px` | `4px` | `6px` | `26px` | `0` |
| `--panel-shadow` | `none` | `inset 0 2px 0 rgba(255,255,255,.16),inset 0 -3px 0 rgba(0,0,0,.35),0 6px 0 #0F1113` | `inset 0 4px 0 #1F52FF,0 6px 16px rgba(0,0,0,.35)` | `0 10px 0 rgba(0,0,0,.25)` | `none` |
| `--label-color` | `#CFC8FF` | `#FFC21A` | `#A9BBE0` | `#FFE600` | `#9EDBFF` |
| `--label-font` | `"MO Pretendard"` | `"MO ArchivoX"` | `"MO ArchivoC"` | `"MO ArchivoI"` | `"MO Gaegu"` |
| `--label-size` | `22px` | `20px` | `24px` | `24px` | `30px` |
| `--label-tracking` | `.14em` | `.08em` | `.12em` | `.06em` | `.02em` |
| `--step-color` | `var(--accent)` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#F4F1E6` |
| `--step-shadow` | `0 0 14px rgba(182,255,59,.6)` | `0 4px 0 #000` | `none` | `none` | `none` |
| `--name-color` | `#FFFFFF` | `#FFFFFF` | `#081634` | `#FFFFFF` | `#F4F1E6` |
| `--name-shadow` | `0 0 8px #00F0FF,0 0 24px #00F0FF` | `0 5px 0 #000` | `none` | `none` | `none` |
| `--name-skew` | `0deg` | `0deg` | `0deg` | `-8deg` | `0deg` |
| `--timer-color` | `var(--secondary)` | `#FF6A00` | `#FFC72C` | `#FFE600` | `#FFE58A` |
| `--timer-shadow` | `0 0 10px #FF2BD6,0 0 28px rgba(255,43,214,.7)` | `0 5px 0 #000` | `none` | `none` | `none` |
| `--tag-bg` | `var(--accent)` | `#FFC21A` | `#1F52FF` | `#FFE600` | `transparent` |
| `--tag-fg` | `var(--on-accent)` | `#111315` | `#FFFFFF` | `#111111` | `#FF9DB4` |
| `--tag-radius` | `10px` | `2px` | `3px` | `10px` | `0` |
| `--bar-track` | `#1B1440` | `#111315` | `#13285C` | `rgba(17,17,17,.55)` | `transparent` |
| `--bar-border` | `1px solid #3A2A7A` | `2px solid #0A0B0C` | `0` | `0` | `0` |
| `--bar-fill` | `linear-gradient(90deg,#00F0FF,#FF2BD6)` | `repeating-linear-gradient(-45deg,#FF6A00 0 18px,#111315 18px 36px)` | `linear-gradient(90deg,#E10600 0%,#E10600 calc(100% - 24px),#FFC72C calc(100% - 24px))` | `#FFE600` | `#FFE58A` |
| `--bar-radius` | `6px` | `2px` | `2px` | `6px` | `6px` |
| `--video-radius` | `28px` | `12px` | `16px` | `40px` | `20px` |
| `--ring-w` | `14px` | `10px` | `8px` | `18px` | `10px` |
| `--ring-color` | `#0A0722` | `#16191C` | `#081634` | `#111111` | `#24312B` |
| `--frame-line` | `4px solid #00F0FF` | `5px solid #FF6A00` | `3px solid #FFFFFF` | `6px solid #FFE600` | `0 solid transparent` |
| `--frame-glow` | `0 0 28px rgba(0,240,255,.45)` | `0 8px 0 #0A0B0C` | `0 12px 32px rgba(0,0,0,.45)` | `0 14px 0 rgba(0,0,0,.22)` | `none` |
| `--thumb-radius` | `10px` | `3px` | `4px` | `14px` | `8px` |
| `--thumb-line` | `3px solid #FF2BD6` | `3px solid #FFC21A` | `3px solid #FFFFFF` | `4px solid #FFE600` | `0 solid transparent` |
| `--scrim` | `rgba(7,5,26,.80)` | `rgba(17,19,21,.84)` | `rgba(5,12,32,.84)` | `rgba(17,17,17,.80)` | `rgba(30,42,36,.88)` |
| `--state-font` | `"MO Pretendard"` | `"MO BlackHan"` | `"MO Pretendard"` | `"MO Pretendard"` | `"MO Gaegu"` |
| `--state-color` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#F4F1E6` |
| `--state-shadow` | `0 0 12px #FF2BD6,0 0 36px rgba(255,43,214,.6)` | `0 6px 0 #000` | `none` | `none` | `none` |
| `--state-num-color` | `var(--accent)` | `#FF6A00` | `#FFC72C` | `#FFE600` | `#FFE58A` |
| `--state-num-shadow` | `0 0 24px rgba(182,255,59,.7)` | `0 8px 0 #000` | `none` | `none` | `none` |
| `--chip-bg` | `#1B1440` | `#2A2F34` | `#FFFFFF` | `#FFFFFF` | `transparent` |
| `--chip-fg` | `#FFFFFF` | `#fff` | `#081634` | `#111111` | `#F4F1E6` |
| `--chip-border` | `2px solid #3A2A7A` | `2px solid #0F1113` | `0` | `0` | `3px dashed rgba(244,241,230,.75)` |
| `--chip-radius` | `999px` | `3px` | `4px` | `16px` | `14px` |
| `--gauge-track` | `#1B1440` | `#111315` | `#13285C` | `rgba(17,17,17,.6)` | `transparent` |
| `--gauge-fill` | `linear-gradient(0deg,#00F0FF,#FF2BD6)` | `#FF6A00` | `linear-gradient(0deg,#E10600,#FFC72C)` | `linear-gradient(0deg,#FFE600,#FFF6A0)` | `#FFE58A` |
| `--gauge-seg` | `0px` | `8px` | `0px` | `10px` | `12px` |

## 스킨별 장식 (토큰 밖, 클래스 규칙)
- **neon-arcade**: `.deco.scan` 스캔라인(4px 반복 그라디언트), `.deco.floor` 바닥 그리드. 글자 네온은 text-shadow 2겹(정적).
- **iron-gym**: 배경 `tex-steel.png`(6KB) 타일, 하단 `tex-diamond.png`(0.4KB) 체크판, 좌우 해저드 스트라이프, 영상 모서리 볼트 4개, 패널 모서리 컷(clip-path polygon).
- **live-broadcast**: 이름 = 흰 로어서드 플레이트 + 빨간 탭, 타이머 = 스코어보드 숫자 칸(`.d`), 로고 칸 LIVE 배지(1.2초 opacity 점멸만), 영상 하단 티커 바.
- **power-energy**: 사선 스트라이프 + 3색 그라디언트 배경, 진행바/게이지 세그먼트(에너지 게이지), 이름·상태 문구 skewX(-8°), 사선 슬래시 2개.
- **wod-chalkboard**: 배경 `tex-chalkboard.png`(17KB) 타일, 나무 테두리(inset box-shadow), 패널 테두리 = 고정 크기 손그림 SVG(`.sketch`), 이름 밑줄 `.squiggle`, 점선 진행바.

## 상태 화면
- `data-state` = `countdown | exercise | rest | complete`. 영상 박스 안 오버레이(`.ov.cd / .ov.rs / .ov.cp`)만 바뀌고 상단·좌우 정보 위치는 그대로예요.
