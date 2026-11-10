// The magic forest: one three.js world, posed every frame from story.ts.
import * as THREE from "three";
import { Pen } from "./toon";
import { NOINK } from "./ink";
import { drawChintu, drawSheru, drawTreeFace, drawBird, drawRabbit, drawSquirrel, drawButterfly, drawFlower, FLOWER_CELLS, ChintuPose, SheruPose, Expr, Arms } from "./chars";
import {
  V3, ground, pathX, standY, RIVER_Z, RIVER_HALF, WATER_Y, CLEARING, CLEAR_R, MAGIC, HIDE_TREE, BUSH, BIRD_AT, SAPLING, STONES,
  glowAt, treeGlowAt, treeEyesAt, talkAt, blinkAt, chintuAt, sheruAt, camAt, Act, smooth, clamp01, T_BURST, lerp, shotIndexAt,
} from "./story";

// ---------------- helpers ----------------
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const col = (c: string) => new THREE.Color(c);
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
};
const GRAD = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (c: string | THREE.Color, extra: THREE.MeshToonMaterialParameters = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD, ...extra });
const noink = (o: THREE.Object3D) => { o.traverse((c) => c.layers.set(NOINK)); return o; };

// ---------------- sprite field (flowers / grass / mushrooms): camera-facing instanced cards ----------------
const spriteVS = /* glsl */ `
attribute vec3 iOff; attribute float iScale; attribute float iCell; attribute float iSeed; attribute float iRing;
uniform vec3 uRight; uniform float uTime; uniform float uRing; uniform float uCells;
varying vec2 vUv; varying float vDepth;
void main() {
  float grow = iRing < 0.0 ? 1.0 : smoothstep(0.0, 2.0, uRing - iRing);
  float s = iScale * grow;
  vec3 p = iOff + uRight * position.x * s + vec3(0.0, 1.0, 0.0) * position.y * s;
  p += uRight * sin(uTime * 1.7 + iSeed * 6.28) * 0.06 * position.y * s;
  vUv = vec2((uv.x + iCell) / uCells, uv.y);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const spriteFS = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uLight; uniform vec3 uFogCol; uniform vec2 uFog;
varying vec2 vUv; varying float vDepth;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.5 || vDepth < 2.8) discard;
  vec3 rgb = c.rgb * uLight;
  float f = smoothstep(uFog.x, uFog.y, vDepth);
  gl_FragColor = vec4(mix(rgb, uFogCol, f), 1.0);
  #include <colorspace_fragment>
}`;

class SpriteField {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial;
  constructor(atlas: THREE.Texture, cells: number, items: { p: V3; s: number; cell: number; ring?: number }[]) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
    g.index = base.index; g.setAttribute("position", base.getAttribute("position")); g.setAttribute("uv", base.getAttribute("uv"));
    const n = items.length;
    const off = new Float32Array(n * 3), sc = new Float32Array(n), cell = new Float32Array(n), seed = new Float32Array(n), ring = new Float32Array(n);
    items.forEach((it, i) => { off.set(it.p, i * 3); sc[i] = it.s; cell[i] = it.cell; seed[i] = (i * 0.6180339) % 1; ring[i] = it.ring ?? -1; });
    g.setAttribute("iOff", new THREE.InstancedBufferAttribute(off, 3)); g.setAttribute("iScale", new THREE.InstancedBufferAttribute(sc, 1));
    g.setAttribute("iCell", new THREE.InstancedBufferAttribute(cell, 1)); g.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute("iRing", new THREE.InstancedBufferAttribute(ring, 1));
    g.instanceCount = n;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: spriteVS, fragmentShader: spriteFS, side: THREE.DoubleSide,
      uniforms: { uMap: { value: atlas }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 }, uRing: { value: 1e4 }, uCells: { value: cells }, uLight: { value: new THREE.Vector3(1, 1, 1) }, uFogCol: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(40, 200) } },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(NOINK);
  }
}

// ---------------- magic motes ----------------
const moteVS = /* glsl */ `
attribute float aSeed; attribute float aThr;
uniform float uTime; uniform float uGlow; uniform float uPx; uniform float uRise;
varying float vA; varying float vSeed;
void main() {
  vec3 p = position;
  float t = uTime + aSeed * 40.0;
  p += vec3(sin(t * 0.5) * 0.6, sin(t * 0.37) * 0.35, cos(t * 0.43) * 0.6);
  float gone = smoothstep(aThr - 0.06, aThr + 0.06, uGlow);
  p.y += (1.0 - gone) * uRise * (2.0 + aSeed * 4.0);
  vA = gone * (0.55 + 0.45 * sin(t * 2.3));
  vSeed = aSeed;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.10 + 0.05 * aSeed) / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const moteFS = /* glsl */ `
uniform vec3 uCol; varying float vA; varying float vSeed;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.0, r); a = a * a;
  float core = smoothstep(0.35, 0.0, r);
  vec3 c = mix(uCol, vec3(1.0, 1.0, 0.85), core) * (1.0 + 2.5 * core);
  if (vSeed > 0.8) c *= vec3(0.75, 1.0, 1.15);
  gl_FragColor = vec4(c * a * vA, a * vA);
}`;

// ---------------- the world ----------------
type CardSlot = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; shadow?: THREE.Mesh };

export class World {
  root = new THREE.Group();
  sun = new THREE.DirectionalLight("#fff1d6", 3.2);
  hemi = new THREE.HemisphereLight("#cfe8ff", "#6b8a3a", 1.4);
  sky!: THREE.Mesh;
  skyMat!: THREE.ShaderMaterial;
  fields: SpriteField[] = [];
  clearFlowers!: SpriteField;
  motes!: THREE.Points; moteMat!: THREE.ShaderMaterial;
  treeMotes!: THREE.Points;
  water!: THREE.ShaderMaterial;
  bush!: THREE.Group;
  canopyMat: THREE.MeshToonMaterial[] = [];
  lanterns!: THREE.InstancedMesh; lanternMat!: THREE.MeshBasicMaterial;
  halo!: THREE.Mesh;
  face!: CardSlot;
  ring!: THREE.Mesh;
  sapling!: THREE.Group; mound!: THREE.Mesh;
  cards: Record<string, CardSlot> = {};
  texCache = new Map<string, THREE.CanvasTexture>();
  clouds: THREE.Mesh[] = [];
  fog = new THREE.Fog("#cfe6ff", 40, 220);

  constructor() {
    this.root.add(this.sun, this.sun.target, this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
    this.buildSky();
    this.buildGround();
    this.buildTrees();
    this.buildRiver();
    this.buildMagicTree();
    this.buildFlowers();
    this.buildMotes();
    this.buildProps();
    this.buildCards();
  }

  // ---------- sky + clouds ----------
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: col("#3d8ce0") }, uHor: { value: col("#cfe6ff") }, uSun: { value: new THREE.Vector3(0.3, 0.5, -0.8).normalize() }, uSunCol: { value: col("#fff2c4") } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
          vec3 c = mix(uHor, uTop, pow(smoothstep(0.0, 0.55, h), 0.8));
          float s = max(dot(d, uSun), 0.0); c += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), this.skyMat);
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
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.3, el = 0.08 + r() * 0.16, d = 520;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(260 + r() * 120, 130), new THREE.MeshBasicMaterial({ map: ctex, transparent: true, depthWrite: false, fog: false }));
      m.position.set(Math.sin(a) * d * Math.cos(el), Math.sin(el) * d, Math.cos(a) * d * Math.cos(el));
      m.lookAt(0, m.position.y * 0.6, 0);
      m.renderOrder = -9;
      this.clouds.push(m); this.root.add(noink(m));
    }
  }

  // ---------- ground ----------
  buildGround() {
    const X0 = -40, X1 = 40, Z0 = -95, Z1 = 62;
    const W = X1 - X0, D = Z1 - Z0;
    const tex = canvasTex(2048, 4032, (g) => {
      const sx = 2048 / W, sz = 4032 / D;
      const P = (x: number, z: number): [number, number] => [(x - X0) * sx, (Z1 - z) * sz];
      g.fillStyle = "#5fb043"; g.fillRect(0, 0, 2048, 4032);
      const r = rng(11);
      for (let i = 0; i < 2600; i++) {
        const x = r() * 2048, y = r() * 4032, rr = 20 + r() * 90;
        g.fillStyle = ["rgba(80,160,50,0.35)", "rgba(120,190,60,0.30)", "rgba(60,140,60,0.30)", "rgba(150,200,70,0.22)"][i % 4];
        g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
      }
      // clearing: lighter, soft
      const [cx, cy] = P(CLEARING[0], CLEARING[2]);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, CLEAR_R * sx * 1.1);
      gr.addColorStop(0, "rgba(160,215,90,0.85)"); gr.addColorStop(1, "rgba(160,215,90,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 2048, 4032);
      // river banks (sand)
      for (let z = RIVER_Z - RIVER_HALF - 1.6; z <= RIVER_Z + RIVER_HALF + 1.6; z += 0.1) {
        const a = 1 - Math.abs(Math.abs(z - RIVER_Z) - RIVER_HALF) / 1.6;
        if (a <= 0) continue;
        g.fillStyle = `rgba(214,190,130,${(a * 0.9).toFixed(3)})`;
        const [, y] = P(0, z); g.fillRect(0, y, 2048, sz * 0.1 + 1);
      }
      // dirt path (wider edge, then the warm centre, then pebbles)
      const draw = (w: number, c: string) => {
        g.strokeStyle = c; g.lineWidth = w * sx; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
        for (let z = Z1; z >= -47; z -= 0.5) { const [x, y] = P(pathX(z), z); if (z === Z1) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      };
      draw(2.6, "#b08a52"); draw(2.0, "#d2ab6c"); draw(1.2, "#dcb87a");
      for (let i = 0; i < 1400; i++) {
        const z = Z1 - r() * (Z1 + 47), x = pathX(z) + (r() - 0.5) * 2.0;
        const [px, py] = P(x, z);
        g.fillStyle = r() > 0.5 ? "rgba(150,110,70,0.5)" : "rgba(240,215,170,0.6)";
        g.beginPath(); g.ellipse(px, py, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill();
      }
    });
    const geo = new THREE.PlaneGeometry(W, D, 200, 392);
    geo.rotateX(-Math.PI / 2);
    geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, ground(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon("#ffffff", { map: tex }));
    m.receiveShadow = true;
    this.root.add(m);
    // far ground: big, low detail, same height function
    const far = new THREE.PlaneGeometry(700, 700, 140, 140); far.rotateX(-Math.PI / 2);
    const fp = far.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); const inside = x > X0 + 1 && x < X1 - 1 && z > Z0 + 1 && z < Z1 - 1; fp.setY(i, ground(x, z) - (inside ? 3 : 0.04)); }
    far.computeVertexNormals();
    const fm = new THREE.Mesh(far, toon("#5aa83f")); fm.receiveShadow = true;
    this.root.add(fm);
  }

  // ---------- trees, bushes, rocks ----------
  buildTrees() {
    const r = rng(21);
    const trees: { x: number; z: number; h: number; s: number; c: string }[] = [];
    const greens = ["#3e9b3a", "#56b443", "#2f8a4a", "#6cc24a", "#3aa06a", "#4aa83e"];
    const fancy = ["#ff8fb8", "#c58bff", "#ffb347", "#47d1c1", "#ff6f91"];
    const ok = (x: number, z: number, minPath: number) => {
      if (Math.abs(x - pathX(z)) < minPath) return false;
      if (Math.abs(z - RIVER_Z) < RIVER_HALF + 0.6) return false;
      if (Math.hypot(x - CLEARING[0], z - CLEARING[2]) < CLEAR_R + 1) return false;
      if (Math.hypot(x - MAGIC[0], z - MAGIC[2]) < 13) return false;
      if (Math.hypot(x - HIDE_TREE[0], z - HIDE_TREE[2]) < 3.5) return false;
      if (z > 30 && z < 50 && x < -1 && x > -16) return false; // meadow: open for the opening crane
      return true;
    };
    for (let i = 0; i < 2600 && trees.length < 420; i++) {
      const x = (r() - 0.5) * 130, z = -115 + r() * 185;
      if (!ok(x, z, 5.5 + r() * 3)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
      const fancyT = r() < 0.16;
      trees.push({ x, z, h: 3 + r() * 3.5, s: 1.6 + r() * 1.3, c: fancyT ? fancy[Math.floor(r() * fancy.length)] : greens[Math.floor(r() * greens.length)] });
    }
    trees.push({ x: HIDE_TREE[0], z: HIDE_TREE[2], h: 4.2, s: 2.4, c: "#4aa83e" });
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 9); trunkGeo.translate(0, 0.5, 0);
    const blobGeo = new THREE.IcosahedronGeometry(1, 3);
    const trunks = new THREE.InstancedMesh(trunkGeo, toon("#8a5a34"), trees.length);
    const blobs = new THREE.InstancedMesh(blobGeo, toon("#ffffff"), trees.length * 4);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    let bi = 0;
    trees.forEach((t, i) => {
      const y = ground(t.x, t.z) - 0.1;
      const thick = 0.8 + t.s * 0.25;
      M.compose(P.set(t.x, y, t.z), Q.identity(), S.set(thick, t.h + 0.6, thick)); trunks.setMatrixAt(i, M);
      const nb = 4;
      for (let k = 0; k < nb; k++) {
        const a = (k / nb) * Math.PI * 2 + r() * 2, rr = k === 0 ? 0 : t.s * 0.55;
        const s = t.s * (k === 0 ? 1.05 : 0.75 + r() * 0.2);
        M.compose(P.set(t.x + Math.cos(a) * rr, y + t.h + (k === 0 ? t.s * 0.45 : -0.1 + r() * 0.5), t.z + Math.sin(a) * rr), Q.identity(), S.set(s, s * 0.9, s));
        blobs.setMatrixAt(bi, M);
        const c = col(t.c).offsetHSL(0, 0, (r() - 0.5) * 0.08);
        blobs.setColorAt(bi, c); bi++;
      }
    });
    blobs.count = bi;
    trunks.castShadow = blobs.castShadow = true; trunks.receiveShadow = blobs.receiveShadow = true;
    this.root.add(trunks, blobs);

    // bushes + rocks
    const bushes: V3[] = [];
    for (let i = 0; i < 1400 && bushes.length < 260; i++) {
      const x = (r() - 0.5) * 70, z = -100 + r() * 160;
      const dp = Math.abs(x - pathX(z));
      if (dp < 2.2 || dp > 14) continue;
      if (Math.abs(z - RIVER_Z) < RIVER_HALF + 0.3) continue;
      const dc = Math.hypot(x - CLEARING[0], z - CLEARING[2]);
      if (dc < CLEAR_R - 2.5 && dc > 0) continue;
      bushes.push([x, ground(x, z), z]);
    }
    const bushM = new THREE.InstancedMesh(blobGeo, toon("#ffffff"), bushes.length * 3);
    let k = 0;
    bushes.forEach((b) => {
      for (let j = 0; j < 3; j++) {
        const s = 0.45 + r() * 0.4;
        M.compose(P.set(b[0] + (j - 1) * 0.45, b[1] + s * 0.5, b[2] + (r() - 0.5) * 0.4), Q.identity(), S.set(s, s * 0.8, s));
        bushM.setMatrixAt(k, M); bushM.setColorAt(k, col(["#3f9a35", "#58b544", "#2f8a3e"][j]).offsetHSL(0, 0, (r() - 0.5) * 0.06)); k++;
      }
    });
    bushM.castShadow = true; bushM.receiveShadow = true;
    this.root.add(bushM);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, toon("#9a958c"), 70);
    for (let i = 0; i < 70; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 20; tries++) { x = (r() - 0.5) * 50; z = -90 + r() * 140; const dp = Math.abs(x - pathX(z)); if (dp > 1.6 && dp < 10) break; }
      if (Math.abs(z - RIVER_Z) < RIVER_HALF + 1.5) x += 0;
      const s = 0.2 + r() * 0.45;
      M.compose(P.set(x, ground(x, z) + s * 0.25, z), Q.setFromEuler(new THREE.Euler(r(), r() * 3, r())), S.set(s * 1.3, s * 0.8, s));
      rocks.setMatrixAt(i, M);
    }
    rocks.castShadow = true; this.root.add(rocks);

    // Sheru's bush (shakes at the funny sound)
    this.bush = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const m = new THREE.Mesh(blobGeo, toon(["#4fae3e", "#3f9a35", "#5dbb48", "#46a33a", "#53b241"][j]));
      const a = j * 1.3; m.position.set(Math.cos(a) * 0.45, 0.55 + (j % 2) * 0.3, Math.sin(a) * 0.3); m.scale.setScalar(0.62 + (j % 3) * 0.1);
      m.castShadow = true; this.bush.add(m);
    }
    this.bush.position.set(BUSH[0], ground(BUSH[0], BUSH[2]), BUSH[2]);
    this.root.add(this.bush);
  }

  // ---------- river + stepping stones ----------
  buildRiver() {
    this.water = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uLight: { value: 1 }, uFogCol: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(40, 220) } },
      vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform float uLight; uniform vec3 uFogCol; uniform vec2 uFog; varying vec3 vW; varying float vD;
        void main(){
          float edge = abs(vW.z - (${RIVER_Z.toFixed(2)})) / ${RIVER_HALF.toFixed(2)};
          vec3 deep = vec3(0.08, 0.42, 0.72), shallow = vec3(0.22, 0.72, 0.85);
          vec3 c = mix(deep, shallow, smoothstep(0.35, 1.0, edge));
          float s = sin(vW.x * 1.3 + uTime * 2.2 + sin(vW.z * 2.1) * 1.5) * sin(vW.x * 0.7 - uTime * 1.4 + vW.z * 3.0);
          c += vec3(0.55, 0.85, 0.95) * smoothstep(0.82, 0.97, s) * 0.8;
          c = mix(c, vec3(0.85, 0.97, 1.0), smoothstep(0.86, 1.0, edge) * 0.8);
          c *= uLight;
          c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, vD));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(400, RIVER_HALF * 2 + 1.6, 1, 1), this.water);
    w.rotation.x = -Math.PI / 2; w.position.set(0, WATER_Y, RIVER_Z);
    this.root.add(w);
    const sg = new THREE.CylinderGeometry(0.55, 0.65, 0.5, 10);
    STONES.forEach((s, i) => {
      const m = new THREE.Mesh(sg, toon("#a7a29a"));
      m.position.set(s[0], s[1] - 0.12, s[2]); m.rotation.y = i; m.scale.set(1, 1, 0.85);
      m.castShadow = m.receiveShadow = true; this.root.add(m);
    });
  }

  // ---------- the magic tree ----------
  buildMagicTree() {
    const g = new THREE.Group();
    const [mx, , mz] = MAGIC; const my = ground(mx, mz) - 0.2;
    g.position.set(mx, my, mz);
    const bark = toon("#7b4a2b");
    const prof = [[4.8, 0], [3.4, 0.9], [2.7, 2.6], [2.35, 5.2], [2.45, 7.6], [2.9, 9.6], [3.6, 10.8], [0.01, 11.2]].map(([r, y]) => new THREE.Vector2(r, y));
    const trunk = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), bark);
    trunk.castShadow = trunk.receiveShadow = true; g.add(trunk);
    const limb = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
      const d = to.clone().sub(from), L = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 10), bark);
      m.position.copy(from).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m.castShadow = true; g.add(m);
    };
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; limb(new THREE.Vector3(Math.cos(a) * 2.6, 0.8, Math.sin(a) * 2.6), new THREE.Vector3(Math.cos(a) * 7.5, -0.6, Math.sin(a) * 7.5), 1.0, 0.25); }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; limb(new THREE.Vector3(Math.cos(a) * 1.8, 9.5, Math.sin(a) * 1.8), new THREE.Vector3(Math.cos(a) * 8, 14 + (i % 3), Math.sin(a) * 7), 0.9, 0.35); }
    const r = rng(77);
    const blob = new THREE.IcosahedronGeometry(1, 3);
    const lanternPts: THREE.Vector3[] = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, rr = 2 + r() * 8.5;
      const p = new THREE.Vector3(Math.cos(a) * rr, 13 + r() * 6.5 - rr * 0.25, Math.sin(a) * rr * 0.85);
      const m = toon(["#2fa37a", "#3cbf86", "#24906e", "#47c79a"][i % 4], { emissive: "#ffcf5a", emissiveIntensity: 0 });
      this.canopyMat.push(m);
      const b = new THREE.Mesh(blob, m); b.position.copy(p); b.scale.setScalar(3.2 + r() * 2.2); b.castShadow = true; g.add(b);
      for (let k = 0; k < 4; k++) lanternPts.push(new THREE.Vector3(p.x + (r() - 0.5) * 5, p.y - b.scale.y * 0.7 - r() * 1.5, p.z + (r() - 0.5) * 5));
    }
    // glowing lanterns / fruits
    this.lanternMat = new THREE.MeshBasicMaterial({ color: "#ffd36b", fog: false, toneMapped: true });
    this.lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 12, 8), this.lanternMat, lanternPts.length);
    const M = new THREE.Matrix4();
    lanternPts.forEach((p, i) => { M.makeTranslation(p.x, p.y, p.z); this.lanterns.setMatrixAt(i, M); });
    g.add(noink(this.lanterns));
    // golden halo behind the tree
    const haloTex = canvasTex(256, 256, (c) => { const gr = c.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,220,120,0.9)"); gr.addColorStop(0.4, "rgba(255,200,90,0.35)"); gr.addColorStop(1, "rgba(255,190,80,0)"); c.fillStyle = gr; c.fillRect(0, 0, 256, 256); });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.position.set(0, 12, -4);
    g.add(noink(this.halo));
    // face card on the trunk
    const fm = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, fog: false });
    const fmesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.08), fm);
    fmesh.position.set(0, 5.0, 2.95);
    g.add(noink(fmesh));
    this.face = { mesh: fmesh, mat: fm };
    this.root.add(g);
  }

  // ---------- flowers, grass, mushrooms ----------
  buildFlowers() {
    const atlas = canvasTex(256 * FLOWER_CELLS, 256, (g) => { for (let k = 0; k < FLOWER_CELLS; k++) { g.save(); g.translate(k * 256, 0); drawFlower(new Pen(g), k); g.restore(); } });
    atlas.generateMipmaps = true;
    const r = rng(31);
    const items: { p: V3; s: number; cell: number; ring?: number }[] = [];
    const add = (x: number, z: number, cell: number, s: number, ring?: number) => items.push({ p: [x, ground(x, z) - 0.02, z], s, cell, ring });
    for (let i = 0; i < 9000; i++) {
      const x = (r() - 0.5) * 60, z = -92 + r() * 150;
      const dp = Math.abs(x - pathX(z));
      if (z > -47 && dp < 1.25) continue;
      if (Math.abs(z - RIVER_Z) < RIVER_HALF + 0.2) continue;
      if (Math.hypot(x - CLEARING[0], z - CLEARING[2]) < CLEAR_R + 1) continue;
      const near = Math.exp(-dp / 9);
      if (r() > 0.25 + near) continue;
      const kind = r();
      const cell = kind < 0.42 ? 6 : kind < 0.47 ? 7 : Math.floor(r() * 6);
      add(x, z, cell, cell === 6 ? 0.5 + r() * 0.3 : cell === 7 ? 0.35 + r() * 0.25 : 0.42 + r() * 0.25);
    }
    // the opening meadow: dense flowers
    for (let i = 0; i < 1500; i++) { const x = -14 + r() * 16, z = 30 + r() * 20; if (Math.abs(x - pathX(z)) < 1.3) continue; add(x, z, r() < 0.25 ? 6 : Math.floor(r() * 6), 0.45 + r() * 0.3); }
    const f = new SpriteField(atlas, FLOWER_CELLS, items);
    this.fields.push(f); this.root.add(f.mesh);
    // clearing flowers that bloom with the golden wave (ring = distance from the sapling)
    const ci: { p: V3; s: number; cell: number; ring?: number }[] = [];
    for (let i = 0; i < 1400; i++) {
      const a = r() * Math.PI * 2, d = 1.2 + Math.sqrt(r()) * (CLEAR_R + 4);
      const x = SAPLING[0] + Math.cos(a) * d, z = SAPLING[2] + Math.sin(a) * d;
      if (Math.hypot(x - MAGIC[0], z - MAGIC[2]) < 5) continue;
      if (Math.hypot(x + 0.0, z + 47.5) < 1.3) continue;
      ci.push({ p: [x, ground(x, z) - 0.02, z], s: 0.4 + r() * 0.3, cell: Math.floor(r() * 6), ring: d });
    }
    this.clearFlowers = new SpriteField(atlas, FLOWER_CELLS, ci);
    this.fields.push(this.clearFlowers); this.root.add(this.clearFlowers.mesh);
  }

  // ---------- magic motes ----------
  buildMotes() {
    const r = rng(41);
    const mk = (n: number, gen: () => V3) => {
      const pos = new Float32Array(n * 3), seed = new Float32Array(n), thr = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos.set(gen(), i * 3); seed[i] = r(); thr[i] = 0.35 + r() * 0.6; }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1)); g.setAttribute("aThr", new THREE.BufferAttribute(thr, 1));
      return g;
    };
    this.moteMat = new THREE.ShaderMaterial({
      vertexShader: moteVS, fragmentShader: moteFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uGlow: { value: 1 }, uPx: { value: 1000 }, uRise: { value: 1 }, uCol: { value: new THREE.Color(1.0, 0.82, 0.35) } },
    });
    this.motes = new THREE.Points(mk(1500, () => { const z = -90 + r() * 150; const x = pathX(z) + (r() - 0.5) * 26; return [x, ground(x, z) + 0.4 + r() * 4.5, z]; }), this.moteMat);
    this.motes.frustumCulled = false;
    this.root.add(noink(this.motes));
    const tm = this.moteMat.clone();
    this.treeMotes = new THREE.Points(mk(700, () => { const a = r() * Math.PI * 2, d = r() * 14; return [MAGIC[0] + Math.cos(a) * d, 1 + r() * 18, MAGIC[2] + Math.sin(a) * d * 0.8 + 3]; }), tm);
    this.treeMotes.frustumCulled = false;
    this.root.add(noink(this.treeMotes));
  }

  // ---------- sapling, mound, glow ring ----------
  buildProps() {
    this.sapling = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6), toon("#4a8a2a")); stem.position.y = 0.3; this.sapling.add(stem);
    const leaf = new THREE.IcosahedronGeometry(0.16, 2);
    [[0.12, 0.5, 0], [-0.12, 0.42, 0.05], [0, 0.66, -0.04], [0.06, 0.32, -0.1]].forEach(([x, y, z], i) => { const m = new THREE.Mesh(leaf, toon(i % 2 ? "#6fd04f" : "#57c043")); m.position.set(x, y, z); m.scale.set(1.2, 0.7, 1); this.sapling.add(m); });
    this.sapling.position.set(SAPLING[0], ground(SAPLING[0], SAPLING[2]) - 0.02, SAPLING[2]);
    this.root.add(this.sapling);
    this.mound = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon("#8a5a34"));
    this.mound.position.set(SAPLING[0], ground(SAPLING[0], SAPLING[2]) - 0.03, SAPLING[2]);
    this.mound.scale.set(1, 0.35, 1);
    this.root.add(this.mound);
    const ringTex = canvasTex(512, 512, (c) => { const gr = c.createRadialGradient(256, 256, 180, 256, 256, 256); gr.addColorStop(0, "rgba(255,220,120,0)"); gr.addColorStop(0.6, "rgba(255,230,140,0.9)"); gr.addColorStop(1, "rgba(255,210,100,0)"); c.fillStyle = gr; c.fillRect(0, 0, 512, 512); });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(SAPLING[0], ground(SAPLING[0], SAPLING[2]) + 0.15, SAPLING[2]);
    this.root.add(noink(this.ring));
  }

  // ---------- character / critter cards ----------
  buildCards() {
    const blobTex = canvasTex(128, 64, (c) => { const gr = c.createRadialGradient(64, 32, 0, 64, 32, 62); gr.addColorStop(0, "rgba(30,40,20,0.55)"); gr.addColorStop(0.6, "rgba(30,40,20,0.35)"); gr.addColorStop(1, "rgba(30,40,20,0)"); c.save(); c.scale(1, 0.5); c.restore(); c.fillStyle = gr; c.fillRect(0, 0, 128, 64); });
    const mk = (key: string, shadowW = 0) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.03, fog: true, side: THREE.DoubleSide });
      const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
      const mesh = new THREE.Mesh(g, mat);
      this.root.add(noink(mesh));
      const slot: CardSlot = { mesh, mat };
      if (shadowW) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(shadowW, shadowW * 0.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        s.rotation.x = -Math.PI / 2; this.root.add(noink(s)); slot.shadow = s;
      }
      this.cards[key] = slot;
    };
    mk("chintu", 0.9); mk("sheru", 0.95); mk("bird", 0.3);
    for (let i = 0; i < 3; i++) mk(`rabbit${i}`, 0.5);
    for (let i = 0; i < 2; i++) mk(`squirrel${i}`, 0.45);
    for (let i = 0; i < 4; i++) mk(`flyer${i}`);
    for (let i = 0; i < 26; i++) mk(`fly${i}`);
  }

  tex(key: string, w: number, h: number, dw: number, dh: number, draw: (p: Pen) => void) {
    let t = this.texCache.get(key);
    if (!t) {
      t = canvasTex(w, h, (g) => { g.scale(w / dw, h / dh); draw(new Pen(g)); });
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      this.texCache.set(key, t);
      if (this.texCache.size > 900) { const first = this.texCache.keys().next().value as string; this.texCache.get(first)!.dispose(); this.texCache.delete(first); }
    }
    return t;
  }

  placeCard(slot: CardSlot, tex: THREE.Texture | null, pos: V3, w: number, h: number, cam: THREE.Camera, light: number, mode: "yaw" | "full" = "yaw", visible = true, flip = false) {
    slot.mesh.visible = visible && !!tex;
    if (slot.shadow) slot.shadow.visible = slot.mesh.visible;
    if (!slot.mesh.visible || !tex) return;
    if (slot.mat.map !== tex) { slot.mat.map = tex; slot.mat.needsUpdate = true; }
    slot.mat.color.setRGB(light, light, light * 0.98);
    slot.mesh.position.set(pos[0], pos[1], pos[2]);
    slot.mesh.scale.set(flip ? -w : w, h, 1);
    if (mode === "full") slot.mesh.quaternion.copy(cam.quaternion);
    else slot.mesh.rotation.set(0, Math.atan2(cam.position.x - pos[0], cam.position.z - pos[2]), 0);
    if (slot.shadow) { const gy = ground(pos[0], pos[2]); slot.shadow.position.set(pos[0], Math.max(gy, standY(pos[0], pos[2])) + 0.02, pos[2]); const k = clamp01(1 - (pos[1] - gy) / 1.5); slot.shadow.scale.setScalar(0.6 + 0.4 * k); (slot.shadow.material as THREE.MeshBasicMaterial).opacity = k; }
  }

  // ---------- per frame ----------
  update(t: number, cam: THREE.PerspectiveCamera, size: { w: number; h: number }) {
    const c = camAt(t);
    cam.position.set(...c.pos); cam.lookAt(...c.look); cam.fov = c.fov; cam.aspect = size.w / size.h; cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const G = glowAt(t), TG = treeGlowAt(t);
    const L = 0.62 + 0.38 * Math.min(1, G) + 0.1 * Math.max(0, G - 1);
    // lights + sky
    this.sun.intensity = 3.4 * L; this.hemi.intensity = 1.5 * L;
    this.sun.color.set("#fff0d2").lerp(col("#c8c8ff"), clamp01(1 - G) * 0.6);
    const tgt = new THREE.Vector3(...c.look);
    this.sun.position.set(tgt.x + 30, tgt.y + 45, tgt.z + 18); this.sun.target.position.copy(tgt); this.sun.target.updateMatrixWorld();
    const dim = clamp01((1 - G) / 0.68);
    const top = col("#3d8ce0").lerp(col("#4a5ea8"), dim * 0.75), hor = col("#d4ebff").lerp(col("#a9a6cf"), dim * 0.75);
    this.skyMat.uniforms.uTop.value.copy(top); this.skyMat.uniforms.uHor.value.copy(hor);
    this.sky.position.copy(cam.position);
    this.fog.color.copy(hor);
    for (const cl of this.clouds) (cl.material as THREE.MeshBasicMaterial).color.setScalar(0.75 + 0.25 * L);
    // flowers
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0; right.normalize();
    const ringR = t < T_BURST ? 0 : (t - T_BURST) * 14;
    for (const f of this.fields) {
      f.mat.uniforms.uRight.value.copy(right); f.mat.uniforms.uTime.value = t;
      f.mat.uniforms.uLight.value.setScalar(0.95 * L); f.mat.uniforms.uFogCol.value.copy(this.fog.color); f.mat.uniforms.uFog.value.set(this.fog.near, this.fog.far);
    }
    this.clearFlowers.mat.uniforms.uRing.value = ringR;
    // water
    this.water.uniforms.uTime.value = t; this.water.uniforms.uLight.value = 0.75 + 0.25 * L;
    this.water.uniforms.uFogCol.value.copy(this.fog.color); this.water.uniforms.uFog.value.set(this.fog.near, this.fog.far);
    // motes
    this.moteMat.uniforms.uTime.value = t; this.moteMat.uniforms.uGlow.value = G; this.moteMat.uniforms.uPx.value = size.h * 1.9 / Math.tan((c.fov * Math.PI) / 360);
    const tmm = this.treeMotes.material as THREE.ShaderMaterial;
    tmm.uniforms.uTime.value = t; tmm.uniforms.uGlow.value = Math.min(1.2, TG * 1.1); tmm.uniforms.uPx.value = this.moteMat.uniforms.uPx.value; tmm.uniforms.uRise.value = 0;
    // magic tree
    this.lanternMat.color.setRGB(1.0, 0.8, 0.35).multiplyScalar(0.35 + 2.4 * TG);
    for (const m of this.canopyMat) m.emissiveIntensity = 0.12 * TG;
    (this.halo.material as THREE.MeshBasicMaterial).opacity = clamp01(TG * 0.6);
    this.halo.lookAt(cam.position);
    const tTalk = talkAt("tree", t);
    const smileK = t > T_BURST ? 1 : 0.4;
    const open = treeEyesAt(t);
    const look: [number, number] = t < 48.4 ? [0, 0.4] : [0.15, 0.6];
    const fkey = `face_${open.toFixed(2)}_${tTalk}_${smileK}`;
    const ftex = this.tex(fkey, 700, 490, 1000, 700, (p) => drawTreeFace(p, { open, talk: tTalk ? 0.85 : 0, smile: smileK, look, glow: clamp01(TG) }));
    if (this.face.mat.map !== ftex) { this.face.mat.map = ftex; this.face.mat.needsUpdate = true; }
    this.face.mat.color.setScalar(0.8 + 0.3 * L);
    // bush shake (the funny sound)
    const sh = t > 10.3 && t < 13.9 ? Math.sin(t * 38) * 0.06 * (1 - smooth((t - 13.2) / 0.7)) * (t < 11.4 || t > 12.2 ? 1 : 0.4) : 0;
    this.bush.rotation.set(sh, 0, sh * 1.3); this.bush.scale.set(1 + Math.abs(sh), 1 - Math.abs(sh) * 0.5, 1);
    // ring + sapling + mound
    const ringOn = t > T_BURST && t < T_BURST + 3.2;
    this.ring.visible = ringOn;
    if (ringOn) { this.ring.scale.setScalar(Math.max(0.01, ringR)); (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - smooth((t - T_BURST) / 3.2); }
    const dig = smooth((t - 61.8) / 2.0);
    this.mound.visible = t > 61.8; this.mound.scale.set(dig, 0.35 * dig, dig);
    const grow = t < 64.0 ? 0 : 0.35 + 0.65 * smooth((t - T_BURST) / 1.6) + 0.5 * smooth((t - 67) / 6);
    this.sapling.visible = t > 64.0; this.sapling.scale.setScalar(Math.max(0.001, grow * 1.1));

    // ----- characters -----
    const camRight = right;
    const facing = (a: Act) => {
      if (a.facing !== undefined) return a.facing;
      const h = new THREE.Vector3(...a.heading); return Math.max(-1, Math.min(1, h.dot(camRight) * 1.2));
    };
    const q = (x: number, s = 4) => Math.round(x * s) / s;
    const cl = L * 0.97;
    // Chintu
    const ca = chintuAt(t);
    const away = (a: Act) => a.facing === undefined && new THREE.Vector3(...a.heading).dot(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2)) < -0.55;
    const cpose: ChintuPose = {
      back: away(ca) || undefined, expr: ca.expr as Expr, talk: talkAt("chintu", t), blink: blinkAt(t, 1), face: q(facing(ca)), walk: ca.walk !== undefined ? Math.floor(ca.walk * 12) / 12 : undefined,
      run: ca.run, arms: ca.arms as Arms | undefined, kneel: ca.kneel ? q(ca.kneel, 2) : 0, hop: 0, wave: ca.wave !== undefined ? Math.floor(ca.wave * 8) / 8 : 0,
    };
    const ckey = "c" + JSON.stringify(cpose);
    const ctex = this.tex(ckey, 480, 800, 600, 1000, (p) => drawChintu(p, cpose));
    this.placeCard(this.cards.chintu, ctex, [ca.pos[0], ca.pos[1] + (ca.hop ?? 0) - 0.03, ca.pos[2]], 0.6 * 1.25, 1.25, cam, cl, "yaw", ca.visible);
    // Sheru
    const sa = sheruAt(t);
    const spose: SheruPose = { back: away(sa) || undefined, expr: sa.expr as Expr, talk: talkAt("sheru", t), blink: blinkAt(t, 2), face: q(facing(sa)), pose: (sa.pose ?? "sit") as SheruPose["pose"], phase: Math.floor((sa.phase ?? 0) * 10) / 10, tail: q(sa.tail ?? 0, 2), wink: sa.wink };
    const skey = "s" + JSON.stringify(spose);
    const stex = this.tex(skey, 600, 600, 800, 800, (p) => drawSheru(p, spose));
    this.placeCard(this.cards.sheru, stex, [sa.pos[0], sa.pos[1] - 0.03, sa.pos[2]], 0.82, 0.82, cam, cl, "yaw", sa.visible);
    // the bird
    {
      const hurt = t < 58.6, flying = t > 59.6;
      let p: V3 = [BIRD_AT[0], ground(BIRD_AT[0], BIRD_AT[2]), BIRD_AT[2]];
      let flap = 0;
      if (t > 58.6 && t < 59.6) { p = [p[0], p[1] + Math.max(0, Math.sin((t - 58.6) * Math.PI * 3)) * 0.12, p[2]]; }
      if (flying) {
        const u = t - 59.6;
        if (t < 68) p = [p[0] + Math.sin(u * 1.2) * 1.4 * Math.min(1, u), p[1] + Math.min(2.2, u * 1.3), p[2] - Math.min(1, u) * 0.6 + Math.cos(u * 1.2) * 0.8 - 0.8];
        else p = [Math.sin(t * 1.1) * 3.2, 2.8 + Math.sin(t * 2.2) * 0.4, -49.5 + Math.cos(t * 1.1) * 2.0];
        flap = Math.abs(Math.sin(t * 16));
      }
      const bk = `b${hurt}_${t > 57.3}_${q(flap, 3)}_${blinkAt(t, 3)}`;
      const btex = this.tex(bk, 200, 200, 300, 300, (pn) => drawBird(pn, { flap: q(flap, 3), hurt, bandage: t > 57.3, expr: t < 58.0 ? "sad" : "happy", blink: blinkAt(t, 3) }));
      this.placeCard(this.cards.bird, btex, p, 0.36, 0.36, cam, cl, flying ? "full" : "yaw", t > 54 && t < 90, flying && Math.cos(t * 1.1) < 0);
    }
    // celebration critters
    const party = t > 66.4;
    const rabbitsAt: V3[] = [[-3.0, 0, -49.0], [2.8, 0, -48.6], [-2.0, 0, -45.6]];
    rabbitsAt.forEach((b, i) => {
      const hop = party ? Math.max(0, Math.sin(t * Math.PI * 2.4 + i * 2)) : 0;
      const enter = smooth((t - 66.4 - i * 0.3) / 1.0);
      const p: V3 = [b[0] * (0.6 + 0.4 * enter) + (1 - enter) * Math.sign(b[0]) * 6, 0, b[2] - (1 - enter) * 4];
      p[1] = ground(p[0], p[2]) + hop * 0.35;
      const tx = this.tex(`r${q(hop, 2)}`, 300, 300, 400, 400, (pn) => drawRabbit(pn, { hop: 0, expr: hop > 0.3 ? "happy" : "smile" }));
      this.placeCard(this.cards[`rabbit${i}`], tx, p, 0.6, 0.6, cam, cl, "yaw", party, b[0] > 0);
    });
    [[-4.2, -51.5], [3.9, -51.8]].forEach(([x, z], i) => {
      const hop = Math.max(0, Math.sin(t * Math.PI * 2 + i));
      const p: V3 = [x, ground(x, z) + hop * 0.3, z];
      const tx = this.tex(`sq`, 300, 300, 400, 400, (pn) => drawSquirrel(pn, { hop: 0 }));
      this.placeCard(this.cards[`squirrel${i}`], tx, p, 0.55, 0.55, cam, cl, "yaw", party, x > 0);
    });
    for (let i = 0; i < 4; i++) {
      const a = t * (0.8 + i * 0.15) + i * 1.6, rr = 5 + i * 1.5;
      const p: V3 = [Math.cos(a) * rr, 4.0 + i * 0.8 + Math.sin(t * 2 + i) * 0.4, -51 + Math.sin(a) * rr * 0.6];
      const fl = Math.abs(Math.sin(t * 14 + i));
      const tx = this.tex(`fb${q(fl, 3)}`, 160, 160, 300, 300, (pn) => drawBird(pn, { flap: q(fl, 3), hurt: false, expr: "happy" }));
      this.placeCard(this.cards[`flyer${i}`], tx, p, 0.4, 0.4, cam, cl, "full", party, Math.sin(a) > 0);
    }
    // butterflies: around the meadow, the meeting spot and (later) the clearing
    for (let i = 0; i < 26; i++) {
      const zone = i < 10 ? 0 : i < 16 ? 1 : 2;
      const home: V3 = zone === 0 ? [-11 + (i % 5) * 1.6, 0, 34 + (i % 4) * 3] : zone === 1 ? [4.5 + (i % 3), 0, 20 + (i % 4)] : [-4 + (i % 5) * 2, 0, -52 + (i % 3) * 2];
      const a = t * (0.9 + (i % 4) * 0.2) + i;
      const p: V3 = [home[0] + Math.cos(a) * 1.2, ground(home[0], home[2]) + 0.6 + Math.sin(a * 1.7) * 0.35 + (i % 3) * 0.25, home[2] + Math.sin(a) * 1.0];
      const flap = Math.abs(Math.cos(t * 12 + i * 1.3));
      const show = zone === 2 ? party || t > T_BURST + 0.8 : zone === 1 ? t < 30.5 && G > 0.5 + (i % 6) * 0.08 : t < 30;
      const tx = this.tex(`bf${i % 5}`, 160, 128, 200, 160, (pn) => drawButterfly(pn, i % 5));
      this.placeCard(this.cards[`fly${i}`], tx, p, 0.26 * (0.25 + 0.75 * flap), 0.2, cam, cl, "full", show);
    }
    void shotIndexAt; void lerp; void BIRD_AT; void HIDE_TREE;
    return c;
  }
}
