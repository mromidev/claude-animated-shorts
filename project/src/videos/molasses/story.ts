// Timeline of "The Great Molasses Flood": shots timed to the voice words (shorts/molasses/voice/words.json),
// story state (tank paint / leaks / rivets / split, the flood heightfield, the elevated railway bend, seasons) and the
// camera grammar of the bridge short: continuous slow push-ins, symmetric smootherstep glides of 18-40 f, hard cuts
// on big reframes, 7-frame flip kicks on impacts, no hand-held float.
export const FPS = 30;
export const TOTAL = 2085;
export const D0 = 0; // street level (m)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- places ----------------
// Commercial Street runs along x (cobbles |z| < 7, sidewalks to |z| = 10). North row fronts at z = +10, the tank yard
// south of the street, the harbour quay at z = -58. The Atlantic Avenue elevated runs over the street at z = -4.
export const TANK: V3 = [0, 0, -32];
export const TANK_R = 13.7, TANK_H = 15; // 90 ft wide, 50 ft tall
export const EL_Z = -4, EL_Y = 7.2; // elevated railway: track centre line z, deck top y
export const EL_COLS = Array.from({ length: 26 }, (_, k) => -150 + 6 + k * 12); // column x positions
export const QUAY_Z = -58;
export const KITCHEN: V3 = [600, 0, 0]; // modern kitchen set (honey), far away
export const COURT: V3 = [-600, 0, 0]; // courthouse steps
export const THERMO: V3 = [6, 2.25, 9.94]; // street thermometer on a north-row wall

// ---------------- story physics ----------------
/** film times (s) of the beats, from words.json */
export const W = {
  split: 817 / FPS, // "split"
  bent: 976 / FPS,  // "bent"
};
/** rivets popping on "popping like gunshots" (film seconds) */
export const RIVETS = [726, 732, 737, 742, 748, 754].map((f) => f / FPS);

/** flood front radius (m from the tank centre) at ts seconds after the split (cartoon pace, ~15 m/s early) */
export const frontR = (ts: number) => (ts <= 0 ? TANK_R : TANK_R + (15 * ts) / (1 + 0.045 * ts));
/** crest height above the sheet behind it: the "25 ft" wave holds while it runs, then flattens */
export const crestH = (ts: number) => (ts <= 0 ? 0 : 7.4 * smooth(ts / 0.5) * (1 - 0.75 * smooth((ts - 7) / 7)));
/** sheet depth behind the crest: deep near the tank early, ~1 m everywhere once settled */
export const sheetD = (ts: number, r: number) => {
  const near = Math.max(0, 1 - (r - TANK_R) / 30);
  return 0.42 + (1.0 + 5 * near) * Math.exp(-ts / 3);
};
/** molasses still inside the tank (fill height) */
export const tankFill = (ts: number) => (ts <= 0 ? TANK_H - 1.2 : (TANK_H - 1.2) * (1 - smooth(ts / 1.2)) + 1.0);
export type Flood = { on: boolean; ts: number; set: number };
/** molasses surface height at (x, z), 0 = no molasses (world.ts writes the heightfield from this) */
export const floodH = (fl: Flood, x: number, z: number) => {
  if (!fl.on) return 0;
  const r = Math.hypot(x - TANK[0], z - TANK[2]);
  if (r < TANK_R - 0.3 && fl.ts < 1.5) return Math.max(0, tankFill(fl.ts) * (1 - smooth(fl.ts / 1.2)));
  const R = frontR(fl.ts), H = crestH(fl.ts), d = r - R;
  if (d > 5) return 0;
  const sheet = sheetD(fl.ts, r);
  // rolling wave: a long back, a rounded face ~2.5 m deep in front of the crest line
  const crest = d < 0 ? H * Math.exp(-((d / 4.2) ** 2)) : H * Math.exp(-((d / 2.4) ** 2));
  const edge = d < 0 ? 1 : Math.max(0, 1 - d / 1.2);
  // gentle surface swell so the sheet is not dead flat (slower when set)
  const sw = 0.06 * (1 - fl.set) * Math.sin(0.35 * x + 1.7 * fl.ts) * Math.sin(0.3 * z - 1.1 * fl.ts);
  return Math.max(0, (sheet + sw) * edge + crest);
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Season = "winter" | "summer";
export type Set = "street" | "kitchen" | "court";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: Set; season: Season; tau: (t: number) => number; sunAz?: number; sunEl?: number };
// tau = seconds after the split for flood shots (story time), else film time
const afterSplit = (t: number) => t - W.split;
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 166, light: "day", set: "street", season: "winter", tau: (t) => 3.0 + 0.95 * t }, // hook: flash-forward of the wave
  { id: 2, a: 166, b: 352, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 3, a: 352, b: 458, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 4, a: 458, b: 575, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 5, a: 575, b: 668, light: "day", set: "street", season: "winter", tau: (t) => t, sunAz: 60, sunEl: 30 },
  { id: 6, a: 668, b: 768, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 7, a: 768, b: 846, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 8, a: 846, b: 1036, light: "day", set: "street", season: "winter", tau: (t) => 0.75 + 0.55 * (t - 846 / FPS) },
  { id: 9, a: 1036, b: 1210, light: "golden", set: "street", season: "winter", tau: (t) => 40 + afterSplit(t) },
  { id: 10, a: 1210, b: 1416, light: "day", set: "kitchen", season: "winter", tau: (t) => t, sunAz: 120, sunEl: 40 },
  { id: 11, a: 1416, b: 1542, light: "golden", set: "street", season: "winter", tau: (t) => 60 + afterSplit(t), sunEl: 4 },
  { id: 12, a: 1542, b: 1590, light: "golden", set: "street", season: "winter", tau: (t) => 80 + afterSplit(t), sunEl: 2 },
  { id: 13, a: 1590, b: 1704, light: "day", set: "court", season: "winter", tau: (t) => t, sunAz: 110 },
  { id: 14, a: 1704, b: 1808, light: "day", set: "street", season: "winter", tau: (t) => t },
  { id: 15, a: 1808, b: 1912, light: "day", set: "street", season: "summer", tau: (t) => t, sunEl: 58 },
  { id: 16, a: 1912, b: TOTAL, light: "day", set: "street", season: "winter", tau: (t) => 200 + afterSplit(t) },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 5: 8, 9: 8, 10: 8, 11: 8, 12: 10, 13: 10, 15: 8, 16: 8 };
export const FLASH_AT = 166;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- per-shot world state ----------------
export type TankState = {
  shown: boolean; paintH: number; leak: number; split: number; /** seconds after the split (staves fly), <0 intact */
  shake: number; newTank: boolean; fill: number;
};
export type State = { tank: TankState; flood: Flood; bend: number; train: number | null; trainStop: boolean; season: Season };
/** paint line on the tank (m up the wall) during "They painted the tank brown" */
const paintAt = (f: number) => (f < 495 ? 0 : TANK_H * 1.05 * smooth((f - 495) / 60));
export const stateAt = (id: number, f: number): State => {
  const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t);
  const tank: TankState = { shown: true, paintH: 0, leak: 0, split: -1, shake: 0, newTank: false, fill: TANK_H - 1.2 };
  const flood: Flood = { on: false, ts: 0, set: 0 };
  let bend = 0, train: number | null = null, trainStop = false;
  if (id === 1) {
    tank.paintH = 99; tank.leak = 1; tank.split = 9; flood.on = true; flood.ts = tau; bend = 1;
  } else if (id === 2) {
    train = -90 + 9 * (t - 166 / FPS); // a train rolls along the elevated
  } else if (id === 3) {
    tank.leak = 1;
  } else if (id === 4) {
    tank.leak = 1; tank.paintH = paintAt(f);
  } else if (id <= 7) {
    tank.leak = 1; tank.paintH = 99;
    if (id === 6) tank.shake = f >= 670 ? 1 : 0;
    if (id === 7) {
      tank.shake = 1;
      if (f >= 817) { tank.split = afterSplit(t); flood.on = true; flood.ts = afterSplit(t); }
    }
    if (id === 5) train = 40 - 6 * (t - 575 / FPS);
  } else if (id === 8) {
    tank.paintH = 99; tank.leak = 1; tank.split = tau; flood.on = true; flood.ts = tau;
    bend = smooth((f - 972) / 9); train = 9; trainStop = true;
  } else if (id === 9 || id === 11 || id === 12 || id === 16) {
    tank.paintH = 99; tank.leak = 1; tank.split = 30; flood.on = true; flood.ts = 60; bend = 1; train = 9; trainStop = true;
    flood.set = id === 9 ? 0.6 : 1;
  } else if (id === 14) {
    tank.newTank = true; // a new, inspected tank
  } else if (id === 15) {
    tank.shown = false; // the site is a park now
  }
  return { tank, flood, bend, train, trainStop, season: s.season };
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

/** x where the flood front crosses the street centre line (z = 0) */
export const frontX = (ts: number) => Math.sqrt(Math.max(0, frontR(ts) ** 2 - TANK[2] ** 2));
const FX = (id: number, f: number) => frontX(SHOTS[id - 1].tau(T(f)));
/** the horse in the hook gallops ahead of the wave, which slowly gains on it */
export const horseX = (f: number) => FX(1, f) + 7.5 - 0.9 * T(f);

// ---- shot 1: hook ----
const S1a = (f: number) => { const F = FX(1, f); return dolly([F + 22, 2.4, 9.0], [F - 1, 4.4, -1.0], pushK(f, 0, 0.002), { fov: 50 }); };
const S1b = (f: number) => { const F = FX(1, f); return dolly([F + 19, 1.0, 5.6], [F - 1, 7.4, 3.5], pushK(f, 52, 0.0025), { fov: 54, roll: 0.04 }); };
const S1c = (f: number) => { const F = FX(1, f); return dolly([F + 20, 17, 13], [F - 6, 3, -2], pushK(f, 89, 0.002), { fov: 46, roll: -0.03 }); };
const S1d = (f: number) => { const H = horseX(f); return dolly([H + 2.4, 1.5, 7.4], [H - 0.4, 1.7, 0.2], pushK(f, 117, 0.003), { fov: 44, roll: 0.035 }); };
// ---- shot 2: setting (harbour aerial -> low under the tank -> crane up) ----
const S2a = (f: number) => zoom([-46, 30, -98], [2, 5, -22], 44, pushK(f, 162, 0.002));
const S2b = (f: number) => dolly([20, 1.3, 1.0], [0, 8.5, -30], pushK(f, 240, 0.0018), { fov: 52 });
const S2c = (f: number) => dolly([14, 20, -11], [0, 12, -30], pushK(f, 282, 0.002), { fov: 46 });
// ---- shot 3: leaks + buckets ----
const S3a = (f: number) => dolly([3.6, 1.65, -11.2], [-0.4, 1.35, -18.2], pushK(f, 352, 0.0025), { fov: 40 });
const S3b = (f: number) => dolly([0.6, 1.3, -14.6], [-0.2, 1.1, -17.85], pushK(f, 402, 0.003, 0.006, 30), { fov: 42 });
// ---- shot 4: the company's fix ----
const S4a = (f: number) => dolly([7.6, 1.75, -11.4], [4.3, 1.55, -16.5], pushK(f, 458, 0.0025), { fov: 38 });
const S4b = (f: number) => dolly([8.5, 3.0, -8.5], [-0.3, 3.4, -19], pushK(f, 493, 0.002), { fov: 46 });
const S4c = (f: number) => dolly([0.1, 1.65, -14.2], [-0.55, 1.45, -18.2], pushK(f, 537, 0.0025), { fov: 38, roll: -0.03 });
// ---- shot 5: January morning ----
const S5a = (f: number) => zoom([44, 6.5, 4], [6, 6, -16], 46, pushK(f, 571, 0.002));
const S5b = (f: number) => dolly([THERMO[0] + 0.5, THERMO[1] + 0.1, 7.1], [THERMO[0], THERMO[1], THERMO[2]], pushK(f, 634, 0.003, 0.006, 26), { fov: 32 });
// ---- shot 6: groaning tank, rivets ----
const S6a = (f: number) => dolly([9, 1.0, -6.2], [0, 7.5, -30], pushK(f, 668, 0.002), { fov: 52 });
const S6b = (f: number) => dolly([2.4, 5.2, -15.2], [0.4, 5.0, -18.35], pushK(f, 705, 0.002), { fov: 34 });
const S6c = (f: number) => dolly([3.6, 5.5, -14.2], [0.4, 5.0, -18.35], pushK(f, 724, 0.003), { fov: 38, roll: 0.04 });
// ---- shot 7: lunch, split ----
const S7a = (f: number) => dolly([-7.2, 1.35, 1.5], [-10.4, 1.25, -8.3], pushK(f, 768, 0.0025), { fov: 42 });
const S7b = (f: number) => dolly([34, 21, 15], [0, 5, -30], pushK(f, 815, 0.002, 0.005, 20), { fov: 50 });
// ---- shot 8: the wave down the street, the elevated bends ----
const S8a = (f: number) => dolly([66, 1.3, 3.5], [24, 4.6, -1.5], pushK(f, 846, 0.002), { fov: 48 });
const S8b = (f: number) => dolly([62, 0.8, 4.5], [30, 8.5, -1.5], pushK(f, 882, 0.0025), { fov: 52, roll: 0.04 });
const S8c = (f: number) => { const F = FX(8, f); return dolly([F + 16, 15, 12], [F - 4, 3, -2], pushK(f, 899, 0.002), { fov: 48, roll: -0.03 }); };
const S8d = (f: number) => dolly([16, 3.4, 13], [1, 6.2, -4], pushK(f, 970, 0.002, 0.005, 30), { fov: 50 });
// ---- shots 9, 11, 12: golden / dusk on the set flood ----
const S9a = (f: number) => zoom([46, 13, 14], [0, 2, -12], 46, pushK(f, 1030, 0.0018));
const S9b = (f: number) => dolly([31.5, 1.65, 4.2], [27.6, 1.25, -0.6], pushK(f, 1129, 0.0025, 0.005, 30), { fov: 40, roll: 0.035 });
const S11a = (f: number) => zoom([-44, 9, 6], [0, 2.5, -10], 46, pushK(f, 1412, 0.0018));
const S11b = (f: number) => dolly([-23.8, 1.45, 4.4], [-26.6, 1.2, 0.3], pushK(f, 1482, 0.003, 0.006, 26), { fov: 38, roll: -0.035 });
const S12a = (f: number) => zoom([30, 11, 6], [0, 6, -30], 44, pushK(f, 1538, 0.0015));
// ---- shot 10: the kitchen ----
const K = KITCHEN;
const S10a = (f: number) => dolly([K[0] + 0.5, 1.6, K[2] + 4.4], [K[0] - 0.15, 1.2, K[2] - 0.4], pushK(f, 1206, 0.0025), { fov: 40 });
const S10b = (f: number) => dolly([K[0] + 1.9, 1.5, K[2] + 3.1], [K[0] - 0.1, 1.15, K[2] - 0.35], pushK(f, 1275, 0.0025), { fov: 38, roll: 0.03 });
const S10c = (f: number) => dolly([K[0] - 1.3, 1.55, K[2] + 3.0], [K[0] - 0.2, 1.4, K[2] - 0.4], pushK(f, 1352, 0.0025, 0.005, 30), { fov: 40, roll: -0.03 });
// ---- shot 13: the courthouse ----
const C = COURT;
const S13a = (f: number) => zoom([C[0] + 9, 2.2, C[2] + 20], [C[0], 5.5, C[2] - 2], 46, pushK(f, 1586, 0.002));
const S13b = (f: number) => dolly([C[0] + 2.6, 2.4, C[2] + 7.6], [C[0] + 0.3, 2.3, C[2] + 3.2], pushK(f, 1619, 0.0025), { fov: 40 });
const S13c = (f: number) => zoom([C[0] + 2.2, 1.6, C[2] + 10], [C[0] + 8.2, 9.6, C[2] + 2], 34, pushK(f, 1656, 0.0025, 0.005, 30), { roll: 0.04 });
// ---- shot 14: the engineer signs off a new tank ----
const S14a = (f: number) => dolly([5.6, 1.7, -11.6], [3.2, 1.75, -16.3], pushK(f, 1704, 0.0025), { fov: 40 });
const S14b = (f: number) => dolly([3.35, 1.62, -15.25], [3.35, 1.42, -15.92], pushK(f, 1748, 0.002), { fov: 40 });
// ---- shot 15: summer, the sweet smell ----
const S15a = (f: number) => zoom([30, 5, 6], [0, 2.5, -16], 46, pushK(f, 1804, 0.002));
const S15b = (f: number) => dolly([-2.6, 1.7, -2.4], [-4.4, 1.62, -6.2], pushK(f, 1860, 0.0025, 0.005, 28), { fov: 38 });
// ---- shot 16: callback, the bucket in January ----
const S16a = (f: number) => dolly([30.2, 1.7, 5.6], [27.2, 1.6, 1.6], pushK(f, 1908, 0.002), { fov: 40 });
const S16b = (f: number) => dolly([29.2, 1.55, 4.3], [27.45, 1.4, 1.6], pushK(f, 1995, 0.0025, 0.006, 30), { fov: 38 });
const CRANE: V3[] = [[38, 9, 18], [60, 26, 34], [0, 2, -14]];
const S16c = (f: number): Shot => {
  const a = S16b(2046), s = glide((f - 2046) / 39), r = 1 - s, [Cc, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * Cc[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (46 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 52, dur: 26, s: S1b }, // centred on 64 "taller"
    { f: 89, cut: true, s: S1c }, // cut on "tore through Boston"
    { f: 117, cut: true, s: S1d }, // cut on "faster than a galloping horse"
  ],
  2: [
    { f: 162, s: S2a },
    { f: 240, cut: true, s: S2b }, // cut on "five stories"
    { f: 270, dur: 36, s: S2c }, // crane up on "holding"
  ],
  3: [
    { f: 352, s: S3a },
    { f: 402, cut: true, s: S3b }, // cut on "filled"
  ],
  4: [
    { f: 458, s: S4a },
    { f: 493, cut: true, s: S4b }, // cut on "They painted"
    { f: 537, cut: true, s: S4c }, // cut on "leaks"
  ],
  5: [
    { f: 571, s: S5a },
    { f: 634, cut: true, s: S5b }, // cut on "suddenly"
  ],
  6: [
    { f: 668, s: S6a },
    { f: 705, cut: true, s: S6b }, // cut on "rivets"
    { f: 724, dur: 18, s: S6c }, // "popping": pull back a touch with a roll
  ],
  7: [
    { f: 768, s: S7a },
    { f: 815, cut: true, s: S7b }, // cut on "split"
  ],
  8: [
    { f: 846, s: S8a },
    { f: 872, dur: 24, s: S8b }, // centred on 884 "feet high": tilt up the crest
    { f: 899, cut: true, s: S8c }, // cut on "swept": high 3/4 riding with the front
    { f: 970, cut: true, s: S8d }, // cut on "bent"
  ],
  9: [
    { f: 1030, s: S9a },
    { f: 1129, cut: true, s: S9b }, // cut on "Unluckily"
  ],
  10: [
    { f: 1206, s: S10a },
    { f: 1275, cut: true, s: S10b }, // "Warm from the microwave"
    { f: 1352, cut: true, s: S10c }, // "Straight from the fridge"
  ],
  11: [
    { f: 1412, s: S11a },
    { f: 1482, cut: true, s: S11b }, // "glue"
  ],
  12: [{ f: 1538, s: S12a }],
  13: [
    { f: 1586, s: S13a },
    { f: 1619, cut: true, s: S13b }, // "the company had to pay"
    { f: 1656, cut: true, s: S13c }, // "America got stricter rules"
  ],
  14: [
    { f: 1704, s: S14a },
    { f: 1748, cut: true, s: S14b }, // "check the math": the clipboard insert
  ],
  15: [
    { f: 1804, s: S15a },
    { f: 1860, cut: true, s: S15b }, // "sweet"
  ],
  16: [
    { f: 1908, s: S16a },
    { f: 1984, dur: 22, s: S16b }, // centred on 1995 "is famous"
    { f: 2046, cut: true, s: S16c }, // crane out after the drop lands
  ],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [...RIVETS.map((t) => [t, 0.45] as [number, number]), [W.split, 1.4], [W.bent, 1.2], [2038 / FPS, 0.25]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // hook: the wave is the subject, keep it readable
  { f: 117, cInf: 10, focus: (f) => [horseX(f), 1.6, 0] }, // the horse
  { f: 166, cInf: 0 }, // aerial, low tank, crane
  { f: 352, cInf: 11 }, // tank base with buckets (focus = look)
  { f: 402, cInf: 14 }, // bucket CU
  { f: 458, cInf: 12, focus: () => [4.3, 1.62, -16.6] }, // the boss
  { f: 493, cInf: 0 }, // painters wide
  { f: 537, cInf: 13 }, // seam CU
  { f: 571, cInf: 0 }, // January wide
  { f: 634, cInf: 14 }, // thermometer
  { f: 668, cInf: 0 }, // groaning tank wide
  { f: 705, cInf: 12 }, // rivets CU
  { f: 768, cInf: 11, focus: () => [-10.4, 1.3, -8.3] }, // lunch bench
  { f: 815, cInf: 0 }, // split + wave + bend: readable
  { f: 1129, cInf: 12 }, // stuck sailors
  { f: 1210, cInf: 10 }, // kitchen
  { f: 1416, cInf: 0 }, // sunset wide
  { f: 1482, cInf: 12 }, // glue CU
  { f: 1542, cInf: 0 }, // dusk wide
  { f: 1619, cInf: 10 }, // boss on the steps
  { f: 1656, cInf: 0 }, // flag
  { f: 1704, cInf: 11, focus: () => [3.2, 1.75, -16.3] }, // engineer
  { f: 1748, cInf: 9 }, // clipboard insert
  { f: 1808, cInf: 0 }, // summer wide
  { f: 1860, cInf: 12 }, // sniffer CU
  { f: 1912, cInf: 11 }, // bucket man
  { f: 2046, cInf: 0 }, // crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects (cartoon plants / props built by build.ts) visible a <= f < b inside their own shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 1808, b: 1860, kit: "plant_bushDetailed", pos: [24.5, 0, 2.2], s: 1.3, yaw: 0.4 }, // summer wide: a bush bottom-left
];
