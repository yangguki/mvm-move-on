# MOVE ON TV 플레이어 · 기본 스킨 5종 (ADM-SKIN-09)
- index.html — 스킨 5 × 상태 4 미리보기. 1–5 스킨, Q/W/E/R 상태(카운트다운/운동/휴식/완료), ←→ 스킨, ↑↓ 상태, H 컨트롤 숨김. URL `?skin=iron-gym&state=rest&ui=0`
- tokens.md / tokens.json — 스킨별 토큰 + 고정 레이아웃 좌표
- png/{skin}--{state}.png (1920×1080) 20장, overview.png
- 수정은 src/index.src.html → `tools/venv/bin/python tools/build.py` → `tools/render_all.sh` → `tools/venv/bin/python tools/overview.py` → `tools/venv/bin/python tools/tokens.py`
