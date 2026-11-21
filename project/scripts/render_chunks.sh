#!/bin/bash
# Renders the molasses short at 2K in chunks (resumable): bash scripts/render_chunks.sh <chunk index...>
# Each 150-frame chunk renders as two halves (less work lost when a run is stopped), each with a
# time limit and one retry (software GL occasionally loses a shader and hangs).
cd "$(dirname "$0")/.."
mkdir -p out/molasses/chunks/parts
for i in "$@"; do
  o=out/molasses/chunks/c$i.mp4
  [ -s $o ] && { echo "skip $i"; continue; }
  a=$((i * 150))
  for h in 0 1; do
    s=$((a + h * 75)); e=$((s + 74)); [ $e -gt 2084 ] && e=2084
    [ $s -gt 2084 ] && continue
    p=out/molasses/chunks/parts/c${i}_$h.mp4
    for try in 1 2; do
      [ -s $p ] && break
      pkill -f chrome-headless 2>/dev/null; pkill -f "chromium.*remotion" 2>/dev/null
      timeout 2700 node scripts/render.mjs MolassesShort $p.tmp.mp4 1.3333 $s-$e ${CONC:-2} 2>&1 | grep -aE "^done|rror" | tail -2
      [ -s $p.tmp.mp4 ] && mv $p.tmp.mp4 $p && echo "part $i.$h ok" || { rm -f $p.tmp.mp4; echo "part $i.$h failed (try $try)"; }
    done
  done
  ls out/molasses/chunks/parts/c${i}_*.mp4 2>/dev/null | sort -V | sed "s|^out/molasses/chunks/parts/|file '|; s|$|'|" > out/molasses/chunks/parts/l$i.txt
  n=$(wc -l < out/molasses/chunks/parts/l$i.txt)
  if [ "$n" -ge 1 ] && { [ "$n" -eq 2 ] || [ $((a + 75)) -gt 2084 ]; }; then
    ffmpeg -v error -y -f concat -safe 0 -i out/molasses/chunks/parts/l$i.txt -c copy $o && echo "chunk $i ok"
  fi
done
