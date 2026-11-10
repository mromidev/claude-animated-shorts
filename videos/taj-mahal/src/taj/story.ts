// "ताज महल के टेढ़े मीनार": timeline, layout, cameras and acting. Everything is a pure function of story time t (s).
// Line starts and word times come from voice/line_starts.json and voice/words.json (the cleaned deep voice).
export const FPS = 30;
export const DURATION = 86.5;
export const TOTAL = Math.ceil(DURATION * FPS);
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (x: number) => { const u = clamp01(x); return u * u * u * (u * (6 * u - 15) + 10); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const norm3 = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------- voice timing ----------------
export const L = [0, 5.77, 14.06, 19.53, 23.26, 28.17, 33.82, 40.67, 42.07, 46.57, 51.3, 58.47, 63.25, 67.87, 72.88, 76.58];
export const VOICE_END = 84.76;
export const W = {
  died: 13.16, plan: 14.5, yamuna: 20.42, marble: 23.84, makrana: 27.08, elephants: 30.42, ramp: 32.98, stones: 34.92,
  tilt: 45.56, quake: 47.46, fallOut: 49.06, dome: 49.86, danda: 52.88, bahar: 54.74, gire: 56.16, good: 58.44, bad: 62.8,
  aurangzeb: 66.16, qaid: 66.84, taj: 71.58, buried: 75.52, tedhe: 78.98, ek: 81.86, qabr: 84.02,
};

// ---------------- zones (one world, sets far apart) ----------------
export const PALACE: V3 = [300, 0, 0];
export const QUARRY: V3 = [-300, 0, 0];
export const YARD: V3 = [600, 0, 0];
export const FORTIN: V3 = [-600, 0, 0];
export const CRYPT: V3 = [900, 0, 0];
/** Taj complex at the origin: terrace top 0.8, plinth top Y_PL, garden toward +z, river toward -z */
export const Y_TER = 0.8, Y_PL = 2.6, PL = 13, TOMB = 7, CHAMF = 2.2, WALL_H = 9;
export const ROOF = Y_PL + WALL_H;
export const MIN_R = 12.2;
export const MINARETS: V3[] = [[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]].map(([x, , z]) => [x * MIN_R, Y_PL, z * MIN_R] as V3);
export const RIVER_Z0 = -24, RIVER_Z1 = -82;
export const FORT: V3 = [-118, 0, -104];
export const TO_TAJ = norm3([-FORT[0], 0, -FORT[2]]);
/** ramp for the marble: from the ground at z = 78 up to the half-built walls at z = 16 */
export const RAMP_Z0 = 78, RAMP_Z1 = 16, RAMP_H = 7.6;
export const rampY = (z: number) => RAMP_H * clamp01((RAMP_Z0 - z) / (RAMP_Z0 - RAMP_Z1));

// ---------------- light presets ----------------
export type Light = "golden" | "day" | "night" | "morning" | "dusk" | "crypt" | "timelapse";

// ---------------- shots ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll?: number };
export type Shot = { id: string; a: number; b: number; light: Light; cam: (t: number, u: number) => Cam };
const creep = (c: Cam, u: number, k = 0.06): Cam => ({ ...c, fov: c.fov * (1 - k * u) });
const P = (z: V3, x: number, y: number, zz: number): V3 => [z[0] + x, z[1] + y, z[2] + zz];

/** where elephant i is (lead = 0) on the ramp */
export const elephantZ = (i: number, t: number) => 64 - i * 7.2 - 1.05 * (t - L[5]);
export const camelX = (i: number, t: number) => QUARRY[0] - 22 + 1.25 * (t - L[6]) - i * 3.8;

const FORT_SIDE: V3 = [TO_TAJ[2], 0, -TO_TAJ[0]];

export const SHOTS: Shot[] = [
  // 1 hook: golden Taj, low over the garden, gliding up toward the front-right minaret
  { id: "hook", a: 0, b: L[1], light: "golden", cam: (t, u) => ({ pos: lerp3([-4, 2.4, 104], [22, 7.5, 52], glide(u)), look: lerp3([0, 11, 0], [6, 11, 6], glide(u)), fov: lerp(36, 34, u) }) },
  // 2 Burhanpur, night: the bedside
  { id: "bed", a: L[1], b: 10.0, light: "night", cam: (t, u) => creep({ pos: P(PALACE, -3.0, 2.0, 3.8), look: P(PALACE, 1.6, 0.8, -2.2), fov: 50 }, u, 0.08) },
  // 3 close on Shah Jahan; the lamp goes out on "चल बसीं"
  { id: "grief", a: 10.0, b: L[2], light: "night", cam: (t, u) => creep({ pos: P(PALACE, -0.9, 1.35, 1.2), look: P(PALACE, 0.3, 0.95, -1.4), fov: 40 }, u, 0.12) },
  // 4a morning: the vow
  { id: "vow", a: L[2], b: 16.6, light: "morning", cam: (t, u) => creep({ pos: P(PALACE, -0.4, 1.6, 3.4), look: P(PALACE, -0.5, 1.4, -0.8), fov: 42 }, u, 0.1) },
  // 4b the plan draws itself
  { id: "plan", a: 16.6, b: L[3], light: "morning", cam: (t, u) => ({ pos: lerp3(P(PALACE, -0.5, 2.5, 1.35), P(PALACE, -0.5, 2.1, 1.0), glide(u)), look: P(PALACE, -0.5, 0.8, 0.15), fov: 44 }) },
  // 5 Agra, the river bank, 20,000 workers: aerial glide from over the river to the site
  { id: "site", a: L[3], b: L[4], light: "day", cam: (t, u) => ({ pos: lerp3([-48, 42, -66], [-34, 22, 52], glide(u)), look: lerp3([0, 0, -10], [0, 2, 12], glide(u)), fov: 50 }) },
  // 6 Makrana quarry
  { id: "quarry", a: L[4], b: L[5], light: "day", cam: (t, u) => ({ pos: lerp3(P(QUARRY, 7.5, 1.7, 11), P(QUARRY, 5.2, 2.2, 8.4), glide(u)), look: P(QUARRY, 0, 2.4, -6), fov: 48 }) },
  // 7a elephants: side tracking up the ramp
  { id: "elephants", a: L[5], b: 31.2, light: "day", cam: (t) => { const z = elephantZ(1, t); const y = rampY(z); return { pos: [15, y + 2.6, z + 1.0], look: [0, y + 1.6, z - 1.5], fov: 46 }; } },
  // 7b the long ramp
  { id: "ramp", a: 31.2, b: L[6], light: "day", cam: (t, u) => creep({ pos: [44, 24, 96], look: [0, 4, 34], fov: 44 }, u, 0.1) },
  // 8a caravan with the stones
  { id: "caravan", a: L[6], b: 37.2, light: "day", cam: (t) => { const x = camelX(1, t); return { pos: [x - 2.0, 2.2, 53], look: [x - 2.2, 1.6, 40], fov: 44 }; } },
  // 8b pietra dura close-up
  { id: "inlay", a: 37.2, b: L[7], light: "day", cam: (t, u) => creep({ pos: P(QUARRY, 20, 2.15, 11.6), look: P(QUARRY, 20, 0.85, 10.0), fov: 40 }, u, 0.08) },
  // 9 twenty-two years: time-lapse, the tomb rises
  { id: "timelapse", a: L[7], b: L[8], light: "timelapse", cam: (t, u) => ({ pos: lerp3([36, 13, 72], [32, 13, 64], u), look: [0, 11, 0], fov: 44 }) },
  // 10 the snap: the minarets lean out
  { id: "lean", a: L[8], b: L[9], light: "day", cam: (t, u) => creep({ pos: [24, 3.2, 42], look: [0, 10.5, 0], fov: 50 }, u, 0.06) },
  // 11 the earthquake: ghost minarets fall outward, the dome stays
  { id: "quake", a: L[9], b: L[10], light: "day", cam: (t, u) => { const k = smooth((t - W.dome + 0.1) / 1.3); return { pos: lerp3([0, 46, 88], [0, 17, 46], k), look: lerp3([0, 3, 2], [0, 15, 0], k), fov: lerp(52, 40, k) }; } },
  // 12a the courtyard: a kid asleep, the father stands a stick
  { id: "yard", a: L[10], b: 55.2, light: "day", cam: (t, u) => creep({ pos: P(YARD, 0.6, 1.7, 5.4), look: P(YARD, 0.6, 0.6, 0), fov: 48 }, u, 0.1) },
  // 12b the stick falls away from the kid
  { id: "stick", a: 55.2, b: L[11], light: "day", cam: (t, u) => creep({ pos: P(YARD, 1.4, 1.5, 5.6), look: P(YARD, 1.2, 0.55, 0), fov: 50 }, u, 0.08) },
  // 13 good news: the workers wave both hands
  { id: "hands", a: L[11], b: 62.75, light: "day", cam: (t, u) => creep({ pos: [5.6, 1.6, 33], look: [3.0, 3.6, 12], fov: 46 }, u, 0.08) },
  // 14a bad news: Aurangzeb
  { id: "aurangzeb", a: 62.75, b: 65.4, light: "crypt", cam: (t, u) => creep({ pos: P(FORTIN, 0.3, 1.75, 1.6), look: P(FORTIN, 0, 1.55, -1.5), fov: 40 }, u, 0.12) },
  // 14b the door slams
  { id: "door", a: 65.4, b: L[13], light: "crypt", cam: (t, u) => creep({ pos: P(FORTIN, 0.6, 1.6, 3.4), look: P(FORTIN, 0, 1.5, -5), fov: 44 }, u, 0.08) },
  // 15 eight years at the window, the Taj across the river
  { id: "window", a: L[13], b: L[14], light: "dusk", cam: (t, u) => {
    const pos = add3(add3(FORT, scale3(TO_TAJ, -2.2)), add3(scale3(FORT_SIDE, 0.35), [0, 15.5, 0]));
    return creep({ pos, look: [6, 9, 0], fov: 40 }, u, 0.1);
  } },
  // 16 buried beside her
  { id: "crypt", a: L[14], b: L[15], light: "crypt", cam: (t, u) => ({ pos: lerp3(P(CRYPT, 2.4, 3.3, 5.8), P(CRYPT, 1.6, 2.9, 4.6), glide(u)), look: P(CRYPT, -0.7, 0.5, 0), fov: 46 }) },
  // 17a perfect symmetry from above, the centre line draws itself
  { id: "above", a: L[15], b: 80.2, light: "golden", cam: (t, u) => ({ pos: lerp3([0, 70, 34], [0, 96, 30], glide(u)), look: [0, 0, 22], fov: 48 }) },
  // 17b the one thing off the line: his own grave
  { id: "graves", a: 80.2, b: 84.3, light: "crypt", cam: (t, u) => ({ pos: lerp3(P(CRYPT, 0, 7.2, 0.9), P(CRYPT, -0.4, 5.6, 0.7), glide(u)), look: P(CRYPT, -0.4, 0, 0), fov: 50 }) },
  // 18 the Taj at sunset, pulling away
  { id: "end", a: 84.3, b: DURATION + 0.01, light: "golden", cam: (t, u) => ({ pos: lerp3([0, 2.6, 86], [0, 6, 122], glide(u)), look: [0, 11, 0], fov: lerp(34, 32, u) }) },
];
export const shotIndexAt = (t: number) => { const i = SHOTS.findIndex((s) => t >= s.a && t < s.b); return i < 0 ? SHOTS.length - 1 : i; };
export const shotAt = (t: number) => SHOTS[shotIndexAt(t)];

/** impact shakes: [time, amplitude (deg), duration] */
const KICKS: [number, number, number][] = [[L[8], 0.9, 0.25], [W.quake - 0.03, 1.6, 1.6], [56.72, 0.5, 0.25], [W.bad - 0.05, 0.9, 0.25], [W.qaid - 0.03, 1.4, 0.3], [W.qabr - 0.03, 0.6, 0.25]];
export const camAt = (t: number): Cam => {
  const s = shotAt(t);
  const c = s.cam(t, (t - s.a) / (s.b - s.a));
  let roll = c.roll ?? 0, dy = 0;
  for (const [k, amp, d] of KICKS) {
    const x = t - k;
    if (x < 0 || x > d) continue;
    const f = Math.floor(x * FPS);
    const env = 1 - x / d;
    roll += (f % 2 ? -1 : 1) * amp * env;
    dy += (f % 2 ? -1 : 1) * amp * 0.03 * env;
  }
  return { ...c, pos: [c.pos[0], c.pos[1] + dy, c.pos[2]], roll };
};

// ---------------- world state ----------------
/** how much of the Taj is built: 0 nothing .. 1 finished */
export const buildAt = (t: number) => {
  if (t >= L[3] && t < L[4]) return 0.16;
  if (t >= L[5] && t < L[6]) return 0.4;
  if (t >= L[7] && t < L[8]) return lerp(0.42, 1, smooth((t - L[7] - 0.05) / 1.2));
  return 1;
};
/** outward lean of the minarets (deg); exaggerated so the eye can see it */
export const leanAt = (t: number) => {
  if (t < L[1]) return 3.2;
  if (t >= L[8] && t < L[10]) return lerp(0.4, 4.5, smooth((t - L[8] - 0.4) / (W.tilt - L[8] - 0.2)));
  if (t >= L[15] && t < 80.2) return 3.2;
  return 1.6;
};
/** ghost minarets falling outward in the quake: 0 upright .. 1 on the ground */
export const fallAt = (t: number) => (t < W.quake + 0.3 || t > W.dome + 0.5 ? -1 : Math.min(1, ((t - W.quake - 0.3) / 1.3) ** 2));
export const quakeAt = (t: number) => (t > W.quake - 0.03 && t < W.quake + 1.8 ? Math.sin((t - W.quake) * 55) * 0.06 * (1 - (t - W.quake) / 1.8) : 0);
/** centre line drawing over the plan view / crypt floor (0..1) */
export const centreLineAt = (t: number) => (t >= L[15] && t < 80.2 ? smooth((t - 77.2) / 1.8) : t >= 80.2 && t < 84.3 ? smooth((t - 80.4) / 1.0) : 0);
export const sjGlowAt = (t: number) => (t >= 80.2 && t < 84.3 ? smooth((t - W.ek - 0.2) / 0.6) : 0);
/** the palace lamp: lit, then out on "चल बसीं" */
export const lampAt = (t: number) => (t < W.died ? 1 : 1 - smooth((t - W.died) / 0.45));
/** the plan drawing 0..1 */
export const planAt = (t: number) => (t < 16.6 ? 0.05 : smooth((t - 16.8) / 2.4));
export const inlayAt = (t: number) => smooth((t - 37.4) / 3.0);
/** stick by the charpai: angle away from the kid (deg), 0 = upright; hidden before it is stood up */
export const stickAt = (t: number) => {
  if (t < W.danda - 0.1) return null;
  if (t < W.bahar - 0.1) return 0;
  if (t < W.gire - 0.06) return 9 * smooth((t - W.bahar + 0.1) / 0.5);
  const x = t - W.gire + 0.06;
  return Math.min(90, 9 + 81 * (x / 0.55) ** 2);
};
/** door leaf angle (deg): 80 open .. 0 shut on "क़ैद" */
export const doorAt = (t: number) => (t < W.qaid - 0.55 ? 80 : 80 * (1 - smooth((t - W.qaid + 0.55) / 0.52) ** 1.6));
export const blinkAt = (t: number, seed: number) => {
  const period = 1.7 + (seed % 4) * 0.45;
  const ph = ((t + seed * 0.77) % period) / period;
  return ph < 0.13 / period ? 1 : 0;
};
