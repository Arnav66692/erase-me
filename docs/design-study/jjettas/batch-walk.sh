#!/bin/zsh
# Sequential walks, one browser at a time. Stops if free disk falls under 1.5 GB.
cd /Users/arnavsingh/Desktop/Business/erase-me/docs/design-study/jjettas
run() { free=$(df -m ~ | tail -1 | awk '{print $4}'); if [ $free -lt 1500 ]; then echo "disk low $free, skip $*"; return; fi; node walk.mjs "$@" 2>&1 | tail -2; }
run d1920 / 0.85
run m390 / 0.85
for p in /on-field /off-field /partnerships /foundation /journal /inquiries; do run d1440 $p 0.85; done
for p in /on-field /off-field /partnerships /foundation /journal /inquiries; do run m390 $p 1.6; done
echo BATCH DONE
