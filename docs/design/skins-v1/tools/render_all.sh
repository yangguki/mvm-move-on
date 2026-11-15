#!/bin/bash
# Render all 20 skin x state combos at 1920x1080 with headless Chrome
cd "$(dirname "$0")/.."
for s in neon-arcade iron-gym live-broadcast power-energy wod-chalkboard; do
 for t in countdown exercise rest complete; do
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --virtual-time-budget=4000 \
   --window-size=1920,1080 --screenshot="$PWD/png/$s--$t.png" "file://$PWD/index.html?skin=$s&state=$t&ui=0" >/dev/null 2>&1 &
 done
 wait
done
ls png | wc -l
