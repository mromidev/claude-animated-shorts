#!/bin/bash
# join frames + caption overlays (with fades) + audio -> dwarka_mandir.mp4
set -e
D=$(dirname "$0"); cd "$D"
mv framesB/f_*.jpg frames/ 2>/dev/null || true
args=(-framerate 30 -i frames/f_%05d.jpg -loop 1 -framerate 30 -t 76 -i caps/title.png)
filt="[1:v]format=rgba,fade=t=in:st=0.3:d=1:alpha=1,fade=t=out:st=5.5:d=1:alpha=1[ov0];[0:v][ov0]overlay=0:0[v0]"
i=0
for row in $(python3 -c "import json;[print(f'{a},{b}') for a,b in json.load(open('caps/caps.json'))]"); do
  a=${row%,*}; b=${row#*,}; n=$((i+2)); j=$((i+1))
  args+=(-loop 1 -framerate 30 -t 76 -i caps/cap_$i.png)
  filt="$filt;[$n:v]format=rgba,fade=t=in:st=$a:d=0.6:alpha=1,fade=t=out:st=$(python3 -c "print($b-0.6)"):d=0.6:alpha=1[ov$j];[v$i][ov$j]overlay=0:0[v$j]"
  i=$((i+1))
done
filt="$filt;[v$i]fade=t=out:st=74.6:d=1.4,format=yuv420p[vout]"
ffmpeg -y -hide_banner -loglevel error "${args[@]}" -i voice/mix_final.wav -filter_complex "$filt" -map "[vout]" -map $((i+2)):a \
  -c:v libx264 -preset slow -crf 18 -r 30 -c:a aac -b:a 256k -shortest -movflags +faststart dwarka_mandir.mp4
ffprobe -v error -show_entries stream=codec_type,width,height,duration -of compact dwarka_mandir.mp4
