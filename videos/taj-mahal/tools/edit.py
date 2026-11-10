"""Cut the spoken line numbers out of the TTS take and tighten the pauses.
usage: python edit.py raw48.wav out.wav out_map.json"""
import sys, json, subprocess, re
import numpy as np, soundfile as sf

src, dst, mapf = sys.argv[1:4]
a, sr = sf.read(src)

log = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "silencedetect=noise=-35dB:d=0.25",
                      "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", log)]
en = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", log)]
sil = list(zip(st, en))
dur = len(a) / sr

# speech islands = complement of silences
isl, t = [], 0.0
for s, e in sil:
    if s > t: isl.append([t, s])
    t = e
if t < dur: isl.append([t, dur])
isl = [x for x in isl if x[1] - x[0] > 0.03]          # drop clicks
# line 15: "पंद्रह" runs straight into "मरने" with no silence; split at the energy dip
for i, (s, e) in enumerate(isl):
    if s < 106.9 < e:
        isl.insert(i + 1, [107.10, e]); isl[i][1] = 107.10; forced = i; break

# spoken numbers: the first island, and every short island right after a ~1.2 s line gap
num = [0]
for i in range(1, len(isl)):
    gap = isl[i][0] - isl[i - 1][1]
    if gap > 1.15 and isl[i][1] - isl[i][0] < 0.6:
        num.append(i)
num = sorted(set(num) | {forced})
print("numbers removed:", len(num), [tuple(round(x, 2) for x in isl[i]) for i in num])

LINE_GAP, MAX_PAUSE, XF = 0.50, 0.55, int(0.012 * sr)
keep = [isl[i] for i in range(len(isl)) if i not in num]
line_starts = [isl[i + 1][0] for i in num]          # original time each line's speech begins

out, tmap, cur = [], [], 0.0
def push(seg):
    global cur
    seg = seg.copy()
    f = min(XF, len(seg) // 2)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    out.append(seg); cur += len(seg) / sr

for k, (s, e) in enumerate(keep):
    if k:
        ps, pe = keep[k - 1][1], s
        new_line = any(abs(s - ls) < 1e-6 for ls in line_starts)
        T = LINE_GAP if new_line else min(pe - ps, MAX_PAUSE)
        # pad edges with real room tone from the original gap, middle removed
        if new_line:   # the end of this gap holds the cut-out number: fill from the silence after the last line
            push(a[int(ps * sr):int((ps + T) * sr)])
        else:
            push(np.concatenate([a[int(ps * sr):int((ps + T / 2) * sr)], a[int((pe - T / 2) * sr):int(pe * sr)]]))
    tmap.append(dict(orig=[round(s, 3), round(e, 3)], new=round(cur, 3)))
    push(a[int(s * sr):int(e * sr)])
    if k == len(keep) - 1:
        push(np.zeros(int(0.4 * sr)))

y = np.concatenate(out)
sf.write(dst, y, sr)
line_new = []
for ls in line_starts:
    m = next(x for x in tmap if abs(x["orig"][0] - ls) < 2e-3)
    line_new.append(m["new"])
json.dump(dict(segments=tmap, line_starts=line_new), open(mapf, "w"), indent=1)
print("old %.1fs -> new %.1fs" % (dur, len(y) / sr))
print("line starts:", line_new)
