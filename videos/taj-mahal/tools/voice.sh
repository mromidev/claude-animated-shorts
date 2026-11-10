# Rebuild the voice and the mix from voice/raw_tts.mp3. Run from videos/taj-mahal/voice/.
# Needs: ffmpeg (with rubberband), pip install numpy scipy soundfile faster-whisper
set -e
ffmpeg -hide_banner -loglevel error -y -i raw_tts.mp3 -ac 1 -ar 48000 raw48.wav
python3 ../tools/edit.py raw48.wav cut.wav map.json      # cut the spoken line numbers, tighten pauses
ffmpeg -hide_banner -loglevel error -y -i cut.wav -af "highpass=f=60,rubberband=pitch=0.891:tempo=1.08:transients=smooth:detector=soft:window=standard,equalizer=f=110:t=q:w=1:g=4,equalizer=f=320:t=q:w=1.4:g=-2,equalizer=f=3200:t=q:w=1.2:g=2,deesser=i=0.4,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,alimiter=limit=0.95" -ar 48000 voice_deep.wav
python3 ../tools/music.py voice_deep.wav words.json line_starts.json .   # words.json / line_starts.json are committed
ffmpeg -hide_banner -loglevel error -y -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 mix_final.wav
ffmpeg -hide_banner -loglevel error -y -i mix_final.wav -b:a 192k taj_mahal_voice_beats.mp3
