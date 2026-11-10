"""Original synthesized score + SFX for "जादुई जंगल का रहस्य", mixed under voice/voice.wav -> audio/mix.wav (48k stereo).
Music follows the story mood: playful (0-20.6) -> mystery (20.6-30.5) -> adventure (30.5-38.4) -> wonder (38.4-55.6)
-> tender (55.6-65.5) -> magic burst + celebration (65.5-81) -> ending cadence (81-88)."""
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 88.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(7)


def t_(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env(d, a=0.005, r=0.2, sus=None):
    n = int(d * SR); e = np.ones(n)
    na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    if sus is None: e *= np.exp(-np.arange(n) / SR / max(1e-3, r))
    else:
        nr = min(n, int(r * SR)); e[n - nr:] *= np.linspace(1, 0, nr)
    return e
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)


class Bus:
    def __init__(self): self.L = np.zeros(N + SR * 4); self.R = np.zeros(N + SR * 4)
    def add(self, x, t0, g=1.0, pan=0.0):
        s = int(t0 * SR)
        if s < 0: x = x[-s:]; s = 0
        e = min(len(self.L), s + len(x)); x = x[: e - s]
        gl, gr = g * np.sqrt(0.5 * (1 - pan)), g * np.sqrt(0.5 * (1 + pan))
        self.L[s:e] += x * gl; self.R[s:e] += x * gr
    def st(self): return np.stack([self.L[:N], self.R[:N]], 1)


# ---------------- instruments ----------------
def marimba(m, d=0.6, v=1.0):
    f = midi(m); t = t_(d)
    return v * (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)) * env(d, 0.002, 1)
def bell(m, d=2.0, v=1.0):
    f = midi(m); t = t_(d); x = np.zeros_like(t)
    for k, a, dec in ((1, 1, 1.2), (2.76, 0.5, 0.6), (5.4, 0.25, 0.3), (8.93, 0.12, 0.15)): x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / dec)
    return v * x * env(d, 0.002, 10)
def pluck(m, d=0.8, v=1.0):
    f = midi(m); n = int(d * SR); p = int(SR / f)
    buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return v * lp(out, 5000)
def flute(m, d=0.5, v=1.0):
    f = midi(m); t = t_(d)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.3, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph) + 0.04 * lp(rng.standard_normal(len(t)), 3000)
    return v * x * env(d, 0.05, 0.12, sus=True)
def pad(ms, d, v=1.0, bright=1800):
    t = t_(d); x = np.zeros_like(t)
    for m in ms:
        for det in (-0.08, 0.0, 0.08):
            f = midi(m) * 2 ** (det / 12); ph = (f * t + rng.uniform()) % 1.0
            x += (2 * ph - 1) * 0.33
    return v * lp(x / len(ms), bright) * env(d, 0.6, 0.8, sus=True)
def bass(m, d=0.4, v=1.0):
    f = midi(m); t = t_(d)
    return v * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(d, 0.005, 0.1, sus=True) * np.exp(-t / 0.6)
def kick(v=1.0):
    t = t_(0.35); f = 50 + 120 * np.exp(-t / 0.03)
    return v * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
def shaker(v=1.0): return v * hp(rng.standard_normal(int(0.08 * SR)), 6000) * env(0.08, 0.005, 0.03)
def snare(v=1.0):
    t = t_(0.25); return v * (0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) + bp(rng.standard_normal(len(t)), 1500, 8000) * np.exp(-t / 0.08))
def tom(m=45, v=1.0):
    t = t_(0.4); f = midi(m) * (1 + 0.5 * np.exp(-t / 0.04))
    return v * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)


def reverb(x, sec=1.8, wet=0.25):
    n = int(sec * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (sec / 5)); ir = lp(ir, 6000)
    y = fftconvolve(x, ir)[: len(x)]; y /= np.max(np.abs(y)) + 1e-9
    return x + wet * y * np.max(np.abs(x))


# ---------------- score ----------------
mus = Bus()
B = 60 / 104  # beat (s)

def chord_notes(root, kind):
    iv = {"M": [0, 4, 7], "m": [0, 3, 7], "M7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "sus": [0, 5, 7], "add9": [0, 4, 7, 14]}[kind]
    return [root + i for i in iv]

def section_playful(t0, t1, prog, mel):
    """bright marimba melody + pluck chords + shaker/kick"""
    nb = int((t1 - t0) / B)
    for i in range(nb):
        t = t0 + i * B
        root, kind = prog[(i // 4) % len(prog)]
        if i % 4 == 0:
            mus.add(pad(chord_notes(root + 12, kind), 4 * B + 0.4, 0.05), t, 1, 0)
            mus.add(bass(root - 12, 0.5, 0.35), t)
        if i % 4 == 2: mus.add(bass(root - 5, 0.4, 0.25), t)
        mus.add(pluck(chord_notes(root + 12, kind)[i % 3] + 12, 0.5, 0.10), t + B / 2, 1, 0.3)
        mus.add(shaker(0.05), t + B / 2, 1, 0.5); mus.add(shaker(0.03), t, 1, 0.5)
        if i % 2 == 0: mus.add(kick(0.22), t)
    for k, (beat, m, dur) in enumerate(mel):
        tt = t0 + beat * B
        if tt < t1: mus.add(marimba(m, dur * B + 0.4, 0.22), tt, 1, -0.2)

# 0 - 20.6: playful, C major
PROG1 = [(60, "M"), (57, "m"), (65, "M"), (67, "M")]
MEL1 = []
phr = [(0, 72, 1), (1, 74, 0.5), (1.5, 76, 0.5), (2, 79, 1), (3, 76, 1), (4, 77, 1), (5, 76, 0.5), (5.5, 74, 0.5), (6, 72, 1), (7, 74, 1),
       (8, 76, 1), (9, 79, 0.5), (9.5, 81, 0.5), (10, 79, 1), (11, 76, 1), (12, 74, 1), (13, 76, 0.5), (13.5, 74, 0.5), (14, 72, 2)]
for rep in range(3): MEL1 += [(b + rep * 16, m, d) for b, m, d in phr]
section_playful(0.4, 20.6, PROG1, MEL1)
# a few twinkles in the opening
for i, m in enumerate([84, 88, 91, 96]): mus.add(bell(m, 2.5, 0.06), 0.6 + i * 0.18, 1, 0.4)

# 20.6 - 30.5: mystery, A minor, slow pad + celesta falling + low pulse
for k, (root, kind) in enumerate([(57, "m"), (53, "M7"), (55, "sus"), (52, "M")]):
    t = 20.6 + k * 2.5
    mus.add(pad(chord_notes(root, kind) + [root - 12], 2.9, 0.11, 1100), t)
    mus.add(bass(root - 12, 2.0, 0.25), t)
fall = [88, 84, 81, 79, 76, 72, 69, 67, 64]
for i, m in enumerate(fall): mus.add(bell(m, 2.0, 0.07), 21.0 + i * 0.55, 1, -0.4 + 0.1 * i)
for i in range(8): mus.add(tom(40, 0.12), 26.4 + i * 0.5)

# 30.5 - 38.4: adventure, D minor, drums + staccato flute
for i in range(int((38.4 - 30.5) / (B / 2))):
    t = 30.5 + i * B / 2
    if i % 4 == 0: mus.add(kick(0.3), t)
    if i % 4 == 2: mus.add(snare(0.12), t)
    mus.add(shaker(0.05), t, 1, 0.4)
    if i % 8 == 6: mus.add(tom(45, 0.18), t); mus.add(tom(41, 0.18), t + B / 4)
prog_adv = [(62, "m"), (58, "M"), (60, "M"), (57, "M")]
for k in range(int((38.4 - 30.5) / (2 * B)) + 1):
    root, kind = prog_adv[k % 4]; t = 30.5 + k * 2 * B
    mus.add(pad(chord_notes(root, kind), 2 * B + 0.2, 0.08, 2400), t)
    for j in range(4): mus.add(bass(root - 12 + (7 if j % 2 else 0), 0.3, 0.3), t + j * B / 2)
adv = [74, 77, 81, 79, 77, 76, 74, 76, 77, 79, 81, 84, 81, 79, 77, 76]
for i in range(int((38.2 - 30.6) / (B / 2))): mus.add(flute(adv[i % len(adv)], B / 2 * 0.8, 0.10), 30.6 + i * B / 2, 1, 0.2)

# 38.4 - 55.6: wonder / the magic tree: harp arpeggios + choir pad + bells
prog_w = [(53, "M7"), (55, "add9"), (52, "m7"), (57, "m7")]
for k in range(int((55.6 - 38.4) / 2.6) + 1):
    root, kind = prog_w[k % 4]; t = 38.4 + k * 2.6
    notes = chord_notes(root, kind)
    mus.add(pad([n + 12 for n in notes], 3.0, 0.09, 1500), t)
    mus.add(bass(root - 12, 2.4, 0.22), t)
    for j in range(8): mus.add(pluck(notes[j % len(notes)] + 12 + 12 * (j // 4), 1.2, 0.07), t + j * 0.16, 1, -0.5 + j * 0.12)
mus.add(bell(96, 3, 0.08), 38.7, 1, 0.3); mus.add(bell(91, 3, 0.08), 38.95, 1, -0.3)

# 55.6 - 65.5: tender, F major, flute melody
prog_t = [(65, "M"), (60, "M"), (62, "m"), (58, "M")]
for k in range(int((65.5 - 55.6) / (4 * B)) + 1):
    root, kind = prog_t[k % 4]; t = 55.6 + k * 4 * B
    mus.add(pad(chord_notes(root, kind), 4 * B + 0.4, 0.08, 1300), t)
    mus.add(bass(root - 12, 1.5, 0.22), t)
    for j in range(4): mus.add(pluck(chord_notes(root, kind)[j % 3] + 12, 0.9, 0.06), t + j * B, 1, 0.3)
ten = [(0, 77, 1.5), (1.5, 76, 0.5), (2, 74, 1), (3, 72, 1), (4, 74, 2), (6, 72, 1), (7, 69, 1), (8, 70, 1.5), (9.5, 72, 0.5), (10, 74, 2), (12, 77, 1), (13, 79, 1), (14, 81, 2)]
for b, m, d in ten: mus.add(flute(m, d * B * 0.95, 0.09), 56.2 + b * B, 1, -0.1)

# 65.5: magic burst - rising glissando + cymbal-like shimmer
for i in range(24): mus.add(bell(72 + i * 1, 1.5, 0.05), 64.3 + i * 0.05, 1, -0.6 + i * 0.05)
sh = hp(rng.standard_normal(int(3 * SR)), 5000) * np.exp(-t_(3) / 0.9) * np.clip(t_(3) / 0.05, 0, 1)
mus.add(sh, T_BURST := 65.5, 0.06)

# 66.0 - 81.0: celebration - playful theme, fuller, in D major
PROG_C = [(62, "M"), (59, "m"), (67, "M"), (69, "M")]
MELC = []
for rep in range(4): MELC += [(b + rep * 16, m + 2, d) for b, m, d in phr]
section_playful(66.2, 81.0, PROG_C, MELC)
for i in range(int((81.0 - 66.2) / B)):
    if i % 2 == 1: mus.add(snare(0.08), 66.2 + i * B)
for b, m, d in MELC:
    tt = 66.2 + b * B
    if tt < 80.8: mus.add(flute(m + 12, d * B * 0.9, 0.035), tt, 1, 0.3)

# 81 - 88: ending - warm cadence + final sting
for k, (root, kind) in enumerate([(67, "M"), (65, "M"), (62, "m7"), (67, "sus"), (60, "add9")]):
    t = 81.0 + k * 1.15
    d = 1.4 if k < 4 else 3.4
    mus.add(pad(chord_notes(root, kind), d, 0.1, 1800), t)
    mus.add(bass(root - 24, d, 0.3), t)
    for j, n in enumerate(chord_notes(root, kind)): mus.add(marimba(n + 12, 0.8, 0.12), t + j * 0.09, 1, -0.3 + 0.3 * j)
for i, m in enumerate([72, 76, 79, 84, 88]): mus.add(bell(m, 2.5, 0.09), 85.6 + i * 0.07, 1, -0.4 + 0.2 * i)
mus.add(kick(0.4), 85.6); mus.add(sh * 0.6, 85.6, 0.05)

M = mus.st()
M[:, 0] = reverb(M[:, 0], 2.0, 0.22); M[:, 1] = reverb(M[:, 1], 2.1, 0.22)

# ---------------- SFX ----------------
fx = Bus()
def step(v=1.0):
    x = lp(rng.standard_normal(int(0.07 * SR)), 1800) * env(0.07, 0.002, 0.02)
    return v * x
def boing(f0=220, f1=700, d=0.45, v=1.0):
    t = t_(d); f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.08)) + 40 * np.sin(2 * np.pi * 14 * t)
    return v * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
def pop(v=1.0):
    t = t_(0.12); f = 900 * np.exp(-t / 0.02) + 300
    return v * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
def rustle(d=0.6, v=1.0):
    n = rng.standard_normal(int(d * SR)); am = 0.5 + 0.5 * np.sin(2 * np.pi * 9 * t_(d) + rng.uniform(0, 6))
    return v * bp(n, 1500, 7000) * am * env(d, 0.05, 0.15, sus=True)
def whoosh(d=0.6, v=1.0, up=True):
    n = rng.standard_normal(int(d * SR)); e = np.sin(np.pi * t_(d) / d) ** 2
    return v * bp(n, 400 if up else 300, 3000) * e
def splash(v=1.0):
    t = t_(0.5); n = rng.standard_normal(len(t))
    return v * (bp(n, 800, 6000) * np.exp(-t / 0.12) + 0.4 * bp(n, 200, 900) * np.exp(-t / 0.2))
def sparkle(t0, d, n, v=0.05, lo=84, hi=100, down=False):
    for i in range(n):
        u = i / max(1, n - 1)
        m = (hi - (hi - lo) * u) if down else rng.integers(lo, hi)
        fx.add(bell(m, 1.0, v * (1 - 0.5 * u if down else 1)), t0 + d * u + rng.uniform(0, 0.05), 1, rng.uniform(-0.7, 0.7))
def chirp(f0=3200, v=1.0, n=2):
    out = []
    for k in range(n):
        t = t_(0.09); f = f0 + 1600 * np.sin(np.pi * t / 0.09)
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.09)); out.append(np.zeros(int(0.05 * SR)))
    return v * np.concatenate(out)
def sad_chirp(v=1.0):
    t = t_(0.35); f = 2600 - 1200 * t / 0.35
    return v * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.35)
def flutter(d=0.8, v=1.0):
    t = t_(d); return v * bp(rng.standard_normal(len(t)), 300, 2500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 18 * t))) * np.exp(-t / 0.5)
def dig(v=1.0):
    t = t_(0.18); return v * lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.05)
def creak(d=1.4, v=1.0):
    t = t_(d); f = 70 + 25 * np.sin(2 * np.pi * 0.7 * t)
    saw = ((np.cumsum(f) / SR) % 1.0) * 2 - 1
    return v * lp(saw * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t)), 900) * env(d, 0.2, 0.3, sus=True)
def rumble(d=1.5, v=1.0): return v * lp(rng.standard_normal(int(d * SR)), 120, 4) * env(d, 0.3, 0.5, sus=True)
def giggle(v=1.0, base=900):
    out = []
    for k in range(5):
        t = t_(0.07); f = base * (1.15 - 0.05 * k) * (1 + 0.15 * np.sin(np.pi * t / 0.07))
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.07) ** 2); out.append(np.zeros(int(0.045 * SR)))
    return v * np.concatenate(out)
def ding(m=84, v=1.0): return bell(m, 1.8, v)

# walking 0-10.4 (Chintu ~1.9 steps/s)
for k in range(int(10.4 * 1.9)): fx.add(step(0.25 * min(1, 0.3 + k / 12)), 0.3 + k / 1.9, 1, 0.1)
# the funny sound + bush
fx.add(boing(180, 520, 0.45, 0.35), 10.35); fx.add(giggle(0.12, 1100), 10.75, 1, 0.4)
for k in range(5): fx.add(rustle(0.5, 0.18), 10.3 + k * 0.7, 1, 0.5)
fx.add(pop(0.4), 13.8, 1, 0.3); fx.add(boing(260, 900, 0.4, 0.3), 13.85, 1, 0.3)
for k in range(5): fx.add(boing(300 + 60 * k, 800 + 80 * k, 0.35, 0.22), 14.3 + k * 0.85, 1, 0.2 * ((-1) ** k))
fx.add(giggle(0.14, 1300), 16.0, 1, 0.2); fx.add(giggle(0.12, 1200), 17.7, 1, 0.1)
# magic fades away
sparkle(21.0, 4.6, 26, 0.05, 76, 100, down=True)
fx.add(whoosh(1.6, 0.06), 23.4)
# running
for k in range(int((35.5 - 30.6) * 3.6)): fx.add(step(0.3), 30.6 + k / 3.6, 1, 0.0)
fx.add(whoosh(0.8, 0.1), 30.5)
# stepping stones
for k in range(5): fx.add(splash(0.18), 35.6 + k * 0.6, 1, -0.2); fx.add(step(0.3), 35.62 + k * 0.6)
fx.add(splash(0.12), 36.0, 1, 0.3)
# the reveal + the tree wakes
sparkle(38.6, 1.5, 12, 0.05, 88, 100)
fx.add(rumble(1.6, 0.45), 43.0); fx.add(creak(1.5, 0.12), 43.1)
sparkle(43.3, 0.8, 8, 0.04, 90, 100)
# the hurt bird
fx.add(sad_chirp(0.10), 55.9, 1, 0.3); fx.add(sad_chirp(0.09), 57.0, 1, 0.3)
fx.add(rustle(0.4, 0.08), 57.2, 1, 0.2)
fx.add(chirp(3300, 0.12, 3), 58.7, 1, 0.3); fx.add(flutter(0.9, 0.18), 59.6, 1, 0.2); fx.add(chirp(3600, 0.10, 2), 60.2, 1, -0.1)
# digging + planting
for k in range(9): fx.add(dig(0.35), 61.85 + k * 0.22, 1, -0.3)
fx.add(pop(0.3), 64.0, 1, -0.2)
# the golden burst
fx.add(whoosh(1.2, 0.18), 64.9); sparkle(65.5, 1.6, 30, 0.05, 84, 102)
fx.add(rumble(1.0, 0.25), 65.45)
# celebration
for k in range(10): fx.add(chirp(3000 + 400 * (k % 3), 0.07, 2), 66.8 + k * 0.9, 1, rng.uniform(-0.8, 0.8))
for k in range(6): fx.add(giggle(0.09, 1000 + 120 * k), 67.4 + k * 1.3, 1, rng.uniform(-0.5, 0.5))
for k in range(8): fx.add(boing(350, 900, 0.3, 0.12), 66.9 + k * 0.45, 1, rng.uniform(-0.6, 0.6))
# moral + end card
fx.add(whoosh(0.6, 0.12), 81.3); fx.add(ding(88, 0.12), 81.55)
for i in range(9): fx.add(pop(0.08), 81.9 + i * 0.32, 1, -0.6 + i * 0.15)
fx.add(ding(91, 0.15), 85.4)
for i in range(6): fx.add(bell(96 if i % 2 else 93, 0.4, 0.07), 86.2 + i * 0.09, 1, 0.5)

F = fx.st()

# ---------------- mix ----------------
v, vsr = sf.read(f"{ROOT}/voice/voice.wav")
assert vsr == SR
if v.ndim > 1: v = v.mean(1)
v = np.pad(v, (0, max(0, N - len(v))))[:N]
# duck the music under the voice (smoothed envelope)
e = np.abs(v); e = lp(e, 6, 2); e = np.clip(e / (np.percentile(e[e > 1e-4], 90) + 1e-9), 0, 1)
duck = 1 - 0.68 * e
M *= duck[:, None]
music_gain, sfx_gain = 0.55, 0.9
mix = M * music_gain + F * sfx_gain + np.stack([v, v], 1) * 1.0
# fades
fade = np.ones(N); fade[: int(0.5 * SR)] = np.linspace(0, 1, int(0.5 * SR)); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)) ** 0.7
mix *= fade[:, None]
# loudness: target ~ -16 dBFS RMS on the speech-heavy parts, then soft clip
rms = np.sqrt(np.mean(mix ** 2)); mix *= 10 ** (-18.3 / 20) / rms
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
peak = np.max(np.abs(mix)); mix *= min(1, 0.95 / peak)
os.makedirs(f"{ROOT}/audio", exist_ok=True)
sf.write(f"{ROOT}/audio/mix.wav", mix.astype(np.float32), SR, subtype="PCM_24")
sf.write(f"{ROOT}/audio/music.wav", (M * music_gain).astype(np.float32), SR, subtype="PCM_24")
sf.write(f"{ROOT}/audio/sfx.wav", (F * sfx_gain).astype(np.float32), SR, subtype="PCM_24")
print("mix written", mix.shape, "peak", np.max(np.abs(mix)))
