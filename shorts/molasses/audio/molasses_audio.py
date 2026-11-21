# Sound for "The Great Molasses Flood": synthesized SFX on the picture's event table + an original score (1919
# ragtime band: tuba, horns, plucked "piano", glockenspiel, vibes, snare, timpani) ducked under the voice, mixed to
# -15 LUFS integrated, <= -1 dBTP, exactly 69.500 s / 48 kHz / stereo / 24-bit.
# Standard mix: music +3 dB, SFX -6 dB relative to the house baseline, voice unchanged.
# Times mirror project/src/videos/molasses/story.ts + cast.ts (frames / 30). Writes mix.wav, stems, cues.md.
import os
import json
import math
import numpy as np
from scipy import signal, ndimage
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, reson, resbank, peq, colored, smooth_noise, fades, shape, phase, modal,
                 pan, st, place, widen, make_ir, convolve_st, integrated, true_peak, read_wav, write_wav, momentary)
from instruments import m2f, brass, glock, vibes, musicbox, triangle, snare, snare_roll, cymbal, timpani, brush, pluck, pad
import sfx_gen as G

HERE = os.path.dirname(os.path.abspath(__file__))
SHORT = os.path.dirname(HERE)
FPS = 30
TOTAL = 2085
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS

# ---------------------------------------------------------------- picture timeline (story.ts)
SHOT = {1: 0, 2: 166, 3: 352, 4: 458, 5: 575, 6: 668, 7: 768, 8: 846, 9: 1036, 10: 1210, 11: 1416, 12: 1542, 13: 1590, 14: 1704,
        15: 1808, 16: 1912, 17: TOTAL}
T = {k: F(v) for k, v in SHOT.items()}
FLASH = F(166)
SPLIT = F(817)
BENT = F(976)
RIVETS = [F(f) for f in (726, 732, 737, 742, 748, 754)]
DING = F(1281)
POUR = (F(1292), F(1352))
COLD = F(1362)
BAGS = F(1621)
CLIP0 = F(1748)
SIGN = (F(1781), F(1796))
DROP_GO = F(2038)
PLOP = F(2044)
CRANE = F(2046)


def hh(i, s=0):
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


R = rng(1919)
music = np.zeros((2, N))
sfx = np.zeros((2, N))
CUES = []


def cue(t, name, gain_db, x, p=0.0, wide=False):
    """place a mono/stereo sound on the SFX bus"""
    y = np.asarray(x, float)
    if y.ndim == 1:
        y = widen(y, R, 9, 0.5) if wide else pan(y, p)
    place(sfx, y, t, dbg(gain_db))
    CUES.append((t, name, gain_db))


# ================================================================ SFX generators (own synthesis)
def roar(dur, k=1.0, r=R):
    """the molasses wave: a heavy low churn (brown noise, slow surges), thick gloops and a hiss on the crest"""
    n = ns(dur)
    t = np.arange(n) / SR
    surge = 0.75 + 0.25 * smooth_noise(n, r, 1.2)
    body = lp(colored(n, r, 2.0), 260, 2) * 2.2 * surge
    mid = bp(colored(n, r, 1.0), 180, 1400, 1) * 0.6 * surge
    gl = G.bubbles(dur, r, 55, 70, 380, (0.02, 0.07), rise=(1, 4)) * 1.4
    hiss = hp(colored(n, r, 0.5), 2500) * 0.08 * (0.6 + 0.4 * smooth_noise(n, r, 2.0))
    y = (body + mid + gl + hiss) * k
    return widen(fades(y, 0.25, 0.4), r, 13, 0.8)


def gloop(r=R, big=1.0):
    """one thick 'bloop': falling resonance + a slow bubble"""
    d = 0.5
    t = tt(d)
    f0 = r.uniform(140, 220) * big ** -0.3
    y = np.sin(phase(f0 * (1.6 - 0.6 * np.exp(-t / 0.05)) * (1 - 0.35 * t))) * np.exp(-t / 0.09) * (1 - np.exp(-t / 0.004))
    y += lp(r.standard_normal(len(t)), 600) * np.exp(-t / 0.02) * 0.3
    return fades(y * big, 0.0, 0.05)


def plip(r=R):
    """a drip landing in a half-full pail"""
    d = 0.35
    t = tt(d)
    f0 = r.uniform(380, 620)
    y = np.sin(phase(f0 * (1 + 1.6 * t))) * np.exp(-t / 0.045) * (1 - np.exp(-t / 0.002))
    y += 0.4 * gloop(r, 0.5)[: len(t)]
    return y


def gallop(t0, t1, rate=2.3, r=R, gain=0.0, p=0.0):
    """four-beat gallop on cobbles: clop-clop-clop...clop"""
    k = 0
    t = t0
    while t < t1:
        for j, off in enumerate((0.0, 0.07, 0.14, 0.24)):
            d = 0.12
            tl = tt(d)
            c = modal(d, [(r.uniform(420, 620), 1.0, 0.018), (r.uniform(900, 1400), 0.5, 0.01), (r.uniform(1800, 2600), 0.3, 0.006)], r)
            c += bp(r.standard_normal(len(tl)), 600, 5000, 1) * np.exp(-tl / 0.004) * 0.6
            cue(t + off, "gallop", gain - 3 * (j == 2), c, p)
        t += 1.0 / rate
        k += 1


def run_steps(t0, t1, people=5, r=R, gain=0.0):
    for i in range(people):
        t = t0 + r.uniform(0, 0.3)
        while t < t1:
            cue(t, "run step", gain + r.uniform(-4, 0), G.stroll_step(r, 0.2) * 0.8, r.uniform(-0.6, 0.6))
            t += r.uniform(0.17, 0.22)


def snow_steps(t0, t1, rate, r=R, gain=0.0, p=0.0):
    t = t0
    while t < t1:
        d = 0.18
        tl = tt(d)
        c = bp(r.standard_normal(len(tl)), 1200, 7000, 1) * np.exp(-tl / 0.05) * (1 - np.exp(-tl / 0.01))
        c *= 0.6 + 0.4 * (r.random(len(tl)) > 0.7)  # crunch grain
        cue(t, "snow step", gain, c, p)
        t += 1 / rate * r.uniform(0.92, 1.08)


def gull(r=R):
    """a far herring gull 'kee-ow'"""
    d = 0.55
    t = tt(d)
    f = np.interp(t, [0, 0.08, 0.3, d], [1300, 2100, 1500, 1150])
    ph = phase(f)
    y = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)) * np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.12, 0, 1)
    y += bp(r.standard_normal(len(t)), 1500, 4000, 1) * 0.1 * np.clip((d - t) / d, 0, 1)
    return y * 0.5


def train(dur, r=R):
    """elevated train: steel rumble + wheel-joint clacks"""
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 1.6), 500, 2) * 1.2 + bp(colored(n, r, 0.6), 900, 3000, 1) * 0.15
    tm = 0.2
    while tm < dur - 0.3:
        for off in (0.0, 0.11):
            c = modal(0.2, [(r.uniform(700, 900), 1, 0.03), (r.uniform(1700, 2200), 0.5, 0.015)], r) + lp(r.standard_normal(ns(0.2)), 400) * np.exp(-tt(0.2) / 0.02)
            G._place_mono(y, c * 0.9, tm + off)
        tm += r.uniform(0.62, 0.7)
    env = np.clip(t / 1.2, 0, 1) * np.clip((dur - t) / 1.4, 0, 1)
    return widen(y * env, r, 11, 0.7)


def ship_horn(r=R):
    y = brass(m2f(36), 1.8, 0.8, r, "soft") + 0.6 * brass(m2f(43), 1.8, 0.7, r, "soft")
    return lp(y, 900)


def slide_whistle(t0, d, f0, f1, r=R):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    ph = phase(f * (1 + 0.004 * np.sin(TAU * 6 * t)))
    y = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.06, 0, 1)
    y += bp(r.standard_normal(len(t)), 2000, 6000, 1) * 0.04
    return y * 0.6


METAL_LOW = [(48, 6, 1.0), (92, 8, 0.85), (171, 10, 0.65), (290, 12, 0.45), (470, 14, 0.3), (760, 16, 0.18)]
METAL_HI = [(620, 30, 0.8), (1130, 36, 1.0), (1790, 40, 0.7), (2650, 45, 0.45), (3900, 50, 0.25)]


def groan(dur, r=R, scale=1.0):
    return G.creak(dur, r, 14, 26, METAL_LOW, [(0, 0), (0.25, 1), (0.75, 0.9), (1, 0)], rough=0.3, noise=0.02, scale=scale)


def rivet_pop(r=R):
    """a rivet head shearing off like a gunshot + a ricochet whine"""
    d = 0.9
    t = tt(d)
    nz = r.standard_normal(len(t))
    crack = bp(nz, 500, 12000, 2) * np.exp(-t / 0.006) * 2.5
    crack[: ns(0.0005)] += 2.0
    boom = np.sin(phase(70 * (1 + 0.8 * np.exp(-t / 0.01)))) * np.exp(-t / 0.08) * 1.4
    ping = modal(d, [(r.uniform(2600, 3400), 0.5, 0.18), (r.uniform(5200, 6400), 0.25, 0.08)], r)
    ric = np.sin(phase(np.interp(t, [0, 0.12, 0.6], [4200, 3000, 1400]))) * np.clip((t - 0.06) / 0.02, 0, 1) * np.exp(-np.maximum(t - 0.06, 0) / 0.25) * 0.25
    return fades(crack + boom + ping + ric, 0, 0.1)


def tear(dur, r=R):
    """the tank splitting: a rising steel shriek, a rattle of rivets, a hull boom"""
    n = ns(dur)
    t = np.arange(n) / SR
    c = G.creak(dur, r, 30, 120, METAL_HI, [(0, 0.2), (0.3, 1), (0.8, 0.8), (1, 0)], rough=0.35, noise=0.06)
    rat = G.rattle(dur, r, 60, np.exp(-t / (dur * 0.6)), heavy=True) * 0.8
    boom = np.sin(phase(38 * (1 + 0.6 * np.exp(-t / 0.05)))) * np.exp(-t / 0.7) * 3.0 + lp(r.standard_normal(n), 150, 2) * np.exp(-t / 0.4) * 2.0
    return fades(c + rat + boom, 0, 0.3)


def bend(dur, r=R):
    """the elevated's girders bending: long low groan + high screech + rattling car"""
    t = tt(dur)
    y = groan(dur, r, 1.6) * 1.2 + G.creak(dur, r, 60, 40, METAL_HI, [(0, 0), (0.2, 1), (0.7, 0.6), (1, 0)], rough=0.2, noise=0.03, scale=0.8) * 0.7
    y += G.rattle(dur, r, 45, np.exp(-t / 0.6), heavy=True) * 0.7
    return y


def squelch(r=R):
    """a boot pulled from setting molasses: suction rising + a fat pop"""
    d = 0.7
    t = tt(d)
    nz = r.standard_normal(len(t))
    fc = np.interp(t, [0, 0.5, 0.55, d], [180, 520, 900, 300])
    y = reson(nz * np.clip(t / 0.1, 0, 1), 300, 3) * 0.3
    y = shape(nz, lambda TT, FF: np.exp(-0.5 * (np.log2(np.maximum(FF[:, None], 20) / np.interp(TT, t, fc)[None, :]) / 0.5) ** 2), 512, 128) * 0.9
    y *= np.clip(t / 0.15, 0, 1) * np.exp(-np.maximum(t - 0.5, 0) / 0.05)
    pop = gloop(r, 1.2)
    G._place_mono(y, pop * 0.9, 0.5)
    return y


def ding(r=R):
    y = modal(1.6, [(2637, 1.0, 0.9), (2637 * 2.76, 0.3, 0.25), (3951, 0.4, 0.6)], r)
    return fades(y, 0.0005, 0.1) * 0.6


def hum(dur, f0=120, r=R):
    t = tt(dur)
    y = sum(np.sin(TAU * f0 * k * t) / k for k in (1, 2, 3, 5)) * 0.2 + lp(r.standard_normal(len(t)), 600) * 0.05
    return fades(y, 0.05, 0.05)


def pour(dur, r=R):
    n = ns(dur)
    t = np.arange(n) / SR
    y = bp(colored(n, r, 1.0), 180, 900, 1) * 0.7 * (0.8 + 0.2 * smooth_noise(n, r, 3))
    y += G.bubbles(dur, r, 14, 140, 420, (0.03, 0.08), rise=(1, 3)) * 0.8
    return fades(y, 0.08, 0.15)


def scribble(dur, r=R, speed=7.0):
    n = ns(dur)
    t = np.arange(n) / SR
    m = 0.5 + 0.5 * np.sin(TAU * speed * t + 2 * smooth_noise(n, r, 4))
    return fades(bp(r.standard_normal(n), 1800, 7000, 1) * m ** 2 * 0.5, 0.01, 0.03)


def sniff(r=R):
    d = 0.5
    t = tt(d)
    y = np.zeros(len(t))
    for a in (0.0, 0.2):
        e = np.clip((t - a) / 0.12, 0, 1) * np.exp(-np.maximum(t - a - 0.12, 0) / 0.03) * (t >= a)
        y += bp(r.standard_normal(len(t)), 1500, 6000, 1) * e
    return y * 0.5


def whoosh(d=0.6, r=R):
    return G.whoosh(d, r, peak=d * 0.45, f_lo=300, f_hi=2400, width=0.8, tail=0.18, air=0.2)


def coins(r=R):
    y = np.zeros(ns(0.6))
    for i in range(8):
        G._place_mono(y, G.clink(r, None, 0.15), r.uniform(0, 0.35))
    return y


def murmur(dur, r=R, voices=6, gain=1.0):
    out = np.zeros((2, ns(dur)))
    for v in range(voices):
        b = G.babble(dur, r, r.uniform(100, 220), r.uniform(0.9, 1.15), rate=r.uniform(3.5, 5), active=0.6)
        out += pan(lp(b, 2500), r.uniform(-0.8, 0.8))
    return out * gain


# ================================================================ SFX event table
def build_sfx():
    r = R
    # ---- 1 hook: the wave, a horse, people running, the flash ----
    cue(0.0, "wave roar (hook)", 0, roar(5.9, 1.0), wide=True)
    gallop(F(117) - 0.1, FLASH, 2.4, r, -4, 0.2)
    run_steps(0.2, FLASH, 5, r, -10)
    for k, (t0, p) in enumerate([(1.4, -0.4), (2.6, 0.5), (4.3, -0.2)]):
        cue(t0, "whoa", -6, G.whoa(r), p)
    for t0 in (0.6, 1.9, 3.3, 4.6):
        cue(t0, "gloop", -4, gloop(r, 1.4), r.uniform(-0.5, 0.5))
    cue(FLASH - 0.32, "flash whoosh", -3, whoosh(0.7))
    # ---- 2 harbour, the tank, a train on the elevated ----
    cue(T[2], "harbour breeze", -14, G.breeze(T[3] - T[2] + 0.5, r, 0.6, 0.2, 700))
    cue(T[2] + 0.8, "ship horn", -12, ship_horn(r), -0.5)
    for t0 in (T[2] + 0.3, T[2] + 2.6, T[2] + 4.1):
        cue(t0, "gull", -14, gull(r), r.uniform(-0.8, 0.8))
    cue(T[2] + 0.3, "elevated train", -9, train(T[3] - T[2] - 0.2, r))
    # ---- 3 leaks into buckets ----
    xs = [-2.7, -0.3, 2.3]
    for i, _x in enumerate(xs):
        per = 0.9 + 0.3 * hh(i, 2)
        k = 0
        while True:
            tl = k * per - hh(i, 3) * per
            k += 1
            if tl < T[3]:
                continue
            if tl > T[4]:
                break
            cue(tl, "drip in pail", -6 if i == 1 else -12, plip(r), (i - 1) * 0.5)
    cue(F(402), "pail filling glug", -12, pour(T[4] - F(402), r))
    # ---- 4 the company's fix: brush swishes, a seam drip ----
    t0 = F(480)
    while t0 < F(537):
        cue(t0, "brush stroke", -12, brush(0.9, r, 0.4, swish=True), r.uniform(-0.4, 0.4))
        t0 += 0.45
    cue(F(537), "street breeze", -16, G.breeze(T[5] - F(537), r, 0.5))
    # ---- 5 January: wind, snow steps, the thermometer shoots up ----
    cue(T[5] - 0.2, "winter wind", -10, G.breeze(T[6] - T[5] + 0.4, r, 1.0, 0.35, 1200))
    snow_steps(T[5], F(634), 1.6, r, -14, 0.3)
    cue(F(637), "thermometer slide whistle", -6, slide_whistle(F(637), 0.75, 520, 1500, r))
    # ---- 6 the tank groans, rivets pop ----
    cue(T[6], "tank groan", -1, groan(2.4, r))
    cue(T[6] + 1.6, "tank groan 2", -3, groan(1.8, r, 0.85))
    for t0 in RIVETS:
        cue(t0, "rivet pop", -2, rivet_pop(r), r.uniform(-0.4, 0.4))
    # ---- 7 lunch, then the split ----
    cue(T[7], "lunch chatter", -16, murmur(F(794) - T[7], r, 3))
    cue(F(785), "sandwich crunch", -14, bp(r.standard_normal(ns(0.15)), 1500, 8000, 1) * np.exp(-tt(0.15) / 0.04))
    cue(F(794), "gasp", -10, G.oof(r, "oh"), -0.3)
    cue(SPLIT - 0.05, "tank tears open", 2, tear(2.6, r), wide=True)
    cue(SPLIT, "molasses burst splash", -1, lp(G.splash_big(r), 1800), wide=True)
    cue(SPLIT + 0.3, "wave roar", -1, roar(T[9] - SPLIT - 0.1, 1.0), wide=True)
    # ---- 8 the wave runs, the elevated bends ----
    run_steps(T[8], F(970), 6, r, -9)
    for t0, p in [(T[8] + 0.3, 0.3), (T[8] + 1.4, -0.5), (T[8] + 2.2, 0.6)]:
        cue(t0, "whoa", -7, G.whoa(r), p)
    gallop(F(899), F(970), 2.4, r, -6, -0.2)
    cue(F(899) - 0.3, "cut whoosh", -8, whoosh(0.6))
    cue(BENT - 0.15, "girders bend", 1, bend(2.2, r), wide=True)
    cue(BENT, "train car lurch", -4, G.rattle(1.0, r, 50, np.exp(-tt(1.0) / 0.4), heavy=True))
    # ---- 9 golden: the sheet bubbles, rescuers stuck ----
    cue(T[9], "settling bubbles", -12, G.bubbles(T[10] - T[9], r, 3, 60, 260, (0.05, 0.12), rise=(0.5, 2)))
    cue(T[9] + 0.6, "gull far", -18, gull(r), 0.7)
    for t0 in (F(1131) + 0.1, F(1131) + 1.5, F(1131) + 3.0, F(1131) + 4.2):
        cue(t0, "squelch", -6, squelch(r), r.uniform(-0.4, 0.4))
    # ---- 10 kitchen ----
    cue(T[10], "fridge hum", -24, hum(T[11] - T[10], 60))
    cue(T[10] + 0.2, "microwave hum", -16, hum(DING - T[10] - 0.2, 120), 0.4)
    cue(DING, "microwave ding", -6, ding(r), 0.4)
    cue(POUR[0], "honey pour", -8, pour(POUR[1] - POUR[0], r))
    cue(COLD + 1.1, "clock tick", -14, np.concatenate([np.r_[modal(0.05, [(3200, 1, 0.01)], r), np.zeros(ns(0.45))]] * 3))
    # ---- 11-12 sunset, then quiet ----
    cue(T[11], "evening wind", -16, G.breeze(T[13] - T[11], r, 0.6, 0.15, 600))
    for t0 in (T[11] + 1.2, F(1484) - 0.1, F(1484) + 1.6):
        cue(t0, "squelch (glue)", -8, squelch(r), r.uniform(-0.4, 0.4))
    # ---- 13 courthouse ----
    cue(T[13], "plaza murmur", -14, murmur(F(1656) - T[13], r, 6))
    cue(BAGS, "coins in sacks", -8, coins(r))
    cue(F(1640), "coins in sacks", -10, coins(r))
    cue(F(1656), "flag flutter", -12, G.flag_flutter(T[14] - F(1656), r))
    # ---- 14 engineer ----
    cue(T[14], "street ambience", -18, G.breeze(T[15] - T[14], r, 0.4))
    cue(CLIP0 + 0.1, "pencil sums", -10, scribble(1.1, r, 8))
    for i in range(6):
        cue(CLIP0 + (0.47 + 0.03 * i) * 50 / FPS, "check tick", -11, scribble(0.09, r, 20))
    cue(SIGN[0], "signature", -8, scribble(SIGN[1] - SIGN[0] + 0.1, r, 11))
    # ---- 15 summer ----
    cue(T[15], "birds", -14, G.bird_chirps(T[16] - T[15], r, 0.7))
    cue(T[15], "summer street", -20, murmur(T[16] - T[15], r, 4))
    for i in range(6):
        k = 0
        while True:
            ts = (k - hh(120 + i)) / 0.6
            k += 1
            if ts < T[15]:
                continue
            if ts > F(1860):
                break
            cue(ts, "sniff", -13, sniff(r), r.uniform(-0.6, 0.6))
    cue(F(1862), "sniff (close)", -8, sniff(r), 0.0)
    # ---- 16 callback: winter, the drop ----
    cue(T[16] - 0.2, "winter wind", -14, G.breeze(DUR - T[16] + 0.2, r, 0.8, 0.3, 1000))
    cue(F(2008), "drop stretches", -16, G.creak(1.0, r, 40, 22, [(300, 20, 1), (520, 24, 0.6)], [(0, 0), (0.3, 1), (1, 0.6)], 0.1, 0.0))
    cue(PLOP, "plop", 0, gloop(r, 1.8) + 0.5 * G.bubbles(0.5, r, 40, 120, 500, (0.02, 0.05)))
    cue(CRANE - 0.2, "crane whoosh", -10, whoosh(0.9))


# ================================================================ score
BEAT_RAG = 60 / 112


class Band:
    def __init__(self):
        self.buf = np.zeros((2, N))
        self.r = rng(7)

    def add(self, t, y, gain=1.0, p=0.0):
        if t < 0 or t >= DUR:
            return
        place(self.buf, pan(y, p) if np.ndim(y) == 1 else y, t, gain)


def chord(name):
    return {"F": [53, 57, 60], "C7": [48, 52, 55, 58], "Bb": [46, 50, 53], "Dm": [50, 53, 57], "Gm": [55, 58, 62], "A7": [45, 49, 52, 55],
            "C": [48, 52, 55], "Fm": [53, 56, 60], "G7": [43, 47, 50, 53]}[name]


ROOT = {"F": 41, "C7": 36, "Bb": 34, "Dm": 38, "Gm": 43, "A7": 33, "C": 36, "Fm": 41, "G7": 31}
FIFTH = {"F": 36, "C7": 43, "Bb": 41, "Dm": 45, "Gm": 38, "A7": 40, "C": 43, "Fm": 36, "G7": 38}

# our own ragtime theme (F major), 8 bars: (beat, midi, beats)
THEME = [
    [(0, 72, .5), (.5, 69, .5), (1, 65, .5), (1.5, 69, .5), (2, 72, 1), (3, 74, .5), (3.5, 72, .5)],
    [(0, 69, 1.5), (1.5, 67, .5), (2, 69, .5), (2.5, 70, .5), (3, 72, 1)],
    [(0, 70, .5), (.5, 67, .5), (1, 64, .5), (1.5, 67, .5), (2, 70, 1), (3, 72, .5), (3.5, 70, .5)],
    [(0, 69, 1), (1, 65, 1), (2, 60, 1.5)],
    [(0, 72, .5), (.5, 69, .5), (1, 65, .5), (1.5, 69, .5), (2, 72, 1), (3, 77, .5), (3.5, 76, .5)],
    [(0, 74, 1.5), (1.5, 72, .5), (2, 70, .5), (2.5, 69, .5), (3, 70, 1)],
    [(0, 67, .5), (.5, 69, .5), (1, 70, .5), (1.5, 72, .5), (2, 74, .5), (2.5, 72, .5), (3, 67, 1)],
    [(0, 65, 1), (1, 72, .5), (1.5, 65, .5), (2, 65, 1.5)],
]
THEME_CH = ["F", "F", "C7", "F", "F", "Bb", "C7", "F"]


def rag_bars(b, t0, bars, beat=BEAT_RAG, mel=True, vel=0.6, tempo_fn=None):
    """oompah: tuba roots on 1 + 3, plucked chords on 2 + 4, glock theme; tempo_fn(beat index) -> time"""
    tm = tempo_fn or (lambda k: t0 + k * beat)
    for bi, bar in enumerate(bars):
        ch = THEME_CH[bar % 8]
        k0 = bi * 4
        for k, root in ((0, ROOT[ch]), (2, FIFTH[ch])):
            d = (tm(k0 + k + 1) - tm(k0 + k)) * 0.85
            b.add(tm(k0 + k), brass(m2f(root), d, vel * 0.9, b.r, "tuba"), 0.55, -0.1)
        for k in (1, 3):
            d = (tm(k0 + k + 1) - tm(k0 + k)) * 0.9
            for m in chord(ch):
                b.add(tm(k0 + k), pluck(m2f(m + 12), vel * 0.5, b.r, d + 0.3, 0.6), 0.28, 0.25)
            b.add(tm(k0 + k), brush(vel * 0.6, b.r, 0.2), 0.3, 0.1)
        if mel:
            for bt, m, dl in THEME[bar % 8]:
                ta = tm(k0 + bt)
                dd = tm(k0 + bt + dl) - ta
                b.add(ta, glock(m2f(m + 12), vel * 0.7, b.r, max(0.5, dd + 0.6)), 0.38, 0.2)
                b.add(ta, pluck(m2f(m), vel * 0.5, b.r, dd + 0.2, 0.8), 0.25, -0.2)


def build_music():
    b = Band()
    r = b.r
    # ---- A hook (0 - 5.53): driving D minor, tuba 8ths, horn stabs, snare roll to a crash on the flash ----
    bt = 60 / 132
    k = 0
    while k * bt / 2 < FLASH - 0.05:
        t = k * bt / 2
        m = [38, 38, 41, 38, 45, 38, 41, 43][k % 8]
        b.add(t, brass(m2f(m), bt * 0.42, 0.7, r, "tuba"), 0.6)
        if k % 8 == 0:
            for mm in (62, 65, 69):
                b.add(t, brass(m2f(mm), bt * 0.6, 0.75, r, "stab"), 0.22, 0.2)
            b.add(t, timpani(m2f(38), 0.8, r), 0.5)
        k += 1
    for tm, v in snare_roll(3.4, FLASH - 0.02, 0.2, 0.9, r):
        b.add(tm, snare(v, r, buzz=True), 0.35, 0.1)
    b.add(FLASH, cymbal(0.9, r), 0.5)
    for mm in (50, 57, 62, 65, 69):
        b.add(FLASH, brass(m2f(mm), 0.9, 0.85, r, "stab"), 0.25)
    b.add(FLASH, timpani(m2f(38), 1.0, r), 0.6)
    # ---- B setting -> leaks -> painting (5.9 - 19.1): ragtime theme ----
    t0 = 5.95
    nb = int((T[5] - 0.2 - t0) / (4 * BEAT_RAG))
    rag_bars(b, t0, list(range(nb)), vel=0.6)
    # "brown": comic tuba fall
    b.add(F(519), brass(m2f(41), 0.9, 0.8, r, "tuba", fall=-7), 0.7)
    # ---- C January (19.17 - 22.27): music box, then a rising vibes run on "suddenly warmed up" ----
    for i, m in enumerate([77, 72, 69, 65, 72, 69, 65, 60]):
        b.add(T[5] + 0.1 + i * 0.27, musicbox(m2f(m), 0.6, r), 0.35, 0.3)
    for i, m in enumerate([65, 69, 72, 77, 81, 84, 89]):
        b.add(F(636) + i * 0.07, vibes(m2f(m), 0.5, r, 1.2), 0.3, -0.2 + 0.07 * i)
    b.add(F(645), triangle(0.6, r), 0.35)
    # ---- D groan (22.27 - 25.6): drone + quickening heartbeat; lunch ditty; silence; the split hit ----
    b.add(T[6], pad([m2f(38), m2f(45), m2f(50)], T[7] - T[6] - 0.6, 0.6, r, att=0.8, rel=0.6, warm=500), 0.6)
    tm, gap = T[6] + 0.1, 0.9
    while tm < T[7] - 0.4:
        b.add(tm, timpani(m2f(38), 0.55, r, 1.2), 0.45)
        tm += gap
        gap = max(0.38, gap * 0.86)
    for i, (dt, m) in enumerate([(0, 72), (0.27, 76), (0.54, 79), (0.81, 76), (1.08, 77), (1.35, 74), (1.62, 72)]):
        b.add(T[7] + 0.15 + dt, glock(m2f(m + 12), 0.5, r, 0.7), 0.3, 0.3)
    b.add(T[7] + 0.15, pluck(m2f(53), 0.5, r, 0.6), 0.3)
    b.add(T[7] + 0.69, pluck(m2f(48), 0.5, r, 0.6), 0.3)
    b.add(T[7] + 1.23, pluck(m2f(53), 0.5, r, 0.6), 0.3)
    b.add(SPLIT, cymbal(1.0, r, 3.0), 0.55)
    b.add(SPLIT, timpani(m2f(33), 1.0, r, 3.0), 0.8)
    for mm in (50, 53, 57, 62):
        b.add(SPLIT, brass(m2f(mm), 1.1, 0.9, r, "stab"), 0.28)
    # ---- E the wave (28.2 - 34.4): chase at 150 bpm, the bend hit ----
    bt = 0.4
    t = T[8] - 0.05
    k = 0
    while t < T[9] - 0.25:
        m = [38, 45, 38, 45, 41, 45, 43, 45][k % 8]
        b.add(t, brass(m2f(m), bt * 0.4, 0.75, r, "tuba"), 0.55)
        if k % 2 == 0:
            b.add(t + bt / 2, snare(0.45, r), 0.25, 0.1)
        b.add(t + bt * 0.25, snare(0.2, r, snappy=0.6), 0.15, 0.1)
        b.add(t + bt * 0.75, snare(0.25, r, snappy=0.6), 0.15, 0.1)
        if k % 4 == 3:
            for mm in (62, 65, 69):
                b.add(t + bt / 2, brass(m2f(mm), bt * 0.35, 0.65, r, "stab"), 0.18, 0.25)
        t += bt
        k += 1
    b.add(BENT, cymbal(1.0, r, 2.4), 0.5)
    b.add(BENT, timpani(m2f(34), 1.0, r), 0.7)
    for mm in (46, 50, 53, 58):
        b.add(BENT, brass(m2f(mm), 0.8, 0.9, r, "stab"), 0.28)
    for i, mm in enumerate([62, 60, 58, 57]):
        b.add(T[9] - 1.6 + i * 0.32, brass(m2f(mm), 0.3, 0.6, r, "horn"), 0.25)
    # ---- F golden (34.53 - 40.33): warm pad, then minor on "Unluckily" + a low tuba note ----
    b.add(T[9], pad([m2f(53), m2f(57), m2f(60), m2f(65)], F(1131) - T[9], 0.5, r, att=0.6, rel=0.5), 0.55)
    for i, m in enumerate([77, 72, 74, 69]):
        b.add(T[9] + 0.5 + i * 0.75, glock(m2f(m + 12), 0.35, r, 1.4), 0.22, 0.3)
    b.add(F(1131) - 0.05, pad([m2f(53), m2f(56), m2f(60), m2f(65)], T[10] - F(1131), 0.5, r, att=0.3, rel=0.6), 0.5)
    b.add(F(1131) - 0.05, brass(m2f(29), 1.4, 0.8, r, "tuba", fall=-2), 0.6)
    # ---- G kitchen (40.33 - 47.2): cheeky vibes + pluck in C, then one stuck held note ----
    bt = 60 / 104
    t = T[10] + 0.2
    k = 0
    seq = [72, 76, 79, 76, 77, 74, 71, 74, 72, 76, 79, 84, 83, 79, 77, 74]
    while t < COLD - 0.15:
        b.add(t, vibes(m2f(seq[k % 16]), 0.5, r, 0.9, damp=bt * 0.9), 0.3, 0.2)
        if k % 2 == 0:
            b.add(t, pluck(m2f([36, 43, 41, 43][(k // 2) % 4]), 0.6, r, bt * 1.6), 0.4, -0.2)
        t += bt / 2
        k += 1
    b.add(COLD, vibes(m2f(79), 0.5, r, 1.8 + 0), 0.3, 0.2)
    # ---- H sunset, "died" (47.2 - 53.0): quiet minor pad, nothing else ----
    b.add(T[11], pad([m2f(50), m2f(53), m2f(57)], T[12] - T[11], 0.45, r, att=1.0, rel=0.8, warm=700), 0.5)
    b.add(T[12], pad([m2f(46), m2f(53), m2f(57), m2f(62)], T[13] - T[12] + 0.2, 0.35, r, att=0.8, rel=1.0, warm=600), 0.5)
    # ---- I court -> rules -> engineer (53.0 - 60.27): soft horn chorale, a glock flourish on the signature ----
    prog = [("Bb", 1.6), ("F", 1.6), ("Gm", 1.6), ("C", 1.6), ("F", 1.4)]
    t = T[13] + 0.1
    for ch, d in prog:
        for m in chord(ch):
            b.add(t, brass(m2f(m + 12), d * 0.95, 0.45, r, "soft"), 0.25, 0.0)
        b.add(t, brass(m2f(ROOT[ch]), d * 0.95, 0.5, r, "tuba"), 0.4)
        t += d
    for i, m in enumerate([72, 76, 79, 84, 88]):
        b.add(SIGN[0] + i * 0.08, glock(m2f(m + 12), 0.5, r, 1.2), 0.3, 0.3)
    # ---- J summer (60.27 - 63.73): a light waltz ----
    bt = 60 / 132
    t = T[15] + 0.1
    k = 0
    mel = [76, 79, 84, 83, 79, 76, 77, 81, 86, 84, 81, 77]
    while t < T[16] - 0.2:
        if k % 3 == 0:
            b.add(t, pluck(m2f([48, 53][(k // 3) % 2]), 0.6, r, bt * 2), 0.4, -0.2)
        else:
            for m in ([64, 67, 72] if (k // 3) % 2 == 0 else [65, 69, 72]):
                b.add(t, pluck(m2f(m), 0.35, r, bt), 0.2, 0.2)
        b.add(t, glock(m2f(mel[k % 12] + 12), 0.4, r, 0.8), 0.22, 0.25)
        t += bt
        k += 1
    # ---- K callback (63.73 - ): the ragtime theme returns and slows to a stop on "slow", then the button ----
    def rit(kb):
        # beat k -> time: the beat stretches from 0.536 s to ~2 s
        tt_ = T[16] + 0.15
        for j in range(int(kb)):
            tt_ += BEAT_RAG * (1 + 0.012 * j ** 1.9)
        frac = kb - int(kb)
        return tt_ + frac * BEAT_RAG * (1 + 0.012 * int(kb) ** 1.9)
    nbeat = 0
    while rit(nbeat) < F(2022):
        nbeat += 1
    bars = max(1, nbeat // 4)
    rag_bars(b, 0, list(range(bars)), vel=0.55, tempo_fn=rit)
    b.add(F(2023), brass(m2f(41), 1.6, 0.6, r, "tuba"), 0.55)
    for m in chord("F"):
        b.add(F(2023), pluck(m2f(m + 12), 0.4, r, 1.6), 0.25)
    b.add(PLOP + 0.12, brass(m2f(29), 0.5, 0.8, r, "tuba", fall=-3), 0.6)
    b.add(PLOP + 0.5, glock(m2f(84 + 12), 0.5, r, 1.6), 0.3, 0.2)
    # reverb
    ir = make_ir(1.5, 3, pre=0.015, hf=1.2)
    wet = convolve_st(b.buf, ir)
    return b.buf + 0.22 * wet


# ================================================================ mix
def words():
    return json.load(open(os.path.join(SHORT, "voice", "words.json")))


def duck_curve(ws, depth_db=-3.0):
    g = np.zeros(N)
    for w in ws:
        a, e = ns(max(0, w["s"] - 0.08)), ns(min(DUR, w["e"] + 0.12))
        g[a:e] = 1
    g = ndimage.uniform_filter1d(g, ns(0.25))
    return dbg(depth_db * g)


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    """4x-oversampled peak detection, look-ahead min filter, one-pole release, smoothing that never overshoots"""
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 4 * La + 1, mode="nearest")
    idx = np.flatnonzero(g1 < 1.0)
    g2 = g1.copy()
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR))
        gap = ns(rel * 8)
        brk = np.flatnonzero(np.diff(idx) > gap)
        for a_, b_ in zip(np.concatenate([[idx[0]], idx[brk + 1]]), np.concatenate([idx[brk], [idx[-1]]])):
            e = min(n, b_ + gap)
            g = 1.0
            seg = g1[a_:e]
            out = np.empty(len(seg))
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                out[k] = g
            g2[a_:e] = out
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), g1 + 0 * g2)
    return x * np.minimum(g3, 1.0)[None, :]


def section_gain(x, voice, targets, smooth_s=0.3):
    """gain curve that puts stem x at voice + target LU in every shot (crossfaded at the shot changes)"""
    sh = sorted(SHOT.items(), key=lambda kv: kv[1])
    pts_t, pts_g = [], []
    for (i, a), (_j, b) in zip(sh, sh[1:]):
        a_, b_ = ns(a / FPS), ns(b / FPS)
        seg, vs = x[:, a_:b_], voice[:, a_:b_]
        Ls = integrated(seg) if np.abs(seg).max() > 1e-7 else -90
        Lv = integrated(vs) if np.abs(vs).max() > 1e-7 else -16
        gdb = float(np.clip(Lv + targets[i] - Ls, -60, 40)) if Ls > -80 else 0.0
        pts_t += [a / FPS + 0.01, b / FPS - 0.01]; pts_g += [gdb, gdb]
    g = np.interp(np.arange(N) / SR, pts_t, pts_g)
    g = ndimage.uniform_filter1d(g, ns(smooth_s))
    return dbg(g)


def main():
    vx, sr = read_wav(os.path.join(SHORT, "voice", "voice.wav"))
    assert sr == SR
    v = np.zeros(N)
    vm = vx.mean(0) if vx.ndim > 1 else vx
    v[: min(N, len(vm))] = vm[:N]
    voice = st(v)
    print("building sfx...", flush=True)
    build_sfx()
    print("building music...", flush=True)
    mus = build_music()
    Lv = integrated(voice)
    # per-shot targets, LU relative to the voice in that shot. House baselines: music -13, sfx -6;
    # standard mix: music +3 dB -> -10, sfx -6 dB -> -12; story shading on top (quiet for "died", loud for the wave)
    MUS_T = {1: -9, 2: -10, 3: -10, 4: -10, 5: -11, 6: -11, 7: -9, 8: -8, 9: -11, 10: -11, 11: -13, 12: -14, 13: -10, 14: -10, 15: -10, 16: -9}
    SFX_T = {1: -7, 2: -13, 3: -12, 4: -13, 5: -13, 6: -9, 7: -8, 8: -7, 9: -13, 10: -12, 11: -14, 12: -18, 13: -13, 14: -13, 15: -14, 16: -12}
    mus = mus * section_gain(mus, voice, MUS_T)[None, :]
    mus *= duck_curve(words())[None, :]
    sfx_g = sfx * section_gain(sfx, voice, SFX_T)[None, :]
    mix = voice + mus + sfx_g
    # master to -15 LUFS integrated, limiter at -1.2 dBTP
    g = dbg(-15.0 - integrated(mix))
    mix *= g
    mix = limiter(mix, -1.2)
    k = ns(0.3)
    mix[:, -k:] *= np.linspace(1, 0, k)[None, :]
    L = integrated(mix)
    tp = true_peak(mix)
    out = HERE
    write_wav(os.path.join(out, "mix.wav"), mix)
    write_wav(os.path.join(out, "stem_voice.wav"), voice * g)
    write_wav(os.path.join(out, "stem_music.wav"), mus * g)
    write_wav(os.path.join(out, "stem_sfx.wav"), sfx_g * g)
    with open(os.path.join(out, "cues.md"), "w") as fh:
        fh.write(f"# Cues: The Great Molasses Flood\n\nmix: {L:.1f} LUFS integrated, true peak {tp:.2f} dBTP, {mix.shape[1] / SR:.3f} s\n\n")
        fh.write(f"voice {Lv:.1f} LUFS (unchanged), music set to voice -10 LU then -3 dB under words, sfx at voice -12 LU\n\n| t (s) | frame | cue | gain dB |\n|---|---|---|---|\n")
        for t, name, gdb in sorted(CUES):
            fh.write(f"| {t:6.2f} | {int(round(t * FPS))} | {name} | {gdb:+.0f} |\n")
    print(f"mix {L:.2f} LUFS, TP {tp:.2f} dBTP, {mix.shape[1] / SR:.3f} s, cues {len(CUES)}")


if __name__ == "__main__":
    main()
