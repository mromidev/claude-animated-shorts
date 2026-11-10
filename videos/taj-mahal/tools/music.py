"""Original synthesized score for the Taj Mahal short: tanpura drone, keherwa tabla, santoor-like plucks, hits.
usage: python music.py voice.wav words.json line_starts.json out_dir"""
import sys, json
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt

voice_p, words_p, lines_p, out = sys.argv[1:5]
SR = 48000
v, _ = sf.read(voice_p)
W = json.load(open(words_p))
L = json.load(open(lines_p))
END = len(v) / SR + 2.5
N = int(END * SR)
rng = np.random.default_rng(7)

def word_t(prefix, after=0.0):
    for w in W:
        if w["s"] >= after and w["w"].strip(".,।").startswith(prefix):
            return w["s"]
    raise SystemExit("word not found: " + prefix)

SA = 146.83                                    # D3
def note(semi, octave=0): return SA * 2 ** (semi / 12 + octave)
YAMAN = [0, 2, 4, 6, 7, 9, 11]                 # S R G M# P D N
BHAIRAVI = [0, 1, 3, 5, 7, 8, 10]              # S r g m P d n  (sad ending)

def t_axis(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def lp(x, f): return sosfilt(butter(2, f, "lowpass", fs=SR, output="sos"), x)

def add(buf, t0, sig, g=1.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(sig) <= 0: return
    j = min(len(buf), i + len(sig))
    buf[max(i, 0):j] += g * sig[max(0, -i):j - i]

# ---------- instruments ----------
def tanpura(f, d=3.2):
    t = t_axis(d); s = np.zeros_like(t)
    for k in range(1, 14):
        # jawari: upper partials bloom then fade, with a slow shimmer
        env = np.exp(-t / (2.6 / k ** .35)) * (1 - np.exp(-t * (6 + 2 * k)))
        bloom = 1 + .6 * np.sin(2 * np.pi * (.35 + .07 * k) * t + k)
        s += env * bloom * np.sin(2 * np.pi * f * k * (1 + .0004 * rng.standard_normal()) * t) / k ** .9
    return s * .25

def bayan(d=.45, f0=105, f1=62):
    t = t_axis(d)
    f = f1 + (f0 - f1) * np.exp(-t / .06)              # the pitch-bending "ge"
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / .16) + .3 * np.sin(2 * ph) * np.exp(-t / .07)
    s += .25 * bp(rng.standard_normal(len(t)), 150, 900) * np.exp(-t / .012)
    return s * .9

def dayan(d=.35, f=SA * 2, tau=.11):
    t = t_axis(d)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau / r ** .5))
            for r, a in [(1, 1), (2, .55), (3, .35), (4, .2), (5.1, .1)])
    s += .3 * bp(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t / .006)
    return s * .45

def ti(d=.08):
    t = t_axis(d)
    return .35 * bp(rng.standard_normal(len(t)), 2500, 6500) * np.exp(-t / .018)

def boom(d=2.4, g=1.0):
    t = t_axis(d)
    f = 38 + 60 * np.exp(-t / .05)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .7)
    s += .5 * lp(rng.standard_normal(len(t)), 400) * np.exp(-t / .25)
    s += .35 * bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / .03)
    return s * g

def pluck(f, d=2.2, bright=.5):
    """Karplus-Strong string with a little santoor-like doubling."""
    n = int(d * SR); p = max(2, int(SR / f))
    buf = lp(rng.uniform(-1, 1, p), 2500 + 5000 * bright)
    y = np.zeros(n); y[:p] = buf
    for i in range(p, n):
        y[i] = .996 * .5 * (y[i - p] + y[i - p - 1 if i - p - 1 >= 0 else i - p])
    t = t_axis(d)
    y2 = np.sin(2 * np.pi * f * 2.003 * t) * np.exp(-t / .5) * .25
    return (y + y2) * np.exp(-t / 1.4) * .5

def riser(d=1.5):
    t = t_axis(d)
    return bp(rng.standard_normal(len(t)), 800, 6000) * (t / d) ** 2.5 * .25

# ---------- arrangement ----------
drone = np.zeros(N); tabla = np.zeros(N); mel = np.zeros(N); fx = np.zeros(N)

# tanpura cycle P S' S' S, all the way through (sad section drops to S-m)
t, c = 0.0, 0
while t < END - 1:
    sad = t > L[12]
    seq = [note(5, -1), note(0), note(0), note(0, -1)] if sad else [note(7, -1), note(0), note(0), note(0, -1)]
    add(drone, t, tanpura(seq[c % 4]), .9); t += 1.15; c += 1

M = 0.25                                        # one matra (s): 120 matras / min
KEHERWA = ["dha", "ge", "na", "ti", "na", "ka", "dhin", "na"]
def stroke(name, t0, g=1.0):
    if name in ("dha", "dhin"):
        add(tabla, t0, bayan(), g); add(tabla, t0, dayan(tau=.16 if name == "dhin" else .11), g)
    elif name == "ge": add(tabla, t0, bayan(f0=95, f1=70), .7 * g)
    elif name == "na": add(tabla, t0, dayan(), .8 * g)
    elif name in ("ti", "ka"): add(tabla, t0, ti(), g)

def groove(t0, t1, g=1.0, half=False):
    t, i = t0, 0
    while t < t1 - .01:
        b = KEHERWA[i % 8]
        if not half or b in ("dha", "dhin", "ge"):
            stroke(b, t, g * (1.1 if i % 8 == 0 else 1))
        t += M; i += 1

def tirakita(t0, n=8, g=.8):              # fast roll into a hit
    for k in range(n): stroke("na" if k % 2 else "ti", t0 + k * M / 2, g * (.6 + .4 * k / n))

def melody(t0, t1, scale, phrase, step=2 * M, octave=1, g=.55):
    t, i = t0, 0
    while t < t1 - .2:
        deg = phrase[i % len(phrase)]
        if deg is not None:
            o = octave + deg // 7
            add(mel, t, pluck(note(scale[deg % 7], o - 1)), g)
        t += step; i += 1

# 1  hook: boom at the top, riser into the flash after the line
add(fx, 0.0, boom(), .9)
add(fx, L[1] - 1.5, riser())
add(fx, L[1] - .05, boom(g=.7))
# 2-3  death and the vow: drone + slow sad-ish plucks, no drums
melody(L[1] + .5, L[3] - .5, YAMAN, [4, None, 2, None, 0, None, None, None, 6 - 7, None, 0, None, None, None, None, None], step=M, g=.45)
# 4-8  construction: full keherwa + Yaman melody, growing
groove(L[3], L[8] - .1, .75)
melody(L[3], L[8] - .6, YAMAN, [0, 2, 4, None, 6, 4, 7, None, 9, 7, 6, 4, 2, None, 0, None])
groove(L[5], L[8] - .1, .35)                          # elephants: doubled, heavier
tirakita(L[8] - 1.0, 8)
# 9  snap: everything stops, one big hit
add(fx, L[8], boom(), 1.0)
# 10-11  explanation: half-time pulse, quake hit on "भूकंप"
groove(L[9], L[11] - .2, .6, half=True)
add(fx, next(w["s"] for w in W if w["s"] > L[9] and w["w"].startswith(("भूक", "भुक", "भूकं"))) - .02, boom(g=.6))
melody(L[10], L[11] - .4, YAMAN, [4, None, None, None, 2, None, None, None], step=M, g=.4)
# 12  good news: light dayan-only groove
t = L[11]
while t < L[12] - .2:
    stroke("na", t, .6); stroke("ti", t + M, .8); t += 2 * M
# 13  bad news: door-slam hit on "बुरी"
add(fx, L[12] - .03, boom(g=.85))
# 14-16  prison, burial, callback: drone + slow Bhairavi plucks, soft end hit on the last word
melody(L[13], END - 3, BHAIRAVI, [4, None, None, None, 3, None, 1, None, 0, None, None, None, None, None, None, None], step=M, g=.45)
add(fx, W[-1]["s"] - .02, boom(g=.55))
add(mel, W[-1]["s"] + .3, pluck(note(0, 0), d=3.0), .6)

# ---------- mix ----------
def reverb(x, d=1.8, wet=.25):
    t = t_axis(d); ir = rng.standard_normal(len(t)) * np.exp(-t / (d / 5)); ir /= np.sqrt(np.sum(ir ** 2))
    return x + wet * fftconvolve(x, ir)[:len(x)]

music = reverb(.55 * drone + 1.0 * tabla + .9 * mel, wet=.3) + reverb(fx, 2.4, .35)

# duck under the voice (attack 30 ms, release 350 ms), keep beats audible
vv = np.zeros(N); vv[:len(v)] = v
h = int(.02 * SR)
env = np.sqrt(np.convolve(vv ** 2, np.ones(h) / h, "same"))
act = (env > .02).astype(float)
g = np.zeros(N); a_att, a_rel = np.exp(-1 / (.03 * SR)), np.exp(-1 / (.35 * SR))
cur = 0.0
for i in range(N):
    tgt = act[i]; k = a_att if tgt > cur else a_rel
    cur = k * cur + (1 - k) * tgt; g[i] = cur
duck = 10 ** (-7 * g / 20)                     # -7 dB while speaking
music *= duck

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
music *= 10 ** ((rms_db(vv[vv != 0]) - 9 - rms_db(music)) / 20)   # music ~9 dB under voice on average
mix = vv + music
fade = int(1.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade)
sf.write(out + "/music_stem.wav", music, SR)
sf.write(out + "/mix_raw.wav", mix / max(1.0, np.abs(mix).max() / .98), SR)
print("written, %.1f s" % END)
