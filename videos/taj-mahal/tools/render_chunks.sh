#!/bin/bash
# render the film in chunks of 330 frames; skip chunks that already exist
cd "$(dirname "$0")/.."; mkdir -p out/chunks; export SCALE=${SCALE:-1}
N=$(node -e "console.log(Math.ceil(117.079*30))")
for ((a=0; a<N; a+=330)); do
  b=$((a+329)); [ $b -ge $N ] && b=$((N-1))
  f=out/chunks/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  node tools/render.mjs "$f.tmp.mp4" "$a-$b" 4 > out/chunks/log_$a.txt 2>&1 && mv "$f.tmp.mp4" "$f"
  echo "chunk $a-$b done $(date +%T)"
done
echo ALLDONE
