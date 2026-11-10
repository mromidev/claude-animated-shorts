"""Original synthesized score + sound design for the Kumbhalgarh documentary, mixed under the narration.
Sarangi-like lead over a drone, dholak, and per-chapter sound: wind, hooves, thunder and rain, crickets, war drums, cannon.
usage: python fort_score.py voice.wav timeline.json out_dir"""
import sys, json
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

voice_p, tl_p, out = sys.argv[1:4]
SR = 48000
voice, _ = sf.read(voice_p)
tl = json.load(open(tl_p)); CH = tl["starts"]; DUR = tl["end"]; N = int(DUR * SR)
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
rng = np.random.default_rng(5)
T = lambda d: np.arange(int(d * SR)) / SR
bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
lp = lambda x, f: sosfilt(butter(2, f, "lowpass", fs=SR, output="sos"), x)
hp = lambda x, f: sosfilt(butter(2, f, "highpass", fs=SR, output="sos"), x)
def add(buf, t0, s, g=1.0):
    i = int(t0 * SR)
    if i < 0: s = s[-i:]; i = 0
    j = min(len(buf), i + len(s))
    if i < len(buf): buf[i:j] += g * s[:j - i]
ch_end = lambda k: CH[k + 1] - .45 if k + 1 < len(CH) else DUR

SA = 146.83
SCALE = [0, 2, 4, 5, 7, 9, 11]
note = lambda deg, octv=1: SA * 2 ** ((SCALE[deg % 7] + 12 * (deg // 7)) / 12 + octv)

def sarangi(f0, f1, d, g=1.0):
    """bowed string: glide f0 -> f1, vibrato that grows, nasal band-pass"""
    t = T(d); f = f1 + (f0 - f1) * np.exp(-t / .09)
    f = f * (1 + .008 * np.sin(2 * np.pi * 5.6 * t) * np.clip(t / .5, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(k * ph) / k for k in range(1, 12))
    s = bp(s, 300, 2600) + .25 * bp(s, 900, 1500)
    env = np.clip(t / .12, 0, 1) * np.clip((d - t) / .3, 0, 1) * (1 + .12 * np.sin(2 * np.pi * 5.6 * t))
    return s * env * .11 * g

def drone(d):
    t = T(d); s = np.zeros_like(t)
    for f, a in ((SA / 2, .6), (SA * .75, .35), (SA, .5), (SA * 2, .15)):
        for k in range(1, 7): s += a * np.sin(2 * np.pi * f * k * t + k * 1.3) / k ** 1.5 * (1 + .25 * np.sin(2 * np.pi * (.21 + .03 * k) * t + k))
    return lp(s, 1400) * .035

def dhol_low(d=.5, f0=150, f1=58):
    t = T(d); f = f1 + (f0 - f1) * np.exp(-t / .05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .2) * .8
def dhol_hi(d=.18):
    t = T(d); return (np.sin(2 * np.pi * 300 * t) * np.exp(-t / .05) + .5 * bp(rng.standard_normal(len(t)), 1200, 5000) * np.exp(-t / .012)) * .3
def hoof(d=.09):
    t = T(d); return bp(rng.standard_normal(len(t)), 500, 2400) * np.exp(-t / .018) * .5
def bell(d=4.0, p=1.0):
    t = T(d); return sum(a * np.sin(2 * np.pi * f * p * t) * np.exp(-t / (1.8 / (1 + k * .7))) for k, (f, a) in enumerate([(440, 1), (1108, .5), (1670, .3), (2330, .15)])) * .25
def boom(d=2.6):
    t = T(d); f = 34 + 70 * np.exp(-t / .05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .6) + .6 * lp(rng.standard_normal(len(t)), 300) * np.exp(-t / .35)

music = np.zeros(N); perc = np.zeros(N); fx = np.zeros(N)
add(music, 0, drone(DUR))
# lead melody: slow phrases, a new one for each chapter (degree, beats), rests while the line is densest
BEAT = 0.72
PHR = [
    [(4, 3), (5, 1), (4, 2), (2, 2), (0, 4)],
    [(0, 2), (2, 2), (4, 2), (5, 1), (4, 1), (7, 4)],
    [(7, 3), (6, 1), (5, 2), (4, 2), (2, 2), (4, 4)],
    [(2, 4), (1, 2), (0, 2), (-1, 2), (0, 6)],
    [(4, 1), (5, 1), (7, 2), (8, 1), (7, 1), (5, 2), (4, 2), (7, 4)],
    [(7, 2), (9, 2), (8, 2), (7, 2), (5, 2), (4, 4)],
    [(4, 4), (3, 2), (2, 2), (0, 2), (2, 4)],
    [(0, 2), (4, 2), (7, 3), (9, 1), (7, 2), (5, 2), (4, 4)],
    [(2, 4), (4, 2), (2, 2), (0, 6)],
    [(0, 2), (1, 2), (0, 2), (-1, 2), (-3, 4), (0, 4)],
    [(4, 2), (7, 2), (9, 2), (11, 2), (9, 1), (7, 1), (7, 6)],
]
for k, ph in enumerate(PHR):
    t = CH[k] + 1.0; prev = None
    while t < ch_end(k) - 1.5:
        for deg, beats in ph:
            if t >= ch_end(k) - 1.0: break
            f = note(deg, 1 if k not in (3, 8, 9) else 0)
            add(music, t, sarangi(prev or f, f, beats * BEAT * 1.02), 1.0); prev = f; t += beats * BEAT
        t += 2 * BEAT
# dholak: gentle keherwa in the travelling chapters, silent in legend / cradle / night
for k in (1, 2, 5, 10):
    t, i = CH[k] - .3, 0
    while t < ch_end(k) - .3:
        if i % 8 in (0, 3, 6): add(perc, t, dhol_low(), .7)
        if i % 8 in (2, 4, 5, 7): add(perc, t, dhol_hi(), .7)
        t += BEAT / 2; i += 1
# chapter 5: eight horses, galloping triplets
t = CH[4] - .3
while t < ch_end(4) - .2:
    for off, g in ((0, 1), (.11, .7), (.2, .9)): add(fx, t + off, hoof(), g * .8); add(fx, t + off + .035, hoof(), g * .5)
    add(perc, t, dhol_low(.3, 120, 70), .5); t += .42
# wind on the ridges (chapters 1, 2, 11), rain + thunder in the monsoon (7), crickets at night (9)
wind = bp(rng.standard_normal(N), 250, 1100) * (0.5 + 0.5 * np.sin(2 * np.pi * np.arange(N) / SR * .13)) ** 2 * .05
for k in (0, 1, 10):
    a, b = int((CH[k] - 1.2) * SR) if k else 0, int(ch_end(k) * SR); env = np.ones(b - a); r = int(1.2 * SR); env[:r] = np.linspace(0, 1, r); env[-r:] = np.linspace(1, 0, r); fx[a:b] += wind[a:b] * env
a, b = int((CH[6] - .4) * SR), int(ch_end(6) * SR); r = int(1.0 * SR); env = np.ones(b - a); env[:r] = np.linspace(0, 1, r); env[-r:] = np.linspace(1, 0, r)
fx[a:b] += hp(rng.standard_normal(b - a), 3000) * .022 * env
for off in (1.2, 6.0): add(fx, CH[6] + off, lp(boom(4.5), 160), .5)
a, b = int((CH[8] - .4) * SR), int(ch_end(8) * SR); tt = np.arange(b - a) / SR
cr = np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 17 * tt) > .2) * (np.sin(2 * np.pi * .9 * tt) > -.2) * .012
env = np.ones(b - a); env[:r] = np.linspace(0, 1, r); env[-r:] = np.linspace(1, 0, r); fx[a:b] += cr * env
# temple bell for the temples and the legend, a soft bell for the cradle
add(fx, CH[5] + .2, bell(), .8); add(fx, CH[3] + .3, bell(5, .75), .6); add(fx, CH[7] + .2, bell(3, 2.0), .35)
# chapter 10: nagada war drums + three cannon shots, then silence for the dry tank
k = 9; t = CH[k] - .3; stop = CH[k] + (ch_end(k) - CH[k]) * .56
while t < stop:
    add(perc, t, dhol_low(.7, 110, 46), 1.1); add(perc, t + .28, dhol_low(.5, 100, 50), .7); t += .84
for off in (1.6, 3.9, 5.6): add(fx, CH[k] + off, boom(), .7)
# the hook and the last line get one deep hit each
add(fx, 0.3, boom(3.2), .5); add(fx, CH[10] - .2, boom(3.2), .4); add(fx, CH[10] + .1, bell(5), .5)

def reverb(x, d=2.4, wet=.3):
    tt = T(d); ir = rng.standard_normal(len(tt)) * np.exp(-tt / (d / 5)); ir /= np.sqrt(np.sum(ir ** 2))
    return x + wet * fftconvolve(x, ir)[:len(x)]
bed = reverb(music + perc * .7, 2.6, .32) + reverb(fx, 3.0, .3)
env = np.sqrt(np.convolve(voice ** 2, np.ones(960) / 960, "same")); act = (env > .015).astype(float)
g, cur = np.zeros(N), 0.0; ka, kr = np.exp(-1 / (.04 * SR)), np.exp(-1 / (.45 * SR))
for n in range(N): kk = ka if act[n] > cur else kr; cur = kk * cur + (1 - kk) * act[n]; g[n] = cur
bed *= 10 ** (-8 * g / 20)
rms = lambda x: np.sqrt(np.mean(x[np.abs(x) > 1e-5] ** 2))
bed *= (rms(voice) / rms(bed)) * 10 ** (-11 / 20)
# voice polish: gentle low cut + presence
v = hp(voice, 70); v = v + .25 * bp(v, 2500, 5000)
mix = v + bed
fi, fo = int(.4 * SR), int(2.2 * SR); mix[:fi] *= np.linspace(0, 1, fi); mix[-fo:] *= np.linspace(1, 0, fo)
sf.write(out + "/mix_raw.wav", mix / max(1, np.abs(mix).max() / .97), SR)
sf.write(out + "/music_only.wav", bed / np.abs(bed).max() * .9, SR)
print("ok", round(DUR, 2))
