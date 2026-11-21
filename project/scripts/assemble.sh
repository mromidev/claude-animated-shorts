#!/bin/bash
# Concatenate the 2K chunks, mux the mix (Remotion writes a silent track: map video 0, audio 1), run frame QA.
set -e
cd "$(dirname "$0")/.."
D=out/molasses
ls $D/chunks/c*.mp4 | sort -V | sed "s|^$D/chunks/|file '|; s|$|'|" > $D/chunks/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $D/chunks/list.txt -c copy $D/video.mp4
ffmpeg -v error -y -i $D/video.mp4 -i ../shorts/molasses/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest $D/final.mp4
python3 scripts/molasses_shots.py
python3 scripts/short_qa.py $D/final.mp4 $D/qa $D/shots.json
