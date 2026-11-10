#!/bin/bash
# render the film in 8 chunks; skip chunks that already exist
cd "$(dirname "$0")/.."; mkdir -p out/chunks
for r in 0-329 330-659 660-989 990-1319 1320-1649 1650-1979 1980-2309 2310-2639; do
  f=out/chunks/c_${r}.mp4
  [ -s "$f" ] && continue
  node tools/render.mjs "$f.tmp.mp4" "$r" 1 > out/chunks/log_${r}.txt 2>&1 && mv "$f.tmp.mp4" "$f"
  echo "chunk $r done $(date +%T)"
done
echo ALLDONE
