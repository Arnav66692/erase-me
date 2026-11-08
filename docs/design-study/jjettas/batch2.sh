#!/bin/zsh
# Interaction runs, one browser at a time.
cd /Users/arnavsingh/Desktop/Business/erase-me/docs/design-study/jjettas
L=/Users/arnavsingh/Desktop/Business/erase-me/qa/out/refs/jjettas/data
until grep -q "BATCH DONE" $L/batch-walk.log; do sleep 3; done
for s in "interact.mjs d1440" "transition.mjs" "components.mjs d1440" "interact.mjs m390"; do
  free=$(df -m ~ | tail -1 | awk '{print $4}'); [ $free -lt 1500 ] && { echo "disk low $free skip $s"; continue; }
  echo "=== $s"; node ${=s} > $L/run-${s// /-}.txt 2>&1; echo "exit $? $s"
done
echo BATCH2 DONE
