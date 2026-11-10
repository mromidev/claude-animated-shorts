// One three.js world for the Taj Mahal short, posed every frame from story.ts. Sets live far apart on the x axis:
// the Taj complex at the origin (garden +z, river -z, Agra Fort across it), the Burhanpur room, Makrana quarry +
// desert, the courtyard with the charpai, the fort corridor, the crypt. Characters are camera-facing Canvas2D cards.
import * as THREE from "three";
import { Pen, fxPuff } from "./toon";
import { NOINK } from "./ink";
import { drawPlan, drawInlay, drawJali, Pose } from "./chars";
import { Person, Elephant, Camel, FigPose } from "./figures";
import {
  V3, L, W, Light, PALACE, QUARRY, YARD, FORTIN, CRYPT, Y_TER, Y_PL, PL, TOMB, CHAMF, WALL_H, ROOF, MINARETS, RIVER_Z0, RIVER_Z1,
  FORT, TO_TAJ, RAMP_Z0, RAMP_Z1, RAMP_H, rampY, elephantZ, camelX, camAt, shotAt, buildAt, leanAt, fallAt, quakeAt, centreLineAt,
  sjGlowAt, lampAt, planAt, inlayAt, stickAt, doorAt, blinkAt, clamp01, smooth, lerp, add3, scale3,
} from "./story";

// ---------------- helpers ----------------
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const col = (c: string) => new THREE.Color(c);
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const GRAD = (() => {
  const d = new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (c: string | THREE.Color, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...extra });
void GRAD;
const noink = <T extends THREE.Object3D>(o: T) => { o.traverse((c) => c.layers.set(NOINK)); return o; };
const shadowed = <T extends THREE.Object3D>(o: T, cast = true) => { o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = cast; c.receiveShadow = true; } }); return o; };
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); return b; };
const INKC = "#a39888";

/** pointed (four-centred-ish) arch outline, base y0, springing at ys, apex at ya, half-width w; canvas coords */
const archPath = (g: CanvasRenderingContext2D, cx: number, y0: number, w: number, ys: number, ya: number) => {
  g.beginPath(); g.moveTo(cx - w, y0); g.lineTo(cx - w, ys);
  g.quadraticCurveTo(cx - w, ya + (ys - ya) * 0.15, cx, ya);
  g.quadraticCurveTo(cx + w, ya + (ys - ya) * 0.15, cx + w, ys);
  g.lineTo(cx + w, y0); g.closePath();
};
const marbleBase = (g: CanvasRenderingContext2D, w: number, h: number, a = "#f6f2ea", b = "#e9e3d8") => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
};
const recessArch = (g: CanvasRenderingContext2D, cx: number, y0: number, w: number, ys: number, ya: number, deep = "#8a8697", mid = "#b9b5c2", frame = "#d8d2c6") => {
  archPath(g, cx, y0, w * 1.12, ys, ya - w * 0.14); g.fillStyle = frame; g.fill(); g.strokeStyle = INKC; g.lineWidth = Math.max(2, w * 0.05); g.stroke();
  archPath(g, cx, y0, w, ys, ya);
  const gr = g.createLinearGradient(0, ya, 0, y0); gr.addColorStop(0, deep); gr.addColorStop(1, mid);
  g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(2, w * 0.06); g.stroke();
};
const panel = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, lw: number) => {
  g.strokeStyle = "#cfc6b6"; g.lineWidth = lw * 3; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = INKC; g.lineWidth = lw; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
};
/** abstract inscription band: tiny dark strokes (never letters) */
const band = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number) => {
  const r = rng(seed); g.strokeStyle = "#3b3640"; g.lineWidth = 2.5;
  const horiz = x1 - x0 > y1 - y0;
  const n = Math.floor((horiz ? x1 - x0 : y1 - y0) / 9);
  for (let i = 0; i < n; i++) {
    g.beginPath();
    if (horiz) { const x = x0 + i * 9 + r() * 3; g.moveTo(x, y1 - 2); g.lineTo(x + r() * 4, y0 + 2 + r() * (y1 - y0) * 0.5); }
    else { const y = y0 + i * 9 + r() * 3; g.moveTo(x0 + 2, y); g.lineTo(x0 + 2 + r() * (x1 - x0) * 0.5, y + r() * 4); }
    g.stroke();
  }
};

// ---------------- light presets ----------------
type Look = {
  sunCol: string; sunI: number; az: number; el: number; hemiSky: string; hemiGround: string; hemiI: number;
  skyTop: string; skyHor: string; fog: [number, number]; card: [number, number, number];
  grade: [number, number, number, [number, number, number], [number, number, number], number];
};
const LOOKS: Record<Exclude<Light, "timelapse">, Look> = {
  day: { sunCol: "#fff1d8", sunI: 3.1, az: 70, el: 46, hemiSky: "#cfe2ff", hemiGround: "#b9a77f", hemiI: 1.25, skyTop: "#3e7fd2", skyHor: "#bcd4ee", fog: [90, 620], card: [1, 1, 0.98], grade: [1.0, 1.06, 1.1, [0, 0.01, 0.03], [0.02, 0.01, -0.01], 0.18] },
  golden: { sunCol: "#ffb36b", sunI: 3.4, az: 125, el: 11, hemiSky: "#a8a0d8", hemiGround: "#c99a6a", hemiI: 1.15, skyTop: "#6f6aa0", skyHor: "#ffc47c", fog: [70, 520], card: [1.0, 0.9, 0.8], grade: [1.02, 1.08, 1.12, [0.02, 0.0, 0.05], [0.05, 0.02, -0.03], 0.24] },
  dusk: { sunCol: "#ff9a5a", sunI: 2.6, az: 150, el: 6, hemiSky: "#7f78c0", hemiGround: "#8a6a6a", hemiI: 1.1, skyTop: "#41457e", skyHor: "#f09a68", fog: [70, 480], card: [0.92, 0.78, 0.72], grade: [1.0, 1.08, 1.06, [0.02, 0.0, 0.07], [0.05, 0.01, -0.02], 0.3] },
  night: { sunCol: "#9fb4ff", sunI: 0.55, az: 40, el: 35, hemiSky: "#3d4c86", hemiGround: "#2a2238", hemiI: 0.55, skyTop: "#0d1630", skyHor: "#27325c", fog: [40, 300], card: [0.66, 0.62, 0.66], grade: [1.0, 1.05, 0.92, [0.0, 0.01, 0.06], [0.03, 0.01, -0.01], 0.36] },
  morning: { sunCol: "#ffe2b0", sunI: 2.8, az: 60, el: 30, hemiSky: "#ffe6c8", hemiGround: "#a07a5a", hemiI: 1.3, skyTop: "#7fb0e6", skyHor: "#ffe2b8", fog: [60, 400], card: [1.0, 0.96, 0.9], grade: [1.02, 1.06, 1.08, [0.01, 0.01, 0.02], [0.04, 0.02, -0.01], 0.22] },
  crypt: { sunCol: "#ffd9a8", sunI: 0.35, az: 40, el: 60, hemiSky: "#e8d8c0", hemiGround: "#6a5a4a", hemiI: 0.75, skyTop: "#1a1a28", skyHor: "#3a3440", fog: [40, 200], card: [0.86, 0.78, 0.7], grade: [1.0, 1.08, 1.0, [0.02, 0.01, 0.04], [0.05, 0.02, -0.01], 0.34] },
};
const mixLook = (a: Look, b: Look, k: number): Look => {
  const c = (x: string, y: string) => "#" + col(x).lerp(col(y), k).getHexString();
  const n = (x: number, y: number) => lerp(x, y, k);
  const v = (x: number[], y: number[]) => x.map((xx, i) => n(xx, y[i])) as [number, number, number];
  return {
    sunCol: c(a.sunCol, b.sunCol), sunI: n(a.sunI, b.sunI), az: n(a.az, b.az), el: n(a.el, b.el), hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround),
    hemiI: n(a.hemiI, b.hemiI), skyTop: c(a.skyTop, b.skyTop), skyHor: c(a.skyHor, b.skyHor), fog: [n(a.fog[0], b.fog[0]), n(a.fog[1], b.fog[1])], card: v(a.card, b.card),
    grade: [n(a.grade[0], b.grade[0]), n(a.grade[1], b.grade[1]), n(a.grade[2], b.grade[2]), v(a.grade[3], b.grade[3]), v(a.grade[4], b.grade[4]), n(a.grade[5], b.grade[5])],
  };
};
export const lookAt = (t: number): Look => {
  const s = shotAt(t);
  if (s.light !== "timelapse") return LOOKS[s.light];
  const k = 0.5 - 0.5 * Math.cos((t - L[7]) * Math.PI * 2 * 1.6);
  return mixLook(LOOKS.day, LOOKS.night, k * (1 - smooth((t - L[8] + 0.35) / 0.3)));
};

// ---------------- card actors ----------------
type Fig = { kind: "person" | "elephant" | "camel"; who: string; pose: FigPose; phase?: number; seed?: number; yaw?: number; facing?: number };
type Actor = { fig?: Fig; key: string; draw: (p: Pen) => void; tw: number; th: number; dw: number; dh: number; pos: V3; w: number; h: number; mode?: "yaw" | "full"; heading?: V3; shadow?: number; add?: boolean; light?: number };
type Slot = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; shadow: THREE.Mesh };
const PERSON_H = 1.9;

export class World {
  root = new THREE.Group();
  sun = new THREE.DirectionalLight("#fff1d6", 3.0);
  hemi = new THREE.HemisphereLight("#cfe8ff", "#b9a77f", 1.3);
  fog = new THREE.Fog("#bcd4ee", 90, 620);
  skyMat!: THREE.ShaderMaterial; sky!: THREE.Mesh; clouds: THREE.Mesh[] = [];
  water!: THREE.ShaderMaterial;
  // Taj parts
  walls = new THREE.Group(); cap!: THREE.Mesh; drum!: THREE.Mesh; dome!: THREE.Group; finial!: THREE.Group; chhatris = new THREE.Group();
  plinth = new THREE.Group(); minarets: THREE.Group[] = []; ghosts: THREE.Group[] = []; scaffold!: THREE.InstancedMesh; ghostMat!: THREE.MeshBasicMaterial;
  garden = new THREE.Group(); site!: THREE.Mesh; ramp = new THREE.Group(); blocks: THREE.Group[] = []; centre!: THREE.Mesh;
  // other sets
  lamp!: THREE.PointLight; cryptLamp!: THREE.PointLight; fortLamp!: THREE.PointLight; windowPane!: THREE.MeshBasicMaterial;
  planMesh!: THREE.Mesh; table!: THREE.Mesh; inlayMesh!: THREE.Mesh; stick!: THREE.Group; doors: THREE.Group[] = []; cryptLine!: THREE.Mesh; sjTomb!: THREE.MeshStandardMaterial;
  people: THREE.Group[] = []; rigs: Person[] = []; eles: Elephant[] = []; camels: Camel[] = [];
  slots: Slot[] = []; texCache = new Map<string, THREE.CanvasTexture>(); blob!: THREE.Texture;

  constructor() {
    this.root.add(this.sun, this.sun.target, this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.buildSky();
    this.buildTajGround();
    this.buildTaj();
    this.buildComplex();
    this.buildRiverAndFort();
    this.buildConstruction();
    this.buildPalace();
    this.buildQuarry();
    this.buildYard();
    this.buildFortIn();
    this.buildCrypt();
    this.buildSlots(64);
  }

  // ---------- sky ----------
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: col("#3e7fd2") }, uHor: { value: col("#bcd4ee") }, uSun: { value: new THREE.Vector3(0.3, 0.5, -0.8).normalize() }, uSunCol: { value: col("#fff2c4") } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
          vec3 c = mix(uHor, uTop, pow(smoothstep(0.0, 0.6, h), 0.75));
          float s = max(dot(d, uSun), 0.0); c += uSunCol * (pow(s, 900.0) * 2.5 + pow(s, 10.0) * 0.22);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.root.add(noink(this.sky));
    const ctex = canvasTex(512, 256, (g) => {
      const r = rng(5);
      for (let i = 0; i < 16; i++) {
        const x = 90 + r() * 330, y = 150 - r() * 60 + (Math.abs(x - 256) / 256) * 40, rad = 40 + r() * 50;
        const gr = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.8, "#f4f6ff"); gr.addColorStop(1, "rgba(220,228,255,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
    });
    const r = rng(9);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + r() * 0.3, el = 0.07 + r() * 0.15, d = 600;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(300 + r() * 140, 150), new THREE.MeshBasicMaterial({ map: ctex, transparent: true, depthWrite: false, fog: false }));
      m.position.set(Math.sin(a) * d * Math.cos(el), Math.sin(el) * d, Math.cos(a) * d * Math.cos(el));
      m.lookAt(0, m.position.y * 0.6, 0); m.renderOrder = -9;
      this.clouds.push(m); this.root.add(noink(m));
    }
  }

  // ---------- Taj ground: built garden vs bare site ----------
  buildTajGround() {
    // the far land (both banks), dusty green
    const land = toon("#a9b46e");
    const south = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), land); south.rotation.x = -Math.PI / 2; south.position.set(0, -0.02, RIVER_Z0 + 250); south.receiveShadow = true;
    const north = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), toon("#b7b07a")); north.rotation.x = -Math.PI / 2; north.position.set(0, -0.02, RIVER_Z1 - 250); north.receiveShadow = true;
    this.root.add(south, north);
    // sand strip between terrace and river
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(900, 12), toon("#d9c49a")); sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.01, RIVER_Z0 + 5); sand.receiveShadow = true; this.root.add(sand);
    // the charbagh garden (texture), z 14 .. 108, x -50 .. 50
    const gW = 100, gD = 94, z0 = 14;
    const tex = canvasTex(1024, 964, (g) => {
      const sx = 1024 / gW, sz = 964 / gD, X = (x: number) => (x + 50) * sx, Z = (z: number) => (z - z0) * sz;
      g.fillStyle = "#d8c7a0"; g.fillRect(0, 0, 1024, 964); // walkways
      const r = rng(3);
      const bed = (x0: number, x1: number, za: number, zb: number) => {
        g.fillStyle = "#5f9e45"; g.fillRect(X(x0), Z(za), X(x1) - X(x0), Z(zb) - Z(za));
        for (let i = 0; i < 160; i++) { g.fillStyle = ["rgba(80,150,60,0.5)", "rgba(120,180,70,0.4)", "rgba(60,120,50,0.4)"][i % 3]; g.beginPath(); g.ellipse(X(x0) + r() * (X(x1) - X(x0)), Z(za) + r() * (Z(zb) - Z(za)), 6 + r() * 14, 4 + r() * 9, r() * 3, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = "#3f6a32"; g.lineWidth = 3; g.strokeRect(X(x0), Z(za), X(x1) - X(x0), Z(zb) - Z(za));
        for (let i = 0; i < 26; i++) { g.fillStyle = ["#e85d6f", "#f2c94c", "#ffffff", "#c06bd8"][i % 4]; g.beginPath(); g.arc(X(x0) + 4 + r() * (X(x1) - X(x0) - 8), Z(za) + 4 + r() * (Z(zb) - Z(za) - 8), 2.5, 0, Math.PI * 2); g.fill(); }
      };
      for (const [xa, xb] of [[-47, -27], [-23, -4], [4, 23], [27, 47]] as const) for (const [za, zb] of [[17, 37], [41, 56], [64, 82], [86, 105]] as const) bed(xa, xb, za, zb);
    });
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(gW, gD), toon("#ffffff", { map: tex }));
    gm.rotation.x = -Math.PI / 2; gm.position.set(0, 0.01, z0 + gD / 2); gm.receiveShadow = true;
    this.garden.add(gm);
    // water channels + central tank
    const water = toon("#5fb3d9", { emissive: "#2a6f9a", emissiveIntensity: 0.18 });
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 88), water); ch.rotation.x = -Math.PI / 2; ch.position.set(0, 0.05, 61); this.garden.add(ch);
    const cx = new THREE.Mesh(new THREE.PlaneGeometry(96, 2.6), water); cx.rotation.x = -Math.PI / 2; cx.position.set(0, 0.05, 60); this.garden.add(cx);
    const marble = toon("#f2eee6");
    for (const s of [-1, 1]) { this.garden.add(shadowed(box(0.35, 0.25, 88, marble, s * 1.68, 0, 61), false)); this.garden.add(shadowed(box(96, 0.25, 0.35, marble, 0, 0, 60 + s * 1.48), false)); }
    const tank = shadowed(box(9, 0.6, 9, marble, 0, 0, 60)); this.garden.add(tank);
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.6), water); tw.rotation.x = -Math.PI / 2; tw.position.set(0, 0.62, 60); this.garden.add(tw);
    // cypress rows
    const cone = new THREE.ConeGeometry(0.75, 4.6, 10); cone.translate(0, 2.3 + 0.4, 0);
    const pos: V3[] = [];
    for (let z = 19; z < 106; z += 4.5) { if (Math.abs(z - 60) < 6) continue; pos.push([-3.6, 0, z], [3.6, 0, z]); }
    for (let x = -46; x <= 46; x += 5) { if (Math.abs(x) < 7) continue; pos.push([x, 0, 57.2], [x, 0, 62.8]); }
    const cy = new THREE.InstancedMesh(cone, toon("#2f6b3a"), pos.length);
    const M = new THREE.Matrix4();
    pos.forEach((p, i) => { const s = 0.9 + ((i * 37) % 10) / 40; M.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); cy.setMatrixAt(i, M); });
    shadowed(cy); this.garden.add(cy);
    // garden walls (red sandstone) + the great gate
    const red = this.redMat();
    this.garden.add(shadowed(box(0.8, 3.2, 98, red, -50, 0, 63)), shadowed(box(0.8, 3.2, 98, red, 50, 0, 63)));
    this.garden.add(this.buildGate());
    this.root.add(this.garden);
    // bare construction site ground (shown while building)
    this.site = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), toon("#b89a6a"));
    this.site.rotation.x = -Math.PI / 2; this.site.position.set(0, 0.02, 40); this.site.receiveShadow = true;
    this.root.add(this.site);
  }

  redMat() {
    const tex = canvasTex(512, 512, (g) => {
      g.fillStyle = "#b5583e"; g.fillRect(0, 0, 512, 512);
      const r = rng(8);
      for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(150,60,40,0.25)" : "rgba(210,120,90,0.2)"; g.fillRect(r() * 512, r() * 512, 10 + r() * 30, 4 + r() * 10); }
      g.strokeStyle = "rgba(245,235,220,0.9)"; g.lineWidth = 6;
      g.strokeRect(24, 24, 464, 464);
      archPath(g, 256, 470, 120, 250, 90); g.stroke();
      g.strokeStyle = INKC; g.lineWidth = 3; g.strokeRect(20, 20, 472, 472);
    }, true);
    return toon("#ffffff", { map: tex });
  }

  buildGate() {
    const g = new THREE.Group();
    const red = toon("#b5583e");
    const face = canvasTex(1024, 800, (c) => {
      c.fillStyle = "#b5583e"; c.fillRect(0, 0, 1024, 800);
      c.strokeStyle = "#f1ebe0"; c.lineWidth = 10; c.strokeRect(250, 70, 524, 730);
      band(c, 262, 82, 762, 112, 4);
      recessArch(c, 512, 800, 190, 380, 150, "#4a2f2a", "#7a4a3a", "#f1ebe0");
      for (const x of [110, 914]) for (const y of [380, 720]) recessArch(c, x, y, 70, y - 150, y - 250, "#5a3a32", "#8a5a46", "#f1ebe0");
      c.strokeStyle = INKC; c.lineWidth = 5; c.strokeRect(4, 4, 1016, 792);
    });
    const front = toon("#ffffff", { map: face });
    const mats = [red, red, red, red, front, front];
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, 20, 10), mats); body.position.set(0, 10, 112); g.add(body);
    for (let i = 0; i < 7; i++) g.add(this.chhatri(0.55, -9 + i * 3, 20, 107.5, "#f4f0e8"));
    for (const s of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 22, 8), red); tw.position.set(s * 13.4, 11, 107.4); g.add(tw);
      g.add(this.chhatri(1.0, s * 13.4, 22, 107.4, "#f4f0e8"));
    }
    return shadowed(g);
  }

  /** small domed kiosk: posts, cap, onion dome, finial */
  chhatri(s: number, x: number, y: number, z: number, c = "#f4f0e8") {
    const g = new THREE.Group(); const m = toon(c);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 1.4 * s, 6), m); p.position.set(Math.cos(a) * 0.75 * s, 0.7 * s, Math.sin(a) * 0.75 * s); g.add(p); }
    const capm = new THREE.Mesh(new THREE.CylinderGeometry(1.05 * s, 0.9 * s, 0.22 * s, 12), m); capm.position.y = 1.5 * s; g.add(capm);
    const prof = [[0.85, 0], [1.0, 0.35], [0.95, 0.7], [0.6, 1.05], [0.25, 1.3], [0.05, 1.5]].map(([r, h]) => new THREE.Vector2(r * s, h * s));
    const d = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), m); d.position.y = 1.6 * s; g.add(d);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.6 * s, 6), toon("#d8b04a")); f.position.y = 3.3 * s; g.add(f);
    g.position.set(x, y, z);
    return g;
  }

  // ---------- the tomb ----------
  buildTaj() {
    const a = TOMB, c = CHAMF;
    const facade = canvasTex(1024, 960, (g) => {
      marbleBase(g, 1024, 960);
      // central pishtaq
      g.fillStyle = "#f8f5ef"; g.fillRect(220, 40, 584, 920);
      panel(g, 220, 40, 804, 960, 5); panel(g, 250, 70, 774, 960, 3);
      band(g, 256, 76, 768, 104, 1); band(g, 256, 104, 284, 960, 2); band(g, 740, 104, 768, 960, 3);
      recessArch(g, 512, 960, 190, 460, 170);
      recessArch(g, 512, 960, 70, 820, 720, "#5a5668", "#7d7a8a");
      g.strokeStyle = "#a6a1ad"; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(400 + i * 56, 640); g.lineTo(380 + i * 66, 470); g.stroke(); }
      // side bays: two storeys of arches
      for (const x of [110, 914]) {
        panel(g, x - 92, 60, x + 92, 470, 3); panel(g, x - 92, 500, x + 92, 950, 3);
        recessArch(g, x, 460, 64, 260, 150); recessArch(g, x, 940, 64, 740, 630);
      }
      g.strokeStyle = INKC; g.lineWidth = 6; g.strokeRect(3, 3, 1018, 954);
    });
    const chamf = canvasTex(352, 960, (g) => {
      marbleBase(g, 352, 960);
      panel(g, 28, 60, 324, 470, 3); panel(g, 28, 500, 324, 950, 3);
      recessArch(g, 176, 460, 100, 260, 130); recessArch(g, 176, 940, 100, 740, 610);
      g.strokeStyle = INKC; g.lineWidth = 6; g.strokeRect(3, 3, 346, 954);
    });
    const fm = toon("#ffffff", { map: facade }), cm = toon("#ffffff", { map: chamf });
    const P: [number, number][] = [[a - c, a], [-(a - c), a], [-a, a - c], [-a, -(a - c)], [-(a - c), -a], [a - c, -a], [a, -(a - c)], [a, a - c]];
    for (let i = 0; i < 8; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 8];
      const w = Math.hypot(x1 - x0, z1 - z0), nx = (z1 - z0) / w, nz = -(x1 - x0) / w;
      const g = new THREE.PlaneGeometry(w, WALL_H); g.translate(0, WALL_H / 2, 0);
      const m = new THREE.Mesh(g, i % 2 === 0 ? fm : cm);
      // (nx, nz) is the outward normal; rotation.y = θ turns the plane's +z normal to (sin θ, cos θ)
      m.rotation.y = Math.atan2(nx, nz);
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true;
      this.walls.add(m);
    }
    // parapet band on top of the walls
    const shape = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
    const parapet = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), toon("#efe9de"));
    parapet.rotation.x = -Math.PI / 2; parapet.position.y = WALL_H;
    this.walls.add(parapet);
    this.walls.position.y = Y_PL;
    this.root.add(this.walls);
    this.cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), toon("#ece6da")); this.cap.rotation.x = -Math.PI / 2; this.cap.position.y = ROOF + 0.51; this.cap.receiveShadow = true;
    this.root.add(this.cap);
    // drum
    const drumTex = canvasTex(1024, 192, (g) => {
      marbleBase(g, 1024, 192);
      for (let i = 0; i < 16; i++) recessArch(g, 32 + i * 64, 176, 18, 110, 70);
      g.strokeStyle = INKC; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 30); g.lineTo(1024, 30); g.stroke();
    }, true);
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 2.0, 40, 1, true), toon("#ffffff", { map: drumTex, side: THREE.DoubleSide }));
    this.drum.position.y = ROOF + 0.5 + 1.0; shadowed(this.drum); this.root.add(this.drum);
    // onion dome
    this.dome = new THREE.Group();
    const prof = [[3.45, 0], [3.95, 0.7], [4.35, 1.9], [4.4, 2.8], [4.15, 4.0], [3.5, 5.2], [2.5, 6.2], [1.4, 7.0], [0.55, 7.6], [0.18, 8.0], [0.0, 8.15]].map(([r, h]) => new THREE.Vector2(r, h));
    const dm = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), toon("#f6f2ea"));
    this.dome.add(dm);
    const lotus = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 24), toon("#e4ddd0")); lotus.rotation.x = Math.PI / 2; lotus.position.y = 7.25; this.dome.add(lotus);
    this.dome.position.y = ROOF + 2.5; shadowed(this.dome); this.root.add(this.dome);
    this.finial = new THREE.Group();
    const gold = toon("#d9b24c", { emissive: "#6a4a10", emissiveIntensity: 0.2 });
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.2, 8), gold); fp.position.y = 1.1; this.finial.add(fp);
    for (const [y, r] of [[0.5, 0.28], [1.0, 0.22], [1.45, 0.17]] as const) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), gold); s.position.y = y; this.finial.add(s); }
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 16, Math.PI), gold); cres.position.y = 2.35; cres.rotation.z = Math.PI; this.finial.add(cres);
    this.finial.position.y = ROOF + 2.5 + 8.1; this.root.add(this.finial);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) this.chhatris.add(this.chhatri(1.25, x * 5.0, ROOF + 0.5, z * 5.0));
    shadowed(this.chhatris); this.root.add(this.chhatris);
    // plinth (white, row of small arches) on the red terrace
    const plTex = canvasTex(1024, 128, (g) => {
      marbleBase(g, 1024, 128, "#f2eee6", "#e2dcd0");
      for (let i = 0; i < 16; i++) recessArch(g, 32 + i * 64, 128, 20, 70, 30, "#9a96a6", "#c4c0cc");
      g.strokeStyle = INKC; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 4); g.lineTo(1024, 4); g.stroke();
    }, true);
    plTex.repeat.set(3, 1);
    const plm = toon("#ffffff", { map: plTex }), plTop = toon("#efeae0");
    const pl = new THREE.Mesh(new THREE.BoxGeometry(2 * PL, Y_PL - Y_TER, 2 * PL), [plm, plm, plTop, plTop, plm, plm]);
    pl.position.y = (Y_PL + Y_TER) / 2; this.plinth.add(pl);
    const ter = new THREE.Mesh(new THREE.BoxGeometry(92, Y_TER, 30), this.redMat()); ter.position.set(0, Y_TER / 2, 0); this.plinth.add(ter);
    shadowed(this.plinth); this.root.add(this.plinth);
    // minarets (pivot at the base for the lean)
    const minaret = (ghost: boolean) => {
      const g = new THREE.Group();
      const m = ghost ? this.ghostMat : toon("#f4f0e8");
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.8, 13.2, 16), m); shaft.position.y = 6.6; g.add(shaft);
      for (const y of [4.4, 8.8, 13.2]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 0.35, 16), m); b.position.y = y; g.add(b);
        if (!ghost) { const rail = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 4, 20), m); rail.rotation.x = Math.PI / 2; rail.position.y = y + 0.45; g.add(rail); }
      }
      const top = this.chhatri(1.0, 0, 13.4, 0, "#f4f0e8");
      if (ghost) top.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = m; });
      g.add(top);
      return g;
    };
    this.ghostMat = new THREE.MeshBasicMaterial({ color: "#a9c4ff", fog: true });
    for (const p of MINARETS) {
      const g = minaret(false); g.position.set(...p); shadowed(g); this.minarets.push(g); this.root.add(g);
      const gh = minaret(true); gh.position.set(...p); gh.visible = false; this.ghosts.push(noink(gh)); this.root.add(gh);
    }
    // centre line for the symmetry beat (drawn high, read from above)
    this.centre = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: "#fff2a8", fog: false, toneMapped: false }));
    this.centre.rotation.x = -Math.PI / 2; this.centre.position.set(0, 24.5, 40); this.root.add(noink(this.centre));
  }

  // ---------- mosque, jawab ----------
  buildComplex() {
    const red = this.redMat();
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.add(box(9, 7.5, 20, red, 0, Y_TER, 0));
      for (const z of [-6, 0, 6]) {
        const prof = [[2.0, 0], [2.4, 0.8], [2.3, 1.7], [1.6, 2.6], [0.6, 3.3], [0.0, 3.6]].map(([r, h]) => new THREE.Vector2(r * (z === 0 ? 1.2 : 0.9), h * (z === 0 ? 1.2 : 0.9)));
        const d = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), toon("#f4f0e8")); d.position.set(0, Y_TER + 7.5, z); g.add(d);
      }
      for (const z of [-10, 10]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 10, 8), toon("#b5583e")); tw.position.set(4.5 * -s, Y_TER + 5, z); g.add(tw); g.add(this.chhatri(0.7, 4.5 * -s, Y_TER + 10, z)); }
      g.position.set(s * 36, 0, 0);
      this.root.add(shadowed(g));
    }
  }

  // ---------- the Yamuna + Agra Fort ----------
  buildRiverAndFort() {
    this.water = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uLight: { value: 1 }, uSky: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(90, 620) } },
      vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform float uLight; uniform vec3 uSky; uniform vec3 uFogCol; uniform vec2 uFog; varying vec3 vW; varying float vD;
        void main(){
          float edge = abs(vW.z - (${((RIVER_Z0 + RIVER_Z1) / 2).toFixed(2)})) / ${((RIVER_Z0 - RIVER_Z1) / 2).toFixed(2)};
          vec3 c = mix(vec3(0.16, 0.42, 0.55), vec3(0.32, 0.62, 0.68), smoothstep(0.4, 1.0, edge));
          c = mix(c, uSky, 0.35);
          float s = sin(vW.x * 0.35 + uTime * 1.2 + sin(vW.z * 0.4) * 1.5) * sin(vW.x * 0.21 - uTime * 0.8 + vW.z * 0.9);
          c += vec3(0.7, 0.85, 0.9) * smoothstep(0.86, 0.98, s) * 0.5;
          c *= uLight;
          c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, vD));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(900, RIVER_Z0 - RIVER_Z1), this.water);
    w.rotation.x = -Math.PI / 2; w.position.set(0, -0.3, (RIVER_Z0 + RIVER_Z1) / 2);
    this.root.add(w);
    // Agra Fort: long red wall with battlements, round bastions, the white tower with the window
    const red = this.redMat(), g = new THREE.Group();
    const dir = new THREE.Vector3(...TO_TAJ), side = new THREE.Vector3(TO_TAJ[2], 0, -TO_TAJ[0]);
    const yaw = Math.atan2(dir.x, dir.z);
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      const p = new THREE.Vector3(...FORT).addScaledVector(side, i * 8).addScaledVector(dir, -2);
      const seg = box(8.2, 14, 4, red, 0, 0, 0); seg.position.set(p.x, 7, p.z); seg.rotation.y = yaw; g.add(seg);
      for (let k = -1; k <= 1; k++) { const m = box(1.3, 1.1, 4.2, red, 0, 0, 0); const q = p.clone().addScaledVector(side, k * 2.6); m.position.set(q.x, 14.55, q.z); m.rotation.y = yaw; g.add(m); }
      if (i % 4 === 0) { const b = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 15, 16), red); b.position.set(p.x + dir.x * 1.5, 7.5, p.z + dir.z * 1.5); g.add(b); }
    }
    // the white tower: octagon base up to y 14, floor, window wall facing the Taj, chhatri roof
    const white = toon("#f2eee6");
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 14, 8), white); tower.position.set(FORT[0], 7, FORT[2]); g.add(tower);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.3, 8), white); floor.position.set(FORT[0], 14.0, FORT[2]); g.add(floor);
    const sh = new THREE.Shape(); sh.moveTo(-4, 0); sh.lineTo(4, 0); sh.lineTo(4, 5); sh.lineTo(-4, 5); sh.lineTo(-4, 0);
    const hole = new THREE.Path(); hole.moveTo(-1.3, 0.75); hole.lineTo(1.3, 0.75); hole.lineTo(1.3, 2.7);
    hole.quadraticCurveTo(1.3, 3.75, 0, 4.15); hole.quadraticCurveTo(-1.3, 3.75, -1.3, 2.7); hole.lineTo(-1.3, 0.75);
    sh.holes.push(hole);
    const ww = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false }), white);
    const wp = new THREE.Vector3(...FORT).addScaledVector(dir, 1.7);
    ww.position.set(wp.x, 14.1, wp.z); ww.rotation.y = yaw + Math.PI; // extrude faces local +z; turn to face back into the room
    ww.position.addScaledVector(side, 0); g.add(ww);
    const roofY = 19.2;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.4, 8), white); roof.position.set(FORT[0], roofY, FORT[2]); g.add(roof);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5, 8), white); p.position.set(FORT[0] + Math.cos(a) * 4.0, 16.6, FORT[2] + Math.sin(a) * 4.0); g.add(p); }
    g.add(this.chhatri(2.6, FORT[0], roofY + 0.2, FORT[2], "#f4f0e8"));
    this.root.add(shadowed(g));
  }

  // ---------- scaffolding, ramp, blocks ----------
  buildConstruction() {
    const n = 40;
    const pole = new THREE.CylinderGeometry(0.06, 0.06, 1, 5); pole.translate(0, 0.5, 0);
    this.scaffold = new THREE.InstancedMesh(pole, toon("#a8834f"), n + 8 * 6);
    this.scaffold.castShadow = true; this.root.add(this.scaffold);
    // the earth ramp (solid wedge)
    const len = Math.hypot(RAMP_Z0 - RAMP_Z1, RAMP_H), ang = Math.atan2(RAMP_H, RAMP_Z0 - RAMP_Z1), thick = 14;
    const rb = new THREE.Mesh(new THREE.BoxGeometry(6, thick, len), toon("#a9824f"));
    rb.rotation.x = ang;
    const zm = (RAMP_Z0 + RAMP_Z1) / 2, ym = RAMP_H / 2;
    rb.position.set(0, ym - (thick / 2) * Math.cos(ang), zm - (thick / 2) * Math.sin(ang));
    this.ramp.add(shadowed(rb));
    // planks laid across the ramp
    const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, 0.08, 0.35), toon("#7a5a3a"), 60);
    const M = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) { const z = RAMP_Z1 + 0.6 + i * ((RAMP_Z0 - RAMP_Z1 - 1.2) / 59); M.compose(new THREE.Vector3(0, rampY(z) + 0.04, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0)), new THREE.Vector3(1, 1, 1)); plank.setMatrixAt(i, M); }
    this.ramp.add(shadowed(plank));
    this.root.add(this.ramp);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.add(shadowed(box(1.9, 0.22, 2.4, toon("#7a5a3a"), 0, 0, 0)));
      g.add(shadowed(box(1.6, 1.25, 1.9, toon("#f3efe8"), 0, 0.22, 0)));
      this.blocks.push(g); this.root.add(g);
    }
  }

  // ---------- Burhanpur room ----------
  buildPalace() {
    const [px, , pz] = PALACE, g = new THREE.Group();
    const wallTex = canvasTex(1024, 512, (c) => {
      c.fillStyle = "#efe2c8"; c.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 4; i++) { recessArch(c, 128 + i * 256, 470, 80, 250, 120, "#c9a77a", "#dcc39a", "#f6ecd8"); }
      c.fillStyle = "#b8323a"; c.fillRect(0, 470, 1024, 42); c.strokeStyle = INKC; c.lineWidth = 4; c.strokeRect(0, 470, 1024, 42);
      for (let i = 0; i < 32; i++) { c.fillStyle = "#e8c45a"; c.beginPath(); c.arc(16 + i * 32, 491, 6, 0, Math.PI * 2); c.fill(); }
    });
    const wm = toon("#ffffff", { map: wallTex, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wm); back.position.set(px, 3, pz - 5); g.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wm); left.rotation.y = Math.PI / 2; left.position.set(px - 6, 3, pz); g.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wm); right.rotation.y = -Math.PI / 2; right.position.set(px + 6, 3, pz); g.add(right);
    const carpet = canvasTex(1024, 1024, (c) => {
      c.fillStyle = "#8a2a32"; c.fillRect(0, 0, 1024, 1024);
      c.strokeStyle = "#e8c45a"; c.lineWidth = 18; c.strokeRect(60, 60, 904, 904);
      c.strokeStyle = "#2c4f9e"; c.lineWidth = 30; c.strokeRect(110, 110, 804, 804);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? "#a8343c" : "#7a2430"; c.beginPath(); c.arc(190 + i * 92, 190 + j * 92, 30, 0, Math.PI * 2); c.fill(); c.fillStyle = "#e8c45a"; c.beginPath(); c.arc(190 + i * 92, 190 + j * 92, 8, 0, Math.PI * 2); c.fill(); }
    });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), toon("#ffffff", { map: carpet })); fl.rotation.x = -Math.PI / 2; fl.position.set(px, 0.01, pz); fl.receiveShadow = true; g.add(fl);
    // window (night blue / morning bright, set per frame)
    this.windowPane = new THREE.MeshBasicMaterial({ color: "#2a3f80", fog: false });
    const win = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.8, 0); s.lineTo(0.8, 0); s.lineTo(0.8, 1.4); s.quadraticCurveTo(0.8, 2.1, 0, 2.4); s.quadraticCurveTo(-0.8, 2.1, -0.8, 1.4); s.lineTo(-0.8, 0); return s; })()), this.windowPane);
    win.position.set(px + 3.9, 1.3, pz - 4.98); g.add(win);
    // bed (divan) with a canopy
    const bed = new THREE.Group();
    bed.add(box(2.6, 0.45, 1.6, toon("#5a3a2a"), 0, 0, 0));
    bed.add(box(2.5, 0.12, 1.5, toon("#e9dcc0"), 0, 0.45, 0));
    bed.add(box(0.5, 0.18, 1.2, toon("#c2385a"), -1.0, 0.57, 0));
    for (const [x, z] of [[-1.25, -0.75], [1.25, -0.75], [-1.25, 0.75], [1.25, 0.75]]) bed.add(box(0.08, 2.4, 0.08, toon("#c9a13a"), x, 0, z));
    bed.add(box(2.6, 0.1, 1.6, toon("#b8323a"), 0, 2.4, 0));
    bed.position.set(px + 2.0, 0, pz - 2.6);
    g.add(bed);
    // lamp on a stand
    const brass = toon("#b8923a");
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.1, 16), brass); lb.position.set(px + 4.0, 0.05, pz - 3.4); g.add(lb);
    const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.0, 10), brass); ls.position.set(px + 4.0, 0.6, pz - 3.4); g.add(ls);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass); bowl.position.set(px + 4.0, 1.14, pz - 3.4); g.add(bowl);
    this.lamp = new THREE.PointLight("#ffb455", 14, 14, 1.6); this.lamp.position.set(px + 4.0, 1.4, pz - 3.3); g.add(this.lamp);
    // low table with the plan
    this.table = box(1.7, 0.75, 1.1, toon("#7a4a2a"), px - 0.5, 0, pz + 0.15); g.add(this.table);
    this.planMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    this.planMesh.rotation.x = -Math.PI / 2; this.planMesh.position.set(px - 0.5, 0.762, pz + 0.15); g.add(noink(this.planMesh));
    this.root.add(shadowed(g, false));
  }

  // ---------- Makrana quarry, desert, inlay workshop ----------
  buildQuarry() {
    const [qx, , qz] = QUARRY, g = new THREE.Group();
    const sand = new THREE.PlaneGeometry(420, 300, 120, 90); sand.rotateX(-Math.PI / 2);
    const sp = sand.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), z = sp.getZ(i), d = Math.hypot(x, z - 10);
      sp.setY(i, smooth((d - 40) / 60) * (3.0 * Math.sin(x * 0.05 + 1) * Math.sin(z * 0.07) + 2.5));
    }
    sand.computeVertexNormals();
    const sm = new THREE.Mesh(sand, toon("#e0c48e")); sm.position.set(qx, 0, qz); sm.receiveShadow = true; g.add(sm);
    const marbleTex = canvasTex(512, 512, (c) => {
      c.fillStyle = "#f4f1ea"; c.fillRect(0, 0, 512, 512);
      const r = rng(4); c.strokeStyle = "#d9d3c9"; c.lineWidth = 3;
      for (let i = 0; i < 14; i++) { c.beginPath(); c.moveTo(r() * 512, 0); c.bezierCurveTo(r() * 512, 170, r() * 512, 340, r() * 512, 512); c.stroke(); }
      c.strokeStyle = "#cfc8bc"; c.lineWidth = 4; for (let y = 0; y < 512; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    }, true);
    const mm = toon("#ffffff", { map: marbleTex });
    for (let k = 0; k < 5; k++) g.add(box(34 - k * 2, 2 + k * 2.2, 3.2, mm, qx, 0, qz - 4 - k * 3.2));
    for (const [x, z, s] of [[-5, 1.5, 1.2], [4.5, 2.4, 1.0], [7, -0.5, 1.4], [-8, -1, 0.9]] as const) { const b = box(s * 1.4, s, s * 1.1, mm, qx + x, 0, qz + z); b.rotation.y = x * 0.2; g.add(b); }
    // inlay workshop: awning, table, slab
    const wx = qx + 20, wz = qz + 10;
    g.add(box(1.6, 0.8, 1.1, toon("#7a4a2a"), wx, 0, wz));
    this.inlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    this.inlayMesh.rotation.x = -Math.PI / 2; this.inlayMesh.position.set(wx, 0.812, wz); g.add(noink(this.inlayMesh));
    for (const [i, c] of ["#c23b2e", "#2c4f9e", "#2f8a5a", "#e0a42a"].entries()) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), toon(c)); s.position.set(wx + 0.62, 0.86, wz - 0.3 + i * 0.18); g.add(s); }
    this.root.add(shadowed(g));
  }

  // ---------- the courtyard with the charpai ----------
  buildYard() {
    const [yx, , yz] = YARD, g = new THREE.Group();
    const earth = canvasTex(512, 512, (c) => { c.fillStyle = "#c9a26e"; c.fillRect(0, 0, 512, 512); const r = rng(2); for (let i = 0; i < 500; i++) { c.fillStyle = r() > 0.5 ? "rgba(150,110,70,0.3)" : "rgba(230,200,150,0.3)"; c.beginPath(); c.ellipse(r() * 512, r() * 512, 4 + r() * 10, 2 + r() * 6, r() * 3, 0, Math.PI * 2); c.fill(); } }, true);
    earth.repeat.set(4, 4);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toon("#ffffff", { map: earth })); fl.rotation.x = -Math.PI / 2; fl.position.set(yx, 0, yz); fl.receiveShadow = true; g.add(fl);
    const mud = canvasTex(512, 256, (c) => { c.fillStyle = "#d9a86a"; c.fillRect(0, 0, 512, 256); c.strokeStyle = "rgba(120,80,40,0.5)"; c.lineWidth = 2; const r = rng(6); for (let i = 0; i < 12; i++) { c.beginPath(); let x = r() * 512, y = r() * 256; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += r() * 20; c.lineTo(x, y); } c.stroke(); } c.fillStyle = "#b8323a"; c.fillRect(0, 0, 512, 14); }, true);
    const wm = toon("#ffffff", { map: mud });
    g.add(box(16, 2.6, 0.5, wm, yx, 0, yz - 3.6), box(0.5, 2.6, 8, wm, yx - 7, 0, yz + 0.4));
    g.add(box(1.2, 2.1, 0.12, toon("#7a4a2a"), yx + 4, 0, yz - 3.32));
    // neem tree
    g.add(box(0.4, 3.2, 0.4, toon("#7a5034"), yx - 4.2, 0, yz - 2.4));
    for (const [x, y, z, s] of [[-4.2, 3.8, -2.4, 1.6], [-3.2, 3.4, -2.0, 1.2], [-5.1, 3.3, -2.7, 1.2], [-4.0, 4.6, -2.6, 1.1]] as const) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 2), toon("#4f9a3a")); b.position.set(yx + x, y, yz + z); g.add(b); }
    // pots by the wall
    for (const [x, c] of [[2.2, "#b8613c"], [2.8, "#a85434"]] as const) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(c)); p.position.set(yx + x, 0.26, yz - 3.0); g.add(p); }
    // charpai: frame, legs, woven top
    const cp = new THREE.Group(), wood = toon("#8a5a34");
    for (const [x, z] of [[-0.95, -0.45], [0.95, -0.45], [-0.95, 0.45], [0.95, 0.45]]) cp.add(box(0.1, 0.46, 0.1, wood, x, 0, z));
    cp.add(box(2.0, 0.08, 0.08, wood, 0, 0.38, -0.45), box(2.0, 0.08, 0.08, wood, 0, 0.38, 0.45), box(0.08, 0.08, 0.98, wood, -0.95, 0.38, 0), box(0.08, 0.08, 0.98, wood, 0.95, 0.38, 0));
    const weave = canvasTex(512, 256, (c) => { c.fillStyle = "#e6d3a6"; c.fillRect(0, 0, 512, 256); c.strokeStyle = "#b89a62"; c.lineWidth = 6; for (let i = -256; i < 512; i += 24) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 256, 256); c.stroke(); c.beginPath(); c.moveTo(i + 256, 0); c.lineTo(i, 256); c.stroke(); } });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 0.84), toon("#ffffff", { map: weave })); top.rotation.x = -Math.PI / 2; top.position.y = 0.42; cp.add(top);
    cp.add(box(0.36, 0.1, 0.5, toon("#f4f1ea"), -0.72, 0.42, 0));
    cp.position.set(yx, 0, yz); g.add(cp);
    // the stick (pivot at its foot, beside the charpai's far end)
    this.stick = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.8, 8), toon("#8a5a2a")); st.position.y = 0.9; this.stick.add(st);
    this.stick.position.set(yx + 1.3, 0, yz + 0.3); g.add(this.stick);
    this.root.add(shadowed(g));
  }

  // ---------- fort corridor + door ----------
  buildFortIn() {
    const [fx, , fz] = FORTIN, g = new THREE.Group(), red = this.redMat();
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), toon("#c9b08a")); fl.rotation.x = -Math.PI / 2; fl.position.set(fx, 0, fz - 3); fl.receiveShadow = true; g.add(fl);
    g.add(box(0.6, 5, 16, red, fx - 3.2, 0, fz - 3), box(0.6, 5, 16, red, fx + 3.2, 0, fz - 3));
    g.add(box(1.9, 5, 0.7, red, fx - 2.25, 0, fz - 4), box(1.9, 5, 0.7, red, fx + 2.25, 0, fz - 4), box(2.6, 1.5, 0.7, red, fx, 3.5, fz - 4));
    g.add(box(7, 5, 0.6, red, fx, 0, fz - 9.5));
    const doorTex = canvasTex(256, 512, (c) => { c.fillStyle = "#6a3e22"; c.fillRect(0, 0, 256, 512); c.strokeStyle = "#4a2a16"; c.lineWidth = 6; for (let x = 32; x < 256; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 512); c.stroke(); } for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.fillStyle = "#c9a13a"; c.beginPath(); c.arc(40 + j * 58, 50 + i * 82, 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = INKC; c.lineWidth = 2; c.stroke(); } c.strokeStyle = INKC; c.lineWidth = 8; c.strokeRect(4, 4, 248, 504); });
    const dm = toon("#ffffff", { map: doorTex });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.4, 0.12), dm); m.position.set(-s * 0.65, 1.7, 0); leaf.add(m);
      leaf.position.set(fx + s * 1.3, 0, fz - 3.8);
      this.doors.push(leaf); g.add(leaf);
    }
    this.fortLamp = new THREE.PointLight("#ffb060", 10, 12, 1.6); this.fortLamp.position.set(fx - 2.2, 2.8, fz - 0.6); g.add(this.fortLamp);
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffd28a", toneMapped: false })); torch.position.copy(this.fortLamp.position); g.add(noink(torch));
    const back = new THREE.PointLight("#9fb4ff", 6, 10, 1.6); back.position.set(fx + 1.5, 3, fz - 7.5); g.add(back);
    this.root.add(shadowed(g, false));
  }

  // ---------- crypt ----------
  buildCrypt() {
    const [cx, , cz] = CRYPT, g = new THREE.Group();
    const wallTex = canvasTex(512, 640, (c) => { marbleBase(c, 512, 640, "#f1ece2", "#ddd6c8"); panel(c, 40, 40, 472, 620, 4); recessArch(c, 256, 610, 150, 300, 110, "#b9b2a6", "#d6d0c4"); band(c, 50, 50, 462, 76, 9); });
    const wm = toon("#ffffff", { map: wallTex });
    const R = 7, side = 2 * R * Math.tan(Math.PI / 8);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const m = new THREE.Mesh(new THREE.PlaneGeometry(side, 6.5), wm); m.position.set(cx + Math.sin(a) * R, 3.25, cz + Math.cos(a) * R); m.rotation.y = a + Math.PI; g.add(m); }
    const floorTex = canvasTex(1024, 1024, (c) => {
      c.fillStyle = "#f2eee6"; c.fillRect(0, 0, 1024, 1024);
      c.strokeStyle = "#cbbfae"; c.lineWidth = 4;
      for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 1024); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(1024, i * 64); c.stroke(); }
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if ((i + j) % 2) { c.fillStyle = "#e4dccd"; c.beginPath(); c.moveTo(i * 64 + 32, j * 64 + 6); c.lineTo(i * 64 + 58, j * 64 + 32); c.lineTo(i * 64 + 32, j * 64 + 58); c.lineTo(i * 64 + 6, j * 64 + 32); c.fill(); }
    });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), toon("#ffffff", { map: floorTex })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0, cz); fl.receiveShadow = true; g.add(fl);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), toon("#e8e1d4")); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, 6.5, cz); g.add(ceil);
    // jali screen
    const jt = canvasTex(512, 512, drawJali);
    const jm = toon("#ffffff", { map: jt, alphaTest: 0.5, side: THREE.DoubleSide });
    const r = 3.1, js = 2 * r * Math.tan(Math.PI / 8);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (i <= 1) continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(js, 1.9), jm); m.position.set(cx + Math.sin(a) * r, 0.95, cz + Math.cos(a) * r); m.rotation.y = a; g.add(m); }
    // cenotaphs: hers on the centre line, his to the west
    const inlay = canvasTex(256, 512, (c) => { c.fillStyle = "#f4f1ea"; c.fillRect(0, 0, 256, 512); c.strokeStyle = INKC; c.lineWidth = 4; c.strokeRect(10, 10, 236, 492); for (let i = 0; i < 7; i++) { const y = 50 + i * 68; c.fillStyle = ["#c23b2e", "#2c4f9e", "#2f8a5a", "#e0a42a"][i % 4]; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.beginPath(); c.ellipse(128 + Math.cos(a) * 26, y + Math.sin(a) * 22, 14, 9, a, 0, Math.PI * 2); c.fill(); } } });
    const tomb = (x: number, s: number, m: THREE.MeshStandardMaterial) => {
      const t = new THREE.Group();
      t.add(box(1.4 * s, 0.32, 2.6 * s, toon("#efeae0"), 0, 0, 0));
      t.add(box(1.1 * s, 0.38, 2.3 * s, m, 0, 0.32, 0));
      t.add(box(0.8 * s, 0.32, 2.0 * s, m, 0, 0.7, 0));
      t.position.set(x, 0, cz); return t;
    };
    const hm = toon("#ffffff", { map: inlay });
    this.sjTomb = toon("#ffffff", { map: inlay, emissive: "#ffcf6a", emissiveIntensity: 0 });
    g.add(tomb(cx, 1, hm), tomb(cx - 1.55, 1.1, this.sjTomb));
    // hanging lamp
    g.add(box(0.03, 1.6, 0.03, toon("#8a7a5a"), cx, 4.9, cz));
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: "#ffcf80", toneMapped: false })); bowl.position.set(cx, 4.8, cz); g.add(noink(bowl));
    this.cryptLamp = new THREE.PointLight("#ffc070", 22, 16, 1.4); this.cryptLamp.position.set(cx, 4.4, cz); g.add(this.cryptLamp);
    this.cryptLine = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: "#ffe27a", toneMapped: false }));
    this.cryptLine.rotation.x = -Math.PI / 2; this.cryptLine.position.set(cx, 1.08, cz); g.add(noink(this.cryptLine));
    this.root.add(shadowed(g, false));
  }

  // ---------- card slots ----------
  buildSlots(n: number) {
    this.blob = canvasTex(128, 64, (c) => { const gr = c.createRadialGradient(64, 32, 0, 64, 32, 62); gr.addColorStop(0, "rgba(40,30,30,0.5)"); gr.addColorStop(0.6, "rgba(40,30,30,0.3)"); gr.addColorStop(1, "rgba(40,30,30,0)"); c.fillStyle = gr; c.fillRect(0, 0, 128, 64); });
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.03, fog: true, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
      const mesh = new THREE.Mesh(geo, mat); mesh.visible = false;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      sh.rotation.x = -Math.PI / 2; sh.visible = false;
      this.root.add(noink(mesh), noink(sh));
      this.slots.push({ mesh, mat, shadow: sh });
    }
  }
  tex(key: string, w: number, h: number, dw: number, dh: number, draw: (p: Pen) => void) {
    let t = this.texCache.get(key);
    if (!t) {
      t = canvasTex(w, h, (g) => { g.scale(w / dw, h / dh); draw(new Pen(g)); });
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      this.texCache.set(key, t);
      if (this.texCache.size > 600) { const first = this.texCache.keys().next().value as string; this.texCache.get(first)!.dispose(); this.texCache.delete(first); }
    }
    return t;
  }

  // ---------- who is on screen ----------
  actors(t: number): Actor[] {
    const s = shotAt(t).id, A: Actor[] = [];
    const q = (x: number, n = 8) => Math.floor((((x % 1) + 1) % 1) * n) / n;
    const person = (pose: Pose, pos: V3, hero = false, heading?: V3, scale = 1): Actor => {
      void hero; void scale;
      const fp: FigPose = { mode: pose.mode === "stroll" || pose.mode === "march" ? "walk" : pose.mode === "sit" ? "sit" : "stand", walk: pose.phase, cheer: pose.cheer, hammer: pose.hammer, wave: pose.wave, headTilt: pose.headTilt, sad: pose.expr === "nervous" };
      const fig: Fig = { kind: "person", who: pose.who, pose: fp, yaw: heading ? Math.atan2(heading[0], heading[2]) : undefined, facing: pose.facing ?? 0 };
      if (heading === undefined && fp.mode === "walk") fig.yaw = (pose.facing ?? 1) > 0 ? Math.PI / 2 : -Math.PI / 2;
      return { fig, key: "", draw: () => {}, tw: 0, th: 0, dw: 0, dh: 0, pos, w: 0, h: 0 };
    };
    const lying = (who: string, pos: V3, yaw: number): Actor => ({ fig: { kind: "person", who, pose: { mode: "lie" }, yaw }, key: "", draw: () => {}, tw: 0, th: 0, dw: 0, dh: 0, pos, w: 0, h: 0 });
    const [px, , pz] = PALACE, [qx, , qz] = QUARRY, [yx, , yz] = YARD, [fx, , fz] = FORTIN;
    if (s === "bed" || s === "grief") {
      A.push(lying("mumtaz", [px + 2.85, 0.68, pz - 2.6], Math.PI / 2));
      A.push(person({ who: "sj", view: "front", expr: "nervous", mode: "sit", facing: 1, headTilt: 7, blink: t > W.died + 0.3 ? 1 : blinkAt(t, 1) }, [px + 0.05, 0, pz - 1.0], true));
      const k = lampAt(t);
      if (k > 0.02) A.push({ key: `flame${Math.floor(t * 12) % 3}`, draw: (p) => { const f = Math.floor(t * 12) % 3; p.ell(100, 150 - f * 4, 40, 70 + f * 6, "#ffcf5a", 0); p.ell(100, 165, 22, 40, "#fff4c8", 0); }, tw: 100, th: 128, dw: 200, dh: 256, pos: [px + 4.0, 1.15, pz - 3.4], w: 0.16 * k, h: 0.2 * k, add: true });
    }
    if (s === "vow") A.push(person({ who: "sj", view: "front", expr: t < 15.4 ? "neutral" : "stern", mode: "stand", facing: 0, blink: blinkAt(t, 1) }, [px - 0.5, 0, pz - 0.75], true));
    if (s === "site") {
      const r = rng(12);
      for (let i = 0; i < 56; i++) {
        const x0 = (r() - 0.5) * 56, z0 = 6 + r() * 40, dir = r() > 0.5 ? 1 : -1, sp = 0.6 + r() * 0.5;
        const x = x0 + dir * sp * (t - L[3]), y = Math.abs(x) < PL && z0 < PL ? Y_PL : 0;
        A.push(person({ who: `w${i % 12}`, view: "front", expr: "neutral", mode: "stroll", phase: q(t * 1.6 + r()), facing: dir as 1 | -1 }, [x, y, z0]));
      }
    }
    if (s === "quarry") {
      const spots: [number, number, number][] = [[-6, 2, -4], [-2, 2, -4], [3, 2, -4], [7, 4.2, -7.2], [-4, 4.2, -7.2], [1, 6.4, -10.4]];
      spots.forEach(([x, y, z], i) => A.push(person({ who: `w${i}`, view: "front", expr: i % 2 ? "neutral" : "smile", mode: "stand", facing: (i % 2 ? -1 : 1) as 1 | -1, hammer: Math.round(Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 4) / 4 }, [qx + x, y, qz + z])));
      A.push(person({ who: "w7", view: "front", expr: "smile", mode: "stroll", phase: q(t * 1.5), facing: -1 }, [qx + 3 - 0.8 * (t - L[4]), 0, qz + 3.5], true));
    }
    if (s === "elephants" || s === "ramp") {
      for (let i = 0; i < 6; i++) {
        const z = elephantZ(i, t), y = rampY(z);
        A.push({ fig: { kind: "elephant", who: "", pose: {}, phase: (t * 0.55 + i * 0.3) % 1, seed: i, yaw: Math.PI }, key: "", draw: () => {}, tw: 0, th: 0, dw: 0, dh: 0, pos: [0.2, y, z], w: 0, h: 0 });
        const bz = z + 3.9; this.blocks[i].position.set(0.2, rampY(bz), bz); this.blocks[i].rotation.x = Math.atan2(RAMP_H, RAMP_Z0 - RAMP_Z1);
        if (i % 2 === 0) A.push(person({ who: `w${i + 3}`, view: "side", expr: "neutral", mode: "march", phase: q(t * 1.0 + i * 0.25) }, [2.4, rampY(z - 1.0), z - 1.0], s === "elephants", [0, 0, -1]));
      }
    }
    if (s === "caravan") {
      for (let i = 0; i < 5; i++) {
        const x = camelX(i, t);
        A.push({ fig: { kind: "camel", who: "", pose: {}, phase: (t * 0.7 + i * 0.37) % 1, seed: i, yaw: Math.PI / 2 }, key: "", draw: () => {}, tw: 0, th: 0, dw: 0, dh: 0, pos: [x, 0, 40], w: 0, h: 0 });
      }
      A.push(person({ who: "w4", view: "side", expr: "smile", mode: "march", phase: q(t * 1.25) }, [camelX(1, t) - 1.6, 0, 42.2], true, [1, 0, 0]));
    }
    if (s === "inlay") A.push(person({ who: "w5", view: "front", expr: "smile", mode: "stand", hammer: Math.round(Math.abs(Math.sin(t * 4)) * 4) / 4, facing: 0, blink: blinkAt(t, 5) }, [qx + 20, 0, qz + 9.2], true));
    if (s === "lean") A.push(person({ who: "w2", view: "front", expr: t > W.tilt ? "grin" : "smile", mode: "stand", facing: -1, headTilt: t > W.tilt ? -6 * Math.abs(Math.sin((t - W.tilt) * 5)) : 0, blink: blinkAt(t, 2) }, [17.4, 0, 33.6], true));
    if (s === "yard" || s === "stick") {
      A.push(lying("kid", [yx + 0.45, 0.55, yz], Math.PI / 2));
      const holding = t > W.danda - 0.5 && t < W.gire - 0.2;
      A.push(person({ who: "father", view: "front", expr: t > 56.9 ? "relief" : "smile", mode: "stand", facing: -1, wave: holding ? 0.2 : undefined, blink: blinkAt(t, 4) }, [yx + 1.3, 0, yz - 0.95], true));
      if (t > 56.68 && t < 57.6) { const k = (t - 56.68) / 0.9; A.push({ key: `puff${Math.floor(k * 6)}`, draw: (p) => fxPuff(p, Math.floor(k * 6) / 6), tw: 256, th: 256, dw: 300, dh: 300, pos: [yx + 2.6, 0, yz + 0.35], w: 0.9, h: 0.9 }); }
    }
    if (s === "hands") {
      for (let i = 0; i < 7; i++) {
        const x = 2.9 + (i % 4) * 1.15 + (i >= 4 ? 0.55 : 0), z = i >= 4 ? 23.2 : 25.0, ph = Math.sin(t * 6 + i * 1.1);
        A.push(person({ who: `w${i + 1}`, view: "front", expr: i % 2 ? "laugh" : "grin", mode: "stand", cheer: Math.round((0.5 + 0.5 * ph) * 4) / 4, facing: 0, blink: blinkAt(t, i) }, [x, 0, z], i < 4));
      }
    }
    if (s === "aurangzeb") A.push(person({ who: "aurangzeb", view: "front", expr: "stern", mode: "stand", facing: 0, blink: blinkAt(t, 3) }, [fx, 0, fz - 1.5], true));
    if (s === "door") {
      A.push(person({ who: "aurangzeb", view: "front", expr: "stern", mode: "stand", facing: 1, blink: blinkAt(t, 3) }, [fx - 2.0, 0, fz - 2.6], true));
      A.push(person({ who: "sjOld", view: "front", expr: t < W.qaid ? "nervous" : "shock", mode: "stand", facing: 0, blink: blinkAt(t, 6) }, [fx, 0, fz - 6.6], true));
    }
    if (s === "window") {
      // place him from the shot's own camera: 2.5 m ahead, a little left, looking toward the Taj (screen-right)
      const c = camAt(t), fx2 = c.look[0] - c.pos[0], fz2 = c.look[2] - c.pos[2], fl = Math.hypot(fx2, fz2), fw: V3 = [fx2 / fl, 0, fz2 / fl];
      const rt: V3 = [-fw[2], 0, fw[0]];
      A.push(person({ who: "sjOld", view: "side", expr: "neutral", mode: "stand", blink: blinkAt(t, 6) }, [c.pos[0] + fw[0] * 3.3 - rt[0] * 0.62, 14.15, c.pos[2] + fw[2] * 3.3 - rt[2] * 0.62], true, rt));
    }
    return A;
  }

  // ---------- per frame ----------
  update(t: number, cam: THREE.PerspectiveCamera, size: { w: number; h: number }) {
    const c = camAt(t), s = shotAt(t);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look);
    if (c.roll) cam.rotateZ((c.roll * Math.PI) / 180);
    cam.fov = c.fov; cam.aspect = size.w / size.h; cam.near = 0.1; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const lk = lookAt(t);
    // sun: camera-relative azimuth / elevation, frozen per shot
    const look = new THREE.Vector3(...camAt(s.a + 0.01).look), pos0 = new THREE.Vector3(...camAt(s.a + 0.01).pos);
    const f = look.clone().sub(pos0); f.y = 0; f.normalize();
    const az = (lk.az * Math.PI) / 180, el = (lk.el * Math.PI) / 180;
    const fr = new THREE.Vector3(f.x * Math.cos(az) - f.z * Math.sin(az), 0, f.x * Math.sin(az) + f.z * Math.cos(az));
    const toSun = new THREE.Vector3(-fr.x * Math.cos(el), Math.sin(el), -fr.z * Math.cos(el)).normalize();
    const tgt = new THREE.Vector3(...c.look);
    const span = Math.min(90, Math.max(14, tgt.distanceTo(cam.position) * 0.9));
    const sc = this.sun.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 600; sc.updateProjectionMatrix();
    this.sun.position.copy(tgt).addScaledVector(toSun, 250); this.sun.target.position.copy(tgt); this.sun.target.updateMatrixWorld();
    this.sun.color.set(lk.sunCol); this.sun.intensity = lk.sunI;
    this.hemi.color.set(lk.hemiSky); this.hemi.groundColor.set(lk.hemiGround); this.hemi.intensity = lk.hemiI;
    this.skyMat.uniforms.uTop.value.set(lk.skyTop); this.skyMat.uniforms.uHor.value.set(lk.skyHor);
    this.skyMat.uniforms.uSun.value.copy(toSun); this.skyMat.uniforms.uSunCol.value.set(lk.sunCol).multiplyScalar(s.light === "night" ? 0.3 : 1);
    this.sky.position.copy(cam.position);
    this.fog.color.set(lk.skyHor); this.fog.near = lk.fog[0]; this.fog.far = lk.fog[1];
    for (const cl of this.clouds) (cl.material as THREE.MeshBasicMaterial).color.setRGB(...lk.card).multiplyScalar(s.light === "night" ? 0.35 : 1);
    this.water.uniforms.uTime.value = t; this.water.uniforms.uLight.value = Math.min(1.1, 0.45 + lk.sunI * 0.2); this.water.uniforms.uSky.value.set(lk.skyHor);
    this.water.uniforms.uFogCol.value.copy(this.fog.color); this.water.uniforms.uFog.value.set(this.fog.near, this.fog.far);
    // interiors
    this.lamp.intensity = s.id === "bed" || s.id === "grief" ? 16 * lampAt(t) * (0.92 + 0.08 * Math.sin(t * 23)) : 0;
    this.windowPane.color.set(s.light === "night" ? "#22336e" : "#fff3d6");
    this.table.visible = this.planMesh.visible = s.light !== "night";
    this.cryptLamp.intensity = s.light === "crypt" ? 24 : 0;
    this.fortLamp.intensity = s.id === "aurangzeb" || s.id === "door" ? 12 * (0.94 + 0.06 * Math.sin(t * 19)) : 0;
    // Taj state
    const b = buildAt(t);
    const built = b >= 0.999;
    this.garden.visible = built; this.site.visible = !built;
    this.ramp.visible = s.id === "elephants" || s.id === "ramp";
    for (const bl of this.blocks) bl.visible = this.ramp.visible;
    const wallK = clamp01((b - 0.15) / 0.4);
    this.walls.visible = wallK > 0.005; this.walls.scale.y = Math.max(0.001, wallK);
    this.cap.visible = b > 0.56; this.drum.visible = b > 0.56; this.drum.scale.y = clamp01((b - 0.56) / 0.08) || 0.001;
    this.dome.visible = b > 0.64; this.dome.scale.set(1, Math.max(0.001, clamp01((b - 0.64) / 0.2)), 1);
    this.finial.visible = b > 0.9; this.chhatris.visible = b > 0.84;
    const minK = clamp01((b - 0.58) / 0.36);
    const lean = (leanAt(t) * Math.PI) / 180, fall = fallAt(t), qk = quakeAt(t);
    MINARETS.forEach((p, i) => {
      const m = this.minarets[i];
      m.visible = minK > 0.01; m.scale.y = Math.max(0.001, minK);
      const out = new THREE.Vector3(Math.sign(p[0]), 0, Math.sign(p[2])).normalize();
      const axis = new THREE.Vector3(0, 1, 0).cross(out).normalize();
      m.quaternion.setFromAxisAngle(axis, lean + qk * 0.15);
      m.position.set(p[0] + qk * 0.6, p[1], p[2]);
      const gh = this.ghosts[i];
      gh.visible = fall >= 0;
      if (fall >= 0) gh.quaternion.setFromAxisAngle(axis, lean + fall * (Math.PI / 2 - lean - 0.05));
    });

    // shake the whole tomb a touch during the quake
    const shake = qk * 0.5;
    for (const o of [this.walls, this.cap, this.drum, this.dome, this.finial, this.chhatris]) o.position.x = shake;
    // scaffold around the rising walls
    const scaff = b > 0.05 && b < 0.97;
    this.scaffold.visible = scaff;
    if (scaff) {
      const h = Y_PL + WALL_H * wallK + 1.6 + (b > 0.56 ? 4 * clamp01((b - 0.56) / 0.3) : 0), M = new THREE.Matrix4();
      let k = 0;
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, r = TOMB + 1.1; M.compose(new THREE.Vector3(Math.cos(a) * r * 1.02, Y_PL, Math.sin(a) * r * 1.02), new THREE.Quaternion(), new THREE.Vector3(1, h - Y_PL, 1)); this.scaffold.setMatrixAt(k++, M); }
      for (let lvl = 0; lvl < 6; lvl++) for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2 + Math.PI / 8, r = (TOMB + 1.1) * 1.02 * Math.cos(Math.PI / 8), y = Y_PL + 1.5 + lvl * 2;
        const vis = y < h;
        M.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, Math.PI / 2)), new THREE.Vector3(1, vis ? 2 * r * Math.tan(Math.PI / 8) : 0.001, 1));
        M.multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0));
        this.scaffold.setMatrixAt(k++, M);
      }
      this.scaffold.instanceMatrix.needsUpdate = true;
    }
    // centre lines + his glowing cenotaph
    const cl = centreLineAt(t);
    this.centre.visible = s.id === "above" && cl > 0.001; this.centre.scale.y = Math.max(0.001, 140 * cl); this.centre.position.z = 112 - 70 * cl;
    this.cryptLine.visible = s.id === "graves" && cl > 0.001; this.cryptLine.scale.y = Math.max(0.001, 13 * cl);
    this.sjTomb.emissiveIntensity = 0.6 * sjGlowAt(t) * (0.85 + 0.15 * Math.sin(t * 6));
    // props
    const pk = planAt(t); const pq = Math.round(pk * 24) / 24;
    const ptex = this.tex(`plan${pq}`, 1000, 700, 1000, 700, (p) => drawPlan(p, pq));
    if ((this.planMesh.material as THREE.MeshBasicMaterial).map !== ptex) { (this.planMesh.material as THREE.MeshBasicMaterial).map = ptex; (this.planMesh.material as THREE.MeshBasicMaterial).needsUpdate = true; }
    (this.planMesh.material as THREE.MeshBasicMaterial).color.setRGB(...lk.card);
    const ik = Math.round(inlayAt(t) * 40) / 40;
    const itex = this.tex(`inlay${ik}`, 800, 800, 800, 800, (p) => drawInlay(p, ik));
    if ((this.inlayMesh.material as THREE.MeshBasicMaterial).map !== itex) { (this.inlayMesh.material as THREE.MeshBasicMaterial).map = itex; (this.inlayMesh.material as THREE.MeshBasicMaterial).needsUpdate = true; }
    const st = stickAt(t);
    this.stick.visible = st !== null; if (st !== null) this.stick.rotation.z = -(st * Math.PI) / 180;
    const d = (doorAt(t) * Math.PI) / 180; this.doors[0].rotation.y = d; this.doors[1].rotation.y = -d;
    // cards
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0; right.normalize();
    const all = this.actors(t), acts = all.filter((a) => !a.fig), figs = all.filter((a) => a.fig);
    let np = 0, ne = 0, nc = 0;
    for (const a of figs) {
      const f = a.fig!;
      const yaw = f.yaw ?? Math.atan2(cam.position.x - a.pos[0], cam.position.z - a.pos[2]) + (f.facing ?? 0) * 0.55;
      let obj: THREE.Object3D;
      if (f.kind === "person") {
        if (!this.rigs[np]) { const r = new Person(); const h = new THREE.Group(); h.add(r.root); this.rigs.push(r); this.people.push(h); this.root.add(h); }
        const r = this.rigs[np]; r.dress(f.who); r.pose(f.pose); obj = this.people[np++];
        r.root.rotation.x = f.pose.mode === "lie" ? -Math.PI / 2 : 0;
      } else if (f.kind === "elephant") {
        if (!this.eles[ne]) { const e = new Elephant(ne); this.eles.push(e); this.root.add(e.root); }
        this.eles[ne].pose(f.phase ?? 0); obj = this.eles[ne++].root;
      } else {
        if (!this.camels[nc]) { const c2 = new Camel(nc); this.camels.push(c2); this.root.add(c2.root); }
        this.camels[nc].pose(f.phase ?? 0); obj = this.camels[nc++].root;
      }
      obj.visible = true; obj.position.set(...a.pos); obj.rotation.y = yaw;
    }
    this.people.forEach((h, i) => { if (i >= np) h.visible = false; });
    this.eles.forEach((e, i) => { if (i >= ne) e.root.visible = false; });
    this.camels.forEach((e, i) => { if (i >= nc) e.root.visible = false; });
    this.slots.forEach((sl, i) => {
      const a = acts[i];
      sl.mesh.visible = !!a; sl.shadow.visible = !!a && !!a.shadow;
      if (!a) return;
      const tx = this.tex(a.key, a.tw, a.th, a.dw, a.dh, a.draw);
      if (sl.mat.map !== tx) { sl.mat.map = tx; sl.mat.needsUpdate = true; }
      sl.mat.blending = a.add ? THREE.AdditiveBlending : THREE.NormalBlending; sl.mat.depthWrite = !a.add;
      const lc = a.add ? [1.6, 1.4, 1.1] : lk.card;
      sl.mat.color.setRGB(lc[0], lc[1], lc[2]);
      const flip = a.heading ? new THREE.Vector3(...a.heading).dot(right) < 0 : false;
      sl.mesh.position.set(...a.pos); sl.mesh.scale.set(flip ? -a.w : a.w, a.h, 1);
      if (a.mode === "full") sl.mesh.quaternion.copy(cam.quaternion);
      else sl.mesh.rotation.set(0, Math.atan2(cam.position.x - a.pos[0], cam.position.z - a.pos[2]), 0);
      if (a.shadow) { sl.shadow.position.set(a.pos[0], a.pos[1] + 0.035, a.pos[2]); sl.shadow.scale.set(a.shadow, a.shadow, 1); }
    });
    void W; void RAMP_Z1; void lerp;
    return lk;
  }
}
