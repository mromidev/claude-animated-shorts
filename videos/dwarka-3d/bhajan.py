"""Original light bhajan-style score for the Dwarka tour (synthesized, no samples): bansuri melody in Khamaj,
harmonium drone, dholak + manjira keherwa, sea, temple bells at each chapter, aarti bells at the end.
Voice lines are placed at the chapter starts and the music ducks under them.
usage: python bhajan.py <lines_dir_with_line_XX.wav> <words.json-ignored> <out_dir>"""
import sys, glob, json
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

lines_dir, out = sys.argv[1], sys.argv[3]
SR, DUR = 48000, 76.0
N = int(DUR * SR)
rng = np.random.default_rng(3)
CHAPTERS = [0.9, 12.3, 21.3, 30.8, 38.3, 46.3, 54.8, 64.3]
t_ax = lambda d: np.arange(int(d * SR)) / SR
bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
lp = lambda x, f: sosfilt(butter(2, f, "lowpass", fs=SR, output="sos"), x)
def add(buf, t0, s, g=1.0):
    i = int(t0 * SR); j = min(len(buf), i + len(s))
    if i < len(buf): buf[i:j] += g * s[:j - i]

# ---------- voice: each line at its chapter start ----------
voice = np.zeros(N)
for k, f in enumerate(sorted(glob.glob(lines_dir + "/line_*.wav"))):
    a, sr = sf.read(f)
    a = np.interp(np.arange(0, len(a), sr / SR), np.arange(len(a)), a)
    nz = np.where(np.abs(a) > 0.02 * np.abs(a).max())[0]; a = a[max(0, nz[0] - 1200): nz[-1] + 4000]
    add(voice, CHAPTERS[k], a / np.abs(a).max() * 0.85)

SA = 146.83  # D
KHAMAJ = [0, 2, 4, 5, 7, 9, 10, 12]  # S R G m P D n S'
note = lambda deg, octv=1: SA * 2 ** ((KHAMAJ[deg % 7] + 12 * (deg // 7)) / 12 + octv)

def flute(f, d, g=1.0):
    t = t_ax(d); vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    s += 0.05 * bp(rng.standard_normal(len(t)), f * 0.8, f * 3)  # breath
    env = np.clip(t / 0.08, 0, 1) * np.clip((d - t) / 0.25, 0, 1)
    return s * env * 0.22 * g

def harmonium(f, d):
    t = t_ax(d); s = np.zeros_like(t)
    for k in range(1, 9): s += np.sign(np.sin(2 * np.pi * f * k * t + k)) / k ** 1.6
    s = lp(s, 1600) * (1 + 0.15 * np.sin(2 * np.pi * 5.5 * t))
    return s * np.clip(t / 0.6, 0, 1) * np.clip((d - t) / 0.6, 0, 1) * 0.05

def dholak_low(d=.4):
    t = t_ax(d); f = 70 + 80 * np.exp(-t / .04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .16) * .7
def dholak_hi(d=.2):
    t = t_ax(d); return (np.sin(2 * np.pi * 330 * t) * np.exp(-t / .06) + .4 * bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t / .01)) * .35
def manjira(d=.6):
    t = t_ax(d); s = sum(np.sin(2 * np.pi * f * t) for f in (2730, 3410, 4170, 5230)) / 4
    return (s + .3 * bp(rng.standard_normal(len(t)), 5000, 9000)) * np.exp(-t / .18) * .18
def bell(d=3.5, p=1.0):
    t = t_ax(d); return sum(a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / (1.6 / (1 + k * .6))) for k, (f, a) in enumerate([(520, 1), (1312, .5), (1980, .3), (2760, .18)])) * .3

music = np.zeros(N); perc = np.zeros(N); fx = np.zeros(N)
# harmonium drone: S-P chord, held, changing every 8 s
for k in range(0, int(DUR), 8):
    for f in (SA, SA * 1.5, SA * 2): add(music, k, harmonium(f, 8.6), 1.0)
# bansuri melody: an original phrase in Khamaj, one note per beat (BPM 84), repeated with small variations
BEAT = 60 / 84
phrase = [(4, 2), (5, 1), (4, 1), (2, 2), (0, 2), (2, 1), (4, 1), (5, 2), (7, 2), (6, 1), (5, 1), (4, 4),
          (5, 1), (4, 1), (2, 1), (4, 1), (2, 2), (1, 1), (0, 1), (0, 4), (None, 4)]
t = 4.0
while t < DUR - 4:
    for deg, beats in phrase:
        if t >= DUR - 4: break
        if deg is not None: add(music, t, flute(note(deg), beats * BEAT * 0.98), 0.9 if t < 60 else 0.7)
        t += beats * BEAT
# keherwa on dholak + manjira from 12 s, lighter during speech (ducking handles it)
KEH = ["dha", "ge", "na", "ti", "na", "ka", "dhin", "na"]
t, i = 12.0, 0
while t < DUR - 3:
    b = KEH[i % 8]
    if b in ("dha", "dhin", "ge"): add(perc, t, dholak_low(), 1.0 if b != "ge" else .6)
    if b in ("dha", "na", "dhin"): add(perc, t, dholak_hi(), .9)
    if i % 4 == 0: add(perc, t, manjira(), 1.0)
    t += BEAT / 2; i += 1
# sea ambience
sea = lp(rng.standard_normal(N), 500) * (0.5 + 0.5 * np.sin(2 * np.pi * np.arange(N) / SR * 0.11)) * 0.05
sea *= np.clip(1 - (np.arange(N) / SR - 50) / 20, 0.35, 1)
# bells: one at each chapter, a run of aarti bells at the end
for c in CHAPTERS[1:]: add(fx, c - 0.4, bell(), .7)
t = 64.0
while t < DUR - 2.5: add(fx, t, bell(1.4, 1.5 + .12 * (int(t * 2) % 2)), .25); t += 0.62

def reverb(x, d=2.2, wet=.28):
    tt = t_ax(d); ir = rng.standard_normal(len(tt)) * np.exp(-tt / (d / 5)); ir /= np.sqrt(np.sum(ir ** 2))
    return x + wet * fftconvolve(x, ir)[:len(x)]

bed = reverb(music * 1.0 + perc * 0.8, 2.0, .3) + reverb(fx, 3.0, .35) + sea
# duck under the voice
env = np.sqrt(np.convolve(voice ** 2, np.ones(960) / 960, "same")); act = (env > .02).astype(float)
g, cur = np.zeros(N), 0.0
ka, kr = np.exp(-1 / (.04 * SR)), np.exp(-1 / (.4 * SR))
for n in range(N): k = ka if act[n] > cur else kr; cur = k * cur + (1 - k) * act[n]; g[n] = cur
bed *= 10 ** (-8 * g / 20)
rms = lambda x: np.sqrt(np.mean(x[x != 0] ** 2))
bed *= (rms(voice) / rms(bed)) * 10 ** (-10 / 20)  # light: ~10 dB under the voice on average
mix = voice + bed
fo = int(2.0 * SR); mix[-fo:] *= np.linspace(1, 0, fo); mix[:int(.3 * SR)] *= np.linspace(0, 1, int(.3 * SR))
sf.write(out + "/mix_raw.wav", mix / max(1, np.abs(mix).max() / .97), SR)
sf.write(out + "/music_only.wav", bed / np.abs(bed).max() * .9, SR)
print("ok")
