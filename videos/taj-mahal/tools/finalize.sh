#!/bin/bash
# join chunks + mux audio/mix.wav -> out/final.mp4, then QA (black / freeze / loudness)
set -e
cd "$(dirname "$0")/.."
ls out/chunks/c_*.mp4 | sort | sed "s#^#file '$PWD/#; s#\$#'#" > out/chunks/list.txt
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i out/chunks/list.txt -i audio/mix.wav -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -of compact out/final.mp4
echo "--- QA"
ffmpeg -hide_banner -i out/final.mp4 -vf "blackdetect=d=0.1:pix_th=0.06,freezedetect=n=0.002:d=0.5" -af ebur128 -f null - 2>&1 | grep -E "black_start|freeze_start|freeze_duration|I:" | head -40
