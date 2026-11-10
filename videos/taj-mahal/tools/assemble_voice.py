"""Trim each XTTS line to its spoken words, check it with faster-whisper, join with fixed gaps.
usage: python assemble_voice.py <lines_dir> <out_wav> <out_words.json> <out_line_starts.json>"""
import sys, glob, json
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel

src, out_wav, out_words, out_starts = sys.argv[1:5]
SR, GAP, LEAD = 48000, 0.42, 0.35
m = WhisperModel("medium", device="cpu", compute_type="int8")

def tighten(x, keep=0.3, min_run=0.42):
    """shorten pauses inside a line: quiet runs longer than min_run s become keep s"""
    h = int(0.01 * SR); n = len(x) // h
    rms = np.array([np.sqrt(np.mean(x[i * h:(i + 1) * h] ** 2)) for i in range(n)])
    q = rms < 10 ** (-38 / 20) * max(1e-6, np.percentile(rms, 95)) / 0.3
    out, i = [], 0
    while i < n:
        j = i
        while j < n and q[j] == q[i]: j += 1
        a0, a1 = i * h, j * h
        if q[i] and (j - i) * 0.01 > min_run and i > 0 and j < n:
            k = int(keep * SR / 2); out += [x[a0:a0 + k], x[a1 - k:a1]]
        else: out.append(x[a0:a1])
        i = j
    out.append(x[n * h:])
    return np.concatenate(out)
files = sorted(glob.glob(src + "/line_*.wav"))
pieces, words, starts, t = [np.zeros(int(LEAD * SR))], [], [], LEAD
for i, f in enumerate(files):
    a, sr = sf.read(f, dtype="float32")
    a48 = np.interp(np.arange(0, len(a), sr / SR), np.arange(len(a)), a).astype("float32")
    a16 = np.interp(np.arange(0, len(a), sr / 16000), np.arange(len(a)), a).astype("float32")
    segs, _ = m.transcribe(a16, language="hi", word_timestamps=True, temperature=0, condition_on_previous_text=False)
    ws = [w for s in segs for w in s.words]
    s0, e0 = max(0.0, ws[0].start - 0.06), min(len(a) / sr, ws[-1].end + 0.18)
    seg = tighten(a48[int(s0 * SR):int(e0 * SR)].copy())
    # words again on the tightened audio
    s16 = np.interp(np.arange(0, len(seg), SR / 16000), np.arange(len(seg)), seg).astype("float32")
    segs, _ = m.transcribe(s16, language="hi", word_timestamps=True, temperature=0, condition_on_previous_text=False)
    ws = [w for s in segs for w in s.words]; s0 = 0.0
    f_ = int(0.01 * SR); seg[:f_] *= np.linspace(0, 1, f_); seg[-f_:] *= np.linspace(1, 0, f_)
    starts.append(round(t, 3))
    for w in ws: words.append(dict(w=w.word.strip(), s=round(t + w.start - s0, 3), e=round(t + w.end - s0, 3), line=i + 1))
    print(i + 1, f"{t:6.2f} +{len(seg) / SR:.2f}", " ".join(w.word.strip() for w in ws), flush=True)
    pieces += [seg, np.zeros(int(GAP * SR))]
    t += len(seg) / SR + GAP
y = np.concatenate(pieces)
y = y / (np.abs(y).max() + 1e-9) * 0.9
sf.write(out_wav, y, SR)
json.dump(words, open(out_words, "w"), ensure_ascii=False, indent=0)
json.dump(starts + [round(t - GAP, 3)], open(out_starts, "w"))
print("total", round(len(y) / SR, 2))
