# Shorten long pauses in the raw take (keep 0.30 s, the hook pause 0.45 s), then speed up 1.12x with rubberband.
import sys, subprocess, numpy as np
from scipy.io import wavfile
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float32) / 32768
out = subprocess.run(["ffmpeg","-hide_banner","-i",sys.argv[1],"-af","silencedetect=noise=-40dB:d=0.2","-f","null","-"],capture_output=True,text=True).stderr
import re
st = [float(v) for v in re.findall(r"silence_start: ([0-9.]+)", out)]; en = [float(v) for v in re.findall(r"silence_end: ([0-9.]+)", out)]
keep, pos = [], 0
for i,(a,b) in enumerate(zip(st,en)):
    target = 0.45 if i == 0 else 0.30
    if b - a > target:
        mid_a = a + 0.08; cut = (b - a) - target   # keep the tail of the word + the lead-in of the next
        keep.append(x[int(pos*sr):int(mid_a*sr)]); pos = mid_a + cut
keep.append(x[int(pos*sr):])
y = np.concatenate(keep)
wavfile.write(sys.argv[2], sr, (np.clip(y,-1,1)*32767).astype(np.int16))
print(len(x)/sr, "->", len(y)/sr)
