// Our cast as lit flat sprites in the 3D world (canvas pool + camera-facing yaw billboards, cardShade lighting,
// multiply contact blobs), staged per shot of the molasses short. Effects are unlit cards on the NOINK layer.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, Outfit, Expr, FrontOpts, SideOpts, horseSide, NEIGHBOR, BOSS, PAINTER, WORKER, SAILOR, ENGINEER, MODERN, SUMMER,
  fxBurst, fxCreak, fxContact, fxShadow, fxDrip, fxDot, fxMolSplash, fxSmell, fxThermo, fxClipboard, fxDrop,
} from "./toon";
import {
  FPS, SHOTS, V3, smooth, clamp01, State, TANK, TANK_R, KITCHEN, COURT, THERMO, RIVETS, W, frontX, horseX, crestH, floodH,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number;
  flat?: boolean; rot?: number; soft?: boolean; face?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57 && c > -0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = (who.i * 5 + 3) % 7 + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const front = { side: false, mirror: false };

const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** ground height for a standing card: kerb-high sidewalks */
const groundY = (z: number) => (Math.abs(z) > 7.05 && Math.abs(z) < 10.5 ? 0.12 : 0);

// ---------------- helpers for the shots ----------------
const X = (x: number) => q(x, 60);
/** someone standing still (or walking in place on the spot with phase) */
const stand = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x: number, z: number, fo: FrontOpts = {}, opts: { y?: number; scale?: number; blobK?: number; swaps?: number[] } = {}) => {
  const y = opts.y ?? groundY(z);
  out.places.push(person(cam, { i, o, okey }, x, y, z, front, { mode: "stand", blink: lidAt(t, i, opts.swaps), ...fo }, {}, opts.scale ?? 1));
  if (opts.blobK !== 0) blob(out, x, y, z, opts.scale ?? 1, opts.blobK ?? 1);
};
/** someone walking along x (side view when seen side-on) */
const walker = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x0: number, z: number, speed: number, expr: Expr = "neutral") => {
  const x = x0 + speed * t, dir = Math.sign(speed) || 1, phase = q(((t * Math.abs(speed)) / 1.4 + hh(i, 5)) % 1, 60), y = groundY(z);
  const view = viewOf(cam, x, z, dir, 0);
  out.places.push(person(cam, { i, o, okey }, x, y, z, view, { mode: "stroll", phase, expr, blink: lidAt(t, i) }, { mode: "march", phase, expr, stomp: 0.55, stride: 0.875 * view.fs, blink: lidAt(t, i) }));
  blob(out, x, y, z);
};
/** runner fleeing along +x toward the camera (front view, fast cadence) */
const runner = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x: number, z: number, expr: Expr = "shock") => {
  const phase = q((t * 2.6 + hh(i, 5)) % 1, 30);
  out.places.push(person(cam, { i, o, okey }, x, groundY(z), z, front, { mode: "march", phase, lift: 70, expr, look: 0, tilt: -4 + 3 * hh(i), blink: 0 }));
  blob(out, x, groundY(z), z);
};
/** brown splash crowns along the wave front (street) */
const frontSplash = (out: Stage, t: number, fx: number, H: number) => {
  for (let k = 0; k < 5; k++) {
    const z = -5.5 + k * 2.8 + (hh(k, 3) - 0.5), u = q(((t * 1.4 + hh(k, 4)) % 1), 20);
    out.fx.push({ key: `msplash${u}|${k % 3}`, cw: 600, ch: 400, draw: (p) => fxMolSplash(p, u, k % 3), x: fx + 1.2, y: 1.0 + H * 0.82, z, w: 4.2, h: 2.8 });
  }
};
const zWall = (x: number) => TANK[2] + Math.sqrt(Math.max(0, TANK_R * TANK_R - (x - TANK[0]) ** 2));

// ---------------- the shots ----------------
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => NEIGHBOR(v));
const hook = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const ts = SHOTS[0].tau(t), F = frontX(ts), H = crestH(ts);
  frontSplash(out, t, F, H);
  // the horse gallops ahead of the wave, which slowly gains on it
  const hx = horseX(f), ph = q((t * 2.2) % 1, 24), mirror = cam.right.x < 0;
  const light = light2D(cam, mirror);
  out.places.push({ key: `horse|${ph}|${q(light)}`, x: hx, y: 0, z: 0.6, scale: 1.9, mirror, draw: (p) => horseSide(p, ph, light), size: [720, 1200, 1.2] });
  blob(out, hx, 0, 0.6, 2.2);
  // people running ahead of it
  const spots: [number, number][] = [[6, -2.5], [8.5, 3.2], [11, -0.6], [13.5, 4.6], [15.5, -4.2], [17.5, 1.4]];
  spots.forEach(([dx, z], i) => runner(out, cam, t, 10 + i, FOLK[i % 6], `n${i % 6}`, F + dx + 0.3 * t, z));
};
const setting = (out: Stage, cam: CamInfo, t: number) => {
  stand(out, cam, t, 3, FOLK[3], "n3", 5.4, zWall(5.4) + 1.3, { expr: "smile", look: 0 });
  walker(out, cam, t, 4, FOLK[4], "n4", -30, 8.6, 1.1);
  walker(out, cam, t, 5, FOLK[5], "n5", 20, 8.9, -1.0);
  walker(out, cam, t, 6, WORKER(0), "w0", -10, -8.7, 1.2);
};
/** drips falling from the seams into the buckets: [x, y top] -> lands at y bottom */
const drips = (out: Stage, t: number, list: [number, number, number, number][]) => {
  list.forEach(([x, y0, y1, z], i) => {
    const per = 0.9 + 0.3 * hh(i, 2), u = ((t + hh(i, 3) * per) % per) / per, y = y0 - (y0 - y1) * u * u;
    out.fx.push({ key: "drip", cw: 100, ch: 160, draw: fxDrip, x, y, z, w: 0.07, h: 0.11 });
  });
};
const leaks = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const fill = smooth((f - 402) / 56);
  const xs = [-2.7, -0.3, 2.3], exprs: Expr[] = ["grin", "smile_closed", "smile"];
  xs.forEach((x, i) => {
    const z = zWall(x) + 0.42;
    stand(out, cam, t, 20 + i, FOLK[[0, 3, 4][i]], `n${[0, 3, 4][i]}`, x, z, { expr: exprs[i], prop: ["bucket", i === 1 ? q(fill, 30) : 0.6], facing: 0 });
  });
  drips(out, t, xs.map((x) => [x + 0.105, 2.2, 0.84, zWall(x) + 0.39] as [number, number, number, number]));
};
const painting = (out: Stage, cam: CamInfo, t: number, f: number, st: State) => {
  // the boss: smug, shrugs on "fix?"
  const shrug = f >= 470 && f < 504;
  stand(out, cam, t, 30, BOSS, "boss", 4.3, -16.6, { expr: shrug ? "smile_closed" : "smile", prop: shrug ? "shrug" : null }, { swaps: [470 / FPS] });
  // painters on the swing stage, which rises with the paint line
  const py = Math.max(0, st.tank.paintH - 1.15);
  if (f >= 480 && f < 537) [-2.6, 0.1, 2.7].forEach((x, i) => {
    const z = zWall(x) + 0.55, br = q((t * 2.2 + i * 0.3) % 1, 24);
    out.places.push(person(cam, { i: 31 + i, o: PAINTER, okey: "painter" }, x, py + 0.12, z, front, { mode: "stand", expr: i === 1 ? "whistle" : "neutral", prop: ["brush", br], blink: lidAt(t, 31 + i) }));
  });
  // a neighbour squints at the painted seam
  if (f >= 537) stand(out, cam, t, 21, FOLK[3], "n3", -0.95, zWall(-0.95) + 1.25, { expr: "stern", look: -1, prop: ["bucket", 0.2] });
  if (f >= 537) drips(out, t, [[-0.62, 2.0, 0.2, zWall(-0.62) + 0.05]]);
};
const january = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const lvl = 0.1 + 0.55 * smooth((f - 638) / 20);
  out.fx.push({ key: `thermo${q(lvl, 60)}`, cw: 200, ch: 700, draw: (p) => fxThermo(p, lvl), x: THERMO[0], y: THERMO[1], z: THERMO[2] - 0.03, w: 0.2, h: 0.7, face: true });
  walker(out, cam, t, 40, FOLK[1], "n1", 0, 8.6, 0.9);
  walker(out, cam, t, 41, FOLK[2], "n2", 26, 8.8, -1.1);
  walker(out, cam, t, 42, WORKER(1), "w1", 30, -8.6, -1.3);
  stand(out, cam, t, 43, FOLK[0], "n0", 12, -8.6, { expr: "smile", prop: ["bucket", 0.4] });
};
const groan = (out: Stage, cam: CamInfo, t: number, f: number) => {
  // strain ticks on the wall + neighbours on the street turning to look
  if (f < 705) {
    const pts: V3[] = [[-5, 3, zWall(-5) + 0.3], [4, 6, zWall(4) + 0.3], [0, 9, zWall(0) + 0.3]];
    pts.forEach(([x, y, z], i) => { const u = q((t * 1.3 + i * 0.37) % 1, 30); out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: 1.4, h: 1.4, rot: i * 0.6 - 0.6 }); });
    stand(out, cam, t, 50, FOLK[0], "n0", 4.2, -9.0, { expr: "nervous", look: -1, prop: ["bucket", 0.6] });
    stand(out, cam, t, 51, FOLK[1], "n1", 2.6, -8.7, { expr: "nervous" });
  }
  // rivets: each pops with a spark and flies out toward the street
  RIVETS.forEach((t0, i) => {
    const dt = t - t0, x = 0.4 + [-0.3, 0.2, -0.1, 0.35, -0.25, 0.3][i], y = 5 + (i % 2 ? 0.12 : -0.12), z = zWall(x) + 0.03;
    if (dt >= 0 && dt < 0.25) { const u = q(dt / 0.25, 30); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x, y, z: z + 0.05, w: 0.55, h: 0.55 }); }
    if (dt >= 0 && dt < 0.7) out.fx.push({ key: "rivet", cw: 64, ch: 64, draw: fxDot, x: x + dt * (i % 2 ? 1.6 : -1.4), y: y + 2.5 * dt - 4.9 * dt * dt, z: z + 7 * dt, w: 0.07, h: 0.07 });
  });
};
const lunch = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const look = f >= 794;
  [-11.4, -10.4, -9.4].forEach((x, i) => {
    const expr: Expr = look ? "shock" : (["grin", "smile", "smile_closed"] as Expr[])[i];
    out.places.push(person(cam, { i: 60 + i, o: WORKER(i), okey: `w${i}` }, x, 0.33, -9.25, front, { mode: "sit", expr, prop: look ? null : "sandwich", look: 0, blink: lidAt(t, 60 + i, [794 / FPS]) }));
  });
  if (f >= 817) {
    const u = q(clamp01((t - W.split) / 0.25), 30);
    if (u < 1) out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 12), x: TANK[0], y: 9, z: zWall(0) + 1, w: 9, h: 9 });
  }
};
const wave = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const ts = SHOTS[7].tau(t), F = frontX(ts), H = crestH(ts);
  if (f < 970) {
    frontSplash(out, t, F, H);
    const spots: [number, number][] = [[6, -2.2], [9, 2.8], [12.5, -4.8], [15, 0.6], [19, 4.4], [22, -1.6]];
    spots.forEach(([dx, z], i) => runner(out, cam, t, 70 + i, FOLK[(i + 2) % 6], `n${(i + 2) % 6}`, F + dx, z, i % 2 ? "shock" : "nervous"));
    if (f >= 899) {
      const hx = F + 8, ph = q((t * 2.2) % 1, 24), mirror = cam.right.x < 0, light = light2D(cam, mirror);
      out.places.push({ key: `horse|${ph}|${q(light)}`, x: hx, y: 0, z: 3.5, scale: 1.9, mirror, draw: (p) => horseSide(p, ph, light), size: [720, 1200, 1.2] });
    }
  }
};
/** rescuers stuck in the setting molasses (legs hidden by the sheet) */
const stuck = (out: Stage, cam: CamInfo, t: number, list: [number, number, Expr, number][], st: State) => {
  list.forEach(([x, z, expr, i]) => {
    const fl = floodH(st.flood, x, z), sink = Math.min(0.12, fl * 0.2);
    const ph = q((t * 0.8 + hh(i)) % 1, 24);
    out.places.push(person(cam, { i, o: SAILOR(i), okey: `sailor${i % 4}` }, x, -sink - 0.22, z, front, { mode: "stand", expr, prop: "shrug", phase: ph, tilt: -7 + 5 * Math.sin(t * 2.2 + i), blink: lidAt(t, i) }));
  });
};
const kitchen = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const K = KITCHEN;
  let prop: FrontOpts["prop"] = null, expr: Expr = "smile";
  if (f >= 1285 && f < 1360) { prop = ["honey", q(smooth((f - 1290) / 18), 30)]; expr = "smile_closed"; }
  if (f >= 1360) { prop = ["honeyCold", q(smooth((f - 1362) / 12), 20)]; expr = f > 1392 ? "nervous" : "neutral"; }
  out.places.push(person(cam, { i: 90, o: MODERN, okey: "modern" }, K[0] - 0.3, 0, K[2] - 0.5, front, { mode: "stand", expr, prop, look: f > 1392 ? -1 : 0, blink: lidAt(t, 90, [1288 / FPS, 1362 / FPS]) }));
  // the microwave pings
  if (f >= 1281 && f < 1290) { const u = q((f - 1281) / 9, 9); out.fx.push({ key: `burstS${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 8, 30, 160), x: K[0] + 1.55, y: 1.15, z: K[2] - 0.8, w: 0.5, h: 0.5 }); }
};
const court = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const C = COURT;
  if (f < 1656) {
    stand(out, cam, t, 100, BOSS, "bossbags", C[0] + 0.3, C[2] + 3.2, { expr: f > 1630 ? "pained" : "nervous", prop: "bags" });
    stand(out, cam, t, 101, FOLK[2], "n2", C[0] - 2.2, C[2] + 5.4, { expr: "smile_closed" });
    stand(out, cam, t, 102, FOLK[5], "n5", C[0] + 3.4, C[2] + 6.2, { expr: "stern" });
    walker(out, cam, t, 103, FOLK[1], "n1", C[0] - 60, C[2] + 10, 1.1);
  }
};
const engineer = (out: Stage, cam: CamInfo, t: number, f: number) => {
  if (f < 1748) {
    stand(out, cam, t, 110, ENGINEER, "eng", 3.2, -16.3, { expr: "stern", prop: "clipboard", look: 0 });
    stand(out, cam, t, 111, WORKER(2), "w2", 0.6, -15.8, { expr: "smile" });
  } else {
    const k = q(clamp01((f - 1748) / 50), 60);
    out.fx.push({ key: `clip${k}`, cw: 520, ch: 700, draw: (p) => fxClipboard(p, k), x: 3.35, y: 1.42, z: -15.92, w: 0.27, h: 0.363, face: true });
  }
};
const summer = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const spots: [number, number, number][] = [[-4.4, -6.2, 0], [-6.5, -4.8, 1], [3.2, -5.4, 2], [7.5, 8.6, 3], [-1.2, 8.8, 4], [12, -8.6, 5]];
  spots.forEach(([x, z, v], i) => {
    const sniff = (t * 0.6 + hh(i)) % 1 < 0.6 || f >= 1860;
    stand(out, cam, t, 120 + i, SUMMER(v), `sum${v}`, x, z, { expr: sniff ? "smile_closed" : "smile", prop: sniff ? "sniff" : null, headTilt: sniff ? -6 : 0 });
    const u = q((t * 0.35 + hh(i, 2)) % 1, 40);
    out.fx.push({ key: `smell${u}`, cw: 300, ch: 600, draw: (p) => fxSmell(p, u), x: x + 0.35, y: 0.9 + 0.5 * u, z: z + 0.1, w: 0.5, h: 1.0, soft: true });
  });
};
const callback = (out: Stage, cam: CamInfo, t: number, f: number, st: State) => {
  const x = 27.2, z = 1.6, fl = floodH(st.flood, x, z);
  const stretch = clamp01((f - 2008) / 30);
  out.places.push(person(cam, { i: 130, o: FOLK[0], okey: "n0" }, x, -Math.min(0.1, fl * 0.2), z, front,
    { mode: "stand", expr: f > 1998 ? "stern" : "neutral", prop: ["bucketUp", q(stretch, 30)], look: 0, blink: lidAt(t, 130, [1998 / FPS]) }));
  // the drop: stretches off the rim on "slow", lets go, falls into the sheet
  // rim of the raised pail (toon.ts bucketUp: right hand ~ +181 units across, rim ~ 352 units down the card)
  const rimY = -Math.min(0.1, fl * 0.2) + (975 - 352) * SU, bx = x + cam.right.x * 0.39, bz = z + cam.right.z * 0.39 + 0.02;
  if (f >= 2008 && f < 2038) out.fx.push({ key: `drop${q(stretch, 30)}`, cw: 120, ch: 300, draw: (p) => fxDrop(p, stretch), x: bx, y: rimY - 0.2, z: bz, w: 0.1, h: 0.25 });
  if (f >= 2038 && f < 2046) { const dt = (f - 2038) / FPS; out.fx.push({ key: "drip", cw: 100, ch: 160, draw: fxDrip, x: bx, y: rimY - 0.4 - 4.9 * dt * dt * 6, z: bz, w: 0.09, h: 0.14 }); }
};

/** everything with a face in shot `id` at frame f */
export const stage = (id: number, f: number, st: State, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], t = f / FPS;
  LNAME = s.light;
  if (cam.sun) SUN.copy(cam.sun).normalize();
  switch (id) {
    case 1: hook(out, cam, t, f); break;
    case 2: setting(out, cam, t); break;
    case 3: leaks(out, cam, t, f); break;
    case 4: painting(out, cam, t, f, st); break;
    case 5: january(out, cam, t, f); break;
    case 6: groan(out, cam, t, f); break;
    case 7: lunch(out, cam, t, f); break;
    case 8: wave(out, cam, t, f); break;
    case 9: stuck(out, cam, t, [[27.0, -0.4, "nervous", 140], [28.5, -1.3, "pained", 141], [12, -3, "nervous", 142], [-8, 2, "pained", 143]], st); break;
    case 10: kitchen(out, cam, t, f); break;
    case 11: stuck(out, cam, t, [[-27.3, 0.0, "pained", 150], [-25.6, -1.0, "nervous", 151], [-10, -2, "pained", 152], [8, 1, "nervous", 153]], st); break;
    case 13: court(out, cam, t, f); break;
    case 14: engineer(out, cam, t, f); break;
    case 15: summer(out, cam, t, f); break;
    case 16: callback(out, cam, t, f, st); break;
  }
  return out;
};
export { FPS };
