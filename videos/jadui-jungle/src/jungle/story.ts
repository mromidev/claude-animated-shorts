// Timeline, layout, cameras and acting for "जादुई जंगल का रहस्य". Everything is a pure function of story time t (s).
import { LINES } from "../lines";

export const FPS = 30;
export const DURATION = 88;
export const TOTAL = DURATION * FPS;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(x0(u)); return x * x * x * (x * (6 * x - 15) + 10); };
const x0 = (u: number) => u;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** piecewise-linear table [[t, v], ...] */
export const pw = (tab: [number, number][], t: number) => {
  if (t <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return lerp(va, vb, smooth((t - a) / (b - a))); }
  return tab[tab.length - 1][1];
};

// ---------------- layout ----------------
export const pathX = (z: number) => 2.0 * Math.sin(z / 10);
export const RIVER_Z = -30, RIVER_HALF = 3.2, WATER_Y = -0.38;
export const CLEARING: V3 = [0, 0, -54];
export const CLEAR_R = 15;
export const MAGIC: V3 = [0, 0, -64];
export const HIDE_TREE: V3 = [6.0, 0, 21.4];
export const BUSH: V3 = [4.5, 0, 23.1];
export const BIRD_AT: V3 = [2.3, 0, -50.4];
export const SAPLING: V3 = [-1.7, 0, -50.6];
export const STONES: V3[] = [-32.7, -31.4, -30.1, -28.8, -27.5].map((z, i) => [pathX(z) + (i % 2 ? 0.25 : -0.2), -0.04, z]);

const bump = (d: number, r: number) => (d >= r ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * d) / r));
export const ground = (x: number, z: number) => {
  let h = 0.45 * Math.sin(x * 0.13 + 1) * Math.sin(z * 0.11) + 0.25 * Math.sin(x * 0.31 + z * 0.17);
  // flatten the path corridor and the clearing
  const dp = Math.abs(x - pathX(z));
  h *= 0.25 + 0.75 * smooth((dp - 1.5) / 6);
  const dc = Math.hypot(x - CLEARING[0], z - CLEARING[2]);
  h *= smooth((dc - CLEAR_R + 3) / 8);
  // hills far away from the path
  h += 2.5 * smooth((Math.abs(x) - 22) / 25) * (1 + 0.5 * Math.sin(z * 0.05));
  // river bed
  const dr = Math.abs(z - RIVER_Z);
  h -= 1.0 * bump(dr, RIVER_HALF + 1.2);
  // the magic tree mound
  h += 0.7 * bump(Math.hypot(x - MAGIC[0], z - MAGIC[2]), 9);
  return h;
};
export const standY = (x: number, z: number) => {
  if (Math.abs(z - RIVER_Z) < RIVER_HALF + 0.3) {
    let best = -1e9;
    for (const s of STONES) if (Math.hypot(x - s[0], z - s[2]) < 0.75) best = Math.max(best, s[1] + 0.12);
    if (best > -1e8) return best;
  }
  return ground(x, z);
};

// ---------------- the "magic light" of the forest ----------------
export const T_BURST = 65.5;
/** forest magic 0..1.3: full, fading while Sheru warns, dim, a little back for the bird, burst at the planting */
export const glowAt = (t: number) => pw([[20.6, 1], [26.5, 0.32], [59.5, 0.32], [60.6, 0.48], [T_BURST, 0.5], [T_BURST + 2.2, 1.3]], t);
/** the magic tree's own glow */
export const treeGlowAt = (t: number) => pw([[38.0, 0.25], [43.3, 0.35], [44.2, 0.75], [T_BURST, 0.8], [T_BURST + 1.8, 1.6]], t);
export const treeEyesAt = (t: number) => (t < 43.2 ? 0 : t < 43.7 ? smooth((t - 43.2) / 0.5) : 1);

// ---------------- speech ----------------
/** mouth opening (0/1) for a speaker at time t, from the word timings */
export const talkAt = (spk: string, t: number) => {
  for (const L of LINES) {
    if (L.spk !== spk || t < L.t0 || t > L.t1 + 0.05) continue;
    const ws = L.words;
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i].t, b = i + 1 < ws.length ? ws[i + 1].t : L.t1;
      if (t >= a && t < b - 0.04) {
        const u = (t - a) / Math.max(0.12, b - a);
        const n = Math.max(1, Math.round((b - a) / 0.16));
        return Math.sin(u * n * Math.PI) > 0.25 ? 1 : 0;
      }
    }
  }
  return 0;
};
export const lineAt = (t: number) => LINES.find((l) => t >= l.t0 - 0.1 && t <= l.t1 + 0.45);

export const blinkAt = (t: number, seed: number) => {
  const period = 2.1 + (seed % 3) * 0.5;
  const ph = ((t + seed * 0.77) % period) / period;
  const d = 0.13 / period;
  return ph < d ? (ph < d / 2 ? 1 : 0.5) : 0;
};

// ---------------- acting ----------------
export type Act = {
  pos: V3; heading: V3; // world
  expr: string; arms?: string; walk?: number; run?: boolean; kneel?: number; hop?: number; wave?: number; pose?: string; phase?: number; tail?: number; wink?: boolean;
  lookCam?: boolean; facing?: number; // facing override (-1..1 relative to the camera)
  visible: boolean;
};

const at = (z: number, dx = 0): V3 => { const x = pathX(z) + dx; return [x, standY(x, z), z]; };
const CH_STOP = 24.6;

const chintuZ = (t: number) => {
  if (t < 10.4) return 36.0 - 1.1 * t;
  if (t < 30.6) return CH_STOP - 0;
  if (t < 35.5) return CH_STOP - 4.4 * (t - 30.6);
  if (t < 38.4) return -24.5 - 4.0 * (t - 35.5);
  if (t < 43.6) return -36.1 - 11.0 * smooth((t - 38.4) / 5.2);
  return -47.1;
};

export const chintuAt = (t: number): Act => {
  const z = chintuZ(t);
  let pos = at(z);
  if (t >= 38.4) { const x = lerp(pathX(z), -0.4, smooth((t - 38.4) / 5.2)); pos = [x, ground(x, z), z]; }
  const fwd: V3 = [0, 0, -1];
  const a: Act = { pos, heading: fwd, expr: "smile", visible: true };
  if (t < 10.4) { a.walk = (t * 0.95) % 1; a.arms = "swing"; a.lookCam = false; }
  else if (t < 13.6) { a.expr = t < 10.85 ? "smile" : "surprise"; a.facing = 0.6; }
  else if (t < 20.6) { a.expr = t < 14.6 ? "surprise" : "laugh"; a.facing = 0.45; if (t > 18.9) a.expr = "smile"; }
  else if (t < 26.2) { a.expr = "worried"; a.facing = 0.5; }
  else if (t < 30.6) { a.expr = "determined"; a.facing = t < 29.6 ? 0.2 : 0.7; if (t > 29.0) a.arms = "point"; }
  else if (t < 38.4) { a.run = true; a.walk = (t * 1.8) % 1; a.arms = "swing"; a.expr = t > 35.5 ? "laugh" : "determined"; if (t > 35.5) a.hop = Math.max(0, Math.sin(((t - 35.5) / 0.6) * Math.PI)) * 0.35; }
  else if (t < 43.6) { a.walk = (t * 1.2) % 1; a.expr = "wow"; if (t > 42.6) a.walk = undefined; }
  else if (t < 53.2) { a.expr = t < 44 ? "wow" : "smile"; a.facing = 0; }
  else if (t < 55.6) { a.expr = "determined"; a.arms = "cheer"; }
  // scene 6: bird, then the sapling
  if (t >= 55.6 && t < 61.0) {
    const u = smooth((t - 55.6) / 0.9);
    pos = lerp3(pos, [BIRD_AT[0] - 0.75, ground(BIRD_AT[0] - 0.75, BIRD_AT[2] + 0.35), BIRD_AT[2] + 0.35], u);
    a.walk = u < 1 ? (t * 1.3) % 1 : undefined; a.kneel = smooth((t - 56.4) / 0.4) * (1 - smooth((t - 59.4) / 0.4));
    a.expr = t < 59.5 ? "kind" : "laugh"; a.arms = a.kneel > 0.5 ? "reach" : t > 59.5 ? "cheer" : undefined; a.facing = 0.7;
  }
  if (t >= 61.0 && t < 68.0) {
    const u = smooth((t - 61.0) / 0.9);
    const p0: V3 = [BIRD_AT[0] - 0.75, 0, BIRD_AT[2] + 0.35], p1: V3 = [SAPLING[0] + 0.7, 0, SAPLING[2] + 0.35];
    const p = lerp3(p0, p1, u); p[1] = ground(p[0], p[2]); pos = p;
    a.walk = u > 0 && u < 1 ? (t * 1.3) % 1 : undefined;
    a.kneel = smooth((t - 63.6) / 0.35) * (1 - smooth((t - 65.6) / 0.4));
    a.arms = a.kneel > 0.5 ? "reach" : t > 65.6 ? "cheer" : undefined;
    a.expr = t > T_BURST ? "wow" : "kind"; a.facing = -0.6;
    if (t > 66.6) a.expr = "laugh";
  }
  if (t >= 68.0) {
    const p: V3 = [-0.6, 0, -47.6]; p[1] = ground(p[0], p[2]); pos = p;
    a.expr = "laugh"; a.arms = "cheer"; a.hop = Math.max(0, Math.sin(t * Math.PI * 2.2)) * 0.25; a.facing = 0.2;
    if (t > 74.6) { a.hop = 0; a.arms = "down"; a.facing = 0.35; }
    if (t > 81.0) { a.expr = "smile"; a.arms = "wave"; a.wave = (t * 1.6) % 1; a.facing = 0; }
  }
  a.pos = pos;
  return a;
};

export const sheruAt = (t: number): Act => {
  const a: Act = { pos: [0, 0, 0], heading: [0, 0, -1], expr: "grin", pose: "sit", visible: true, tail: Math.sin(t * 5) };
  const stop: V3 = (() => { const x = pathX(CH_STOP) + 1.25, z = CH_STOP - 0.6; return [x, ground(x, z), z]; })();
  if (t < 13.8) { a.visible = false; a.pos = [BUSH[0] + 0.6, 0, BUSH[2] - 0.6]; return a; }
  if (t < 20.6) {
    // pop out of the bush, three silly hops, then sit
    const u = smooth((t - 13.8) / 0.5);
    const from: V3 = [BUSH[0] + 0.2, ground(BUSH[0], BUSH[2]), BUSH[2] - 0.2];
    let p = lerp3(from, stop, u);
    const hopT = t - 14.3;
    if (hopT > 0 && t < 18.6) {
      const k = Math.floor(hopT / 0.85), f = (hopT % 0.85) / 0.85;
      p = add3(stop, [Math.sin(k * 2.1) * 0.6, Math.sin(f * Math.PI) * 0.55, Math.cos(k * 1.7) * 0.35]);
      a.pose = f < 0.75 ? "jump" : "stand"; a.facing = Math.sin(k * 2.1 + 1) > 0 ? 0.6 : -0.6;
      a.expr = ["silly", "grin", "laugh", "silly", "wow"][k % 5]; a.wink = k % 2 === 0 && a.expr === "silly";
    } else if (t < 14.3) { p[1] += Math.sin(u * Math.PI) * 0.6; a.pose = "jump"; a.expr = "laugh"; }
    else { a.pose = "sit"; a.expr = t < 18.9 ? "grin" : "smile"; a.facing = -0.35; }
    a.pos = p; return a;
  }
  if (t < 30.6) { a.pos = stop; a.pose = "sit"; a.expr = t < 26.2 ? "worried" : "determined"; a.facing = -0.4; a.tail = t < 26.2 ? 0 : Math.sin(t * 7); return a; }
  if (t < 43.6) {
    const c = chintuAt(t);
    const p: V3 = [c.pos[0] + 1.05, 0, c.pos[2] + 0.55];
    if (t > 35.5 && t < 38.4) { p[0] = c.pos[0] + 0.15; p[2] = c.pos[2] + 1.35; }
    p[1] = standY(p[0], p[2]);
    if (t > 35.5 && t < 38.4) p[1] += Math.max(0, Math.sin(((t - 35.5 + 0.3) / 0.6) * Math.PI)) * 0.4;
    a.pos = p; a.pose = t < 42.8 ? "run" : "stand"; a.phase = (t * 2.2) % 1; a.expr = t < 38.4 ? "laugh" : "wow";
    if (t > 43.2) a.facing = 0;
    return a;
  }
  if (t < 55.6) { const p: V3 = [1.1, 0, -46.6]; p[1] = ground(p[0], p[2]); a.pos = p; a.pose = "sit"; a.expr = t < 44.6 ? "wow" : t > 53.2 ? "determined" : "smile"; a.facing = -0.2; return a; }
  if (t < 61.0) {
    const u = smooth((t - 55.6) / 1.0);
    const p = lerp3([1.1, 0, -46.6], [BIRD_AT[0] + 0.3, 0, BIRD_AT[2] + 1.25], u); p[1] = ground(p[0], p[2]);
    a.pos = p; a.pose = u < 1 ? "run" : "sit"; a.phase = (t * 2) % 1; a.expr = t < 59.5 ? "worried" : "laugh"; a.facing = -0.5;
    if (u < 1) a.facing = 0.8;
    return a;
  }
  if (t < 68.0) {
    const u = smooth((t - 61.0) / 1.0);
    const p = lerp3([BIRD_AT[0] + 0.3, 0, BIRD_AT[2] + 1.25], [SAPLING[0] - 0.6, 0, SAPLING[2] + 0.15], u); p[1] = ground(p[0], p[2]);
    a.pos = p; a.pose = u < 1 ? "run" : t > 61.8 && t < 63.8 ? "dig" : "sit"; a.phase = (t * (a.pose === "dig" ? 3.2 : 2)) % 1;
    a.facing = u < 1 ? -0.8 : 0.6; a.expr = t > T_BURST ? "wow" : t > 61.2 && t < 63.1 ? "talk" : "grin";
    if (t > 66.6) a.expr = "laugh";
    return a;
  }
  const p: V3 = [0.75, 0, -47.4]; p[1] = ground(p[0], p[2]);
  a.pos = p; a.expr = "laugh"; a.pose = t < 74.6 ? (Math.sin(t * Math.PI * 2.2 + 1.2) > 0.3 ? "jump" : "stand") : "sit"; a.facing = -0.2;
  if (a.pose === "jump") a.pos = add3(p, [0, Math.max(0, Math.sin(t * Math.PI * 2.2 + 1.2)) * 0.3, 0]);
  if (t > 81.0) { a.expr = "grin"; a.pose = "sit"; a.facing = 0; }
  return a;
};

// ---------------- shots & cameras ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll?: number };
export type Shot = { a: number; b: number; cam: (t: number, u: number) => Cam; dof: number; focus?: (t: number) => V3 };
const head = (a: Act, h = 1.0): V3 => [a.pos[0], a.pos[1] + h, a.pos[2]];
/** slow creep so no hold is ever frozen */
const creep = (c: Cam, u: number, k = 0.06): Cam => ({ ...c, fov: c.fov * (1 - k * u) });

export const SHOTS: Shot[] = [
  // 1. establishing: crane down over the flower meadow
  { a: 0, b: 5.0, dof: 0, cam: (t, u) => ({ pos: lerp3([-9, 9, 50], [-3.2, 2.6, 41.5], glide(u)), look: lerp3([0, 3.5, 20], [1.2, 1.2, 31], glide(u)), fov: 48 }) },
  // 2. Chintu walks toward us, the camera eases in
  { a: 5.0, b: 10.4, dof: 7, cam: (t, u) => { const c = chintuAt(t); const d = lerp(6.8, 3.1, glide(u)); return { pos: [c.pos[0] - 0.6, c.pos[1] + 1.15, c.pos[2] - d], look: head(c, 0.85), fov: 40 }; }, focus: (t) => head(chintuAt(t), 0.9) },
  // 3. the funny sound: over Chintu's shoulder toward the shaking bush
  { a: 10.4, b: 13.4, dof: 9, cam: (t, u) => creep({ pos: [-0.9, 1.5, 28.2], look: [3.4, 0.75, 23.3], fov: 42 }, u), focus: () => [4.3, 0.6, 23.2] },
  // 4. Sheru pops out: two-shot from the side
  { a: 13.4, b: 17.2, dof: 6, cam: (t, u) => creep({ pos: [-1.6, 1.3, 19.4], look: [2.6, 0.7, 23.8], fov: 46 }, u, 0.08), focus: () => [2.4, 0.7, 24.0] },
  // 5. Sheru's silly faces, close
  { a: 17.2, b: 20.6, dof: 12, cam: (t, u) => { const s = sheruAt(18.9); return creep({ pos: [s.pos[0] - 0.6, s.pos[1] + 0.75, s.pos[2] - 2.3], look: head(s, 0.48), fov: 36 }, u, 0.1); }, focus: () => head(sheruAt(18.9), 0.5) },
  // 6a. Sheru worried
  { a: 20.6, b: 23.6, dof: 12, cam: (t, u) => { const s = sheruAt(21); return creep({ pos: [s.pos[0] - 0.5, s.pos[1] + 0.6, s.pos[2] - 2.0], look: head(s, 0.5), fov: 36 }, u, 0.12); }, focus: () => head(sheruAt(21), 0.5) },
  // 6b. low angle: the magic lights drift away
  { a: 23.6, b: 26.2, dof: 0, cam: (t, u) => ({ pos: lerp3([-0.5, 2.3, 20.4], [-0.9, 3.0, 19.8], glide(u)), look: lerp3([1.9, 1.1, 24.2], [1.9, 2.0, 24.6], glide(u)), fov: 50 }) },
  // 7. Chintu, determined
  { a: 26.2, b: 30.5, dof: 11, cam: (t, u) => { const c = chintuAt(27); return creep({ pos: [c.pos[0] + 0.3, c.pos[1] + 1.0, c.pos[2] - 2.6], look: head(c, 0.9), fov: 36 }, u, 0.1); }, focus: () => head(chintuAt(27), 0.9) },
  // 8. tracking run through the forest
  { a: 30.5, b: 35.5, dof: 5, cam: (t) => { const c = chintuAt(t); return { pos: [c.pos[0] + 6.0, c.pos[1] + 1.25, c.pos[2] - 1.6], look: [c.pos[0] + 0.4, c.pos[1] + 0.75, c.pos[2] - 0.6], fov: 42 }; }, focus: (t) => head(chintuAt(t), 0.7) },
  // 9. river crossing, low and wide
  { a: 35.5, b: 38.4, dof: 0, cam: (t, u) => ({ pos: lerp3([3.6, 0.2, -29.6], [3.4, 0.25, -30.6], glide(u)), look: lerp3([pathX(-28), 0.45, -27.6], [pathX(-32), 0.55, -32.4], glide(u)), fov: 50 }) },
  // 10. the reveal: rise behind the two, the glowing tree ahead
  { a: 38.4, b: 43.2, dof: 0, cam: (t, u) => ({ pos: lerp3([0.6, 1.3, -31.0], [0.2, 3.6, -34.2], glide(u)), look: lerp3([0.2, 1.4, -44], [0, 7.5, -62], glide(u)), fov: 50 }) },
  // 11. the tree wakes and speaks
  { a: 43.2, b: 48.4, dof: 0, cam: (t, u) => ({ pos: lerp3([0, 4.4, -49.5], [0, 4.9, -52.2], glide(u)), look: [0, 6.0, -62], fov: 42 }) },
  // 12. over the shoulders of the two friends, the tree still speaking
  { a: 48.4, b: 53.2, dof: 6, cam: (t, u) => creep({ pos: [-2.4, 1.1, -42.6], look: [0.2, 4.6, -60], fov: 46 }, u, 0.08), focus: () => [0, 5.5, -61] },
  // 13. Chintu: "we will help!"
  { a: 53.2, b: 55.6, dof: 11, cam: (t, u) => creep({ pos: [0.2, 1.05, -50.4], look: [0.25, 0.8, -46.9], fov: 40 }, u, 0.12), focus: () => head(chintuAt(54), 0.9) },
  // 14. the hurt bird
  { a: 55.6, b: 61.0, dof: 10, cam: (t, u) => creep({ pos: [3.3, 0.85, -52.6], look: [1.7, 0.45, -50.0], fov: 42 }, u, 0.08), focus: () => [2.0, 0.4, -50.2] },
  // 15. planting the sapling; the glow bursts and we pull back
  { a: 61.0, b: 68.0, dof: 8, cam: (t, u) => { const k = glide((t - T_BURST + 0.3) / 2.4); return { pos: lerp3([-0.4, 1.25, -53.6], [0.6, 4.2, -59.5], k), look: lerp3([-1.4, 0.45, -50.5], [-0.8, 0.8, -48.0], k), fov: lerp(40, 54, k) }; }, focus: () => [-1.5, 0.4, -50.5] },
  // 16. the whole forest celebrates: slow orbit
  { a: 68.0, b: 75.0, dof: 0, cam: (t, u) => { const a = lerp(0.35, -0.35, glide(u)); return { pos: [Math.sin(a) * 10.5, 3.2, -47.8 + Math.cos(a) * 6.8], look: [0, 1.6, -52], fov: 52 }; } },
  // 17. laughing together
  { a: 75.0, b: 81.2, dof: 10, cam: (t, u) => creep({ pos: [0.1, 1.05, -44.6], look: [0.05, 0.8, -47.5], fov: 38 }, u, 0.1), focus: () => [0, 0.8, -47.5] },
  // 18. waving goodbye, gentle pull-back
  { a: 81.2, b: DURATION + 0.01, dof: 5, cam: (t, u) => ({ pos: lerp3([0.1, 1.0, -44.8], [0.1, 1.5, -42.6], glide(u)), look: [0.05, 0.9, -47.5], fov: 40 }), focus: () => [0, 0.8, -47.5] },
];
export const shotIndexAt = (t: number) => { const i = SHOTS.findIndex((s) => t >= s.a && t < s.b); return i < 0 ? SHOTS.length - 1 : i; };
export const camAt = (t: number): Cam => { const s = SHOTS[shotIndexAt(t)]; return s.cam(t, (t - s.a) / (s.b - s.a)); };
