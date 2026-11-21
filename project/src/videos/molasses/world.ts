// The whole place as one three.js scene: sky, harbour, Commercial Street with its brick rows, the molasses tank
// (riveted staves that split and fall open), the Atlantic Avenue elevated (columns + girders that bend), the flood
// as a heightfield rewritten every frame from story.ts, the summer park, a modern kitchen (the honey explanation)
// and the courthouse steps. update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, Strand, boxGeo, V, lam, Kit, Ray, kitClone, house, prop, setSight, ROOFS, roofMat, quad, tri } from "./build";
import { ctex, rep, cobbleHD, grassHD, stoneHD, waterNear, waterFar, cloudHD, planksHD, roofHD } from "./paint";
import { tankPlateHD, tankLeakHD, snowRoofHD, snowWalkHD, flag48, tilesHD, linoHD, warehouseHD, molassesHD, granite } from "./paint2";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, V3, smooth, clamp01, easeOut, FOREGROUND, ShotDef, TANK, TANK_R, TANK_H, EL_Z, EL_Y, EL_COLS, QUAY_Z, KITCHEN, COURT,
  stateAt, floodH, State, frontR, crestH, sheetD,
} from "./story";

// ---------------- assets ----------------
const KENNEY = ["cart", "lantern"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  const p = new Pen(g);
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) p.ell(x, y, r, r * 0.85, c, 0);
});
/** per-shot sun override (story.ts ShotDef sunAz/sunEl win) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 1: { az: 145, el: 40 }, 2: { az: 110 }, 7: { az: 140 }, 8: { az: 150, el: 42 }, 9: { az: -40, el: 7 }, 11: { az: 30 }, 12: { az: 8 } };

const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const id = s.id, c = camAt(id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** horizontal quad facing up at height y covering x0..x1, z0..z1 (z0 < z1), uv in metres / tile */
function quadUp(x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  const u0 = x0 / tile, u1 = x1 / tile, v0 = -z1 / tile, v1 = -z0 / tile;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
}

// ---------------- the tank material: plate paint x (steel | brown paint below the paint line) + leak streaks ----------------
const TANK_U = {
  uSteel: { value: new THREE.Color("#8f9fae") }, uBrown: { value: new THREE.Color("#a5643a") }, uMolC: { value: new THREE.Color("#4a1e08") },
  uPaintH: { value: 0 }, uLeak: { value: 0 }, uLeakMap: { value: null as THREE.Texture | null },
};
const tankMaterial = () => {
  const m = twoTone(new THREE.MeshPhongMaterial({ map: tankPlateHD(), color: 0xffffff, specular: "#5a5a5a", shininess: 25, side: THREE.DoubleSide }), 0.15);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    Object.assign(sh.uniforms, TANK_U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTWP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvTWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTWP; uniform vec3 uSteel, uBrown, uMolC; uniform float uPaintH, uLeak; uniform sampler2D uLeakMap;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float painted = 1.0 - smoothstep(uPaintH - 0.04, uPaintH + 0.04, vTWP.y);
        diffuseColor.rgb *= mix(uSteel, uBrown, painted);
        float lk = texture2D(uLeakMap, vMapUv).r * uLeak;
        diffuseColor.rgb = mix(diffuseColor.rgb, uMolC, lk * mix(0.95, 0.12, painted));`);
  };
  m.customProgramCacheKey = () => "tank1";
  return m;
};

// ---------------- flood heightfield ----------------
const FX0 = -112, FX1 = 112, FZ0 = -60, FZ1 = 46, FD = 0.5;
const NXF = Math.round((FX1 - FX0) / FD) + 1, NZF = Math.round((FZ1 - FZ0) / FD) + 1;
const MOL_DARK = new THREE.Color("#5a2a0c"), MOL_CREST = new THREE.Color("#a0561a"), MOL_SET = new THREE.Color("#3a1806");

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private sets: Record<"street" | "kitchen" | "court", THREE.Group> = { street: new THREE.Group(), kitchen: new THREE.Group(), court: new THREE.Group() };
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // seasons
  private walkMat: THREE.MeshLambertMaterial; private yardWinter = new THREE.Group(); private yardSummer = new THREE.Group();
  private snowRoof = new Map<string, THREE.Texture>(); private bareRoof = new Map<string, THREE.Texture>();
  private icicles = new THREE.Group();
  // tank
  private tank = new THREE.Group(); private staves: { g: THREE.Group; th: number; maxA: number; delay: number }[] = [];
  private roof: THREE.Mesh; private tankBase: THREE.Mesh;
  // flood
  private flood: THREE.Mesh; private fpos: Float32Array; private fcol: Float32Array; private fh = new Float32Array(NXF * NZF);
  private floodMat: THREE.MeshPhongMaterial;
  // elevated
  private cols: { s: Strand; x: number; z: number }[] = [];
  private girders: { s: Strand; z: number; y: number }[] = [];
  private ELX = Array.from({ length: 151 }, (_, i) => -150 + i * 2);
  private train = new THREE.Group(); private cars: THREE.Group[] = [];
  // kitchen
  private puddle: THREE.Mesh;
  // courthouse flag
  private flag: THREE.Mesh;
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number }[] = [];
  private swingStage = new THREE.Group();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    for (const g of Object.values(this.sets)) R.add(g);
    const S = this.sets.street;
    // ---- sky + light (as the bridge) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); // 4096 in the bridge: halved for CPU rendering
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.stone = lam("stoneWalk", () => ({ map: rep(stoneHD("copeHD"), 0.5, 0.5) }));
    this.walkMat = lam("walkM", () => ({ map: snowWalkHD() })) as THREE.MeshLambertMaterial;
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.quay = lam("quayHD", () => ({ map: stoneHD("wallHD", ["#c9bcaa", "#bfb19f", "#d1c5b4", "#b8aa97"], "#958776") }));
    M.steel = twoTone(new THREE.MeshPhongMaterial({ color: "#3f5048", specular: "#6a7a70", shininess: 40 }), 0.15); // elevated: dark green-grey
    M.rail = twoTone(new THREE.MeshPhongMaterial({ color: "#8a8f96", specular: "#cccccc", shininess: 60 }), 0.15);
    M.wood = lam("woodTies", () => ({ color: "#6a4a34" }));

    // ---- street ground ----
    const b = new Batch();
    b.add(quadUp(-170, 170, -7, 7, 4, 0), M.cobble);
    b.add(quadUp(-170, 170, -10, -7, 4, 0.12), this.walkMat); b.add(quadUp(-170, 170, 7, 10, 4, 0.12), this.walkMat);
    for (const z of [-7, 7]) b.add(boxGeo(V(-170, 0, z - 0.12), V(170, 0.12, z + 0.12)), M.stone); // kerbs
    b.add(quadUp(-260, 260, QUAY_Z, -10, 4, -0.02), this.walkMat); // yards / wharves south of the street
    b.add(quadUp(-260, 260, 10, 260, 4, -0.02), this.walkMat);     // behind the north row
    // quay wall + harbour bed
    b.add(quad(V(-400, -2.2, QUAY_Z), V(400, -2.2, QUAY_Z), V(400, 0, QUAY_Z), V(-400, 0, QUAY_Z), 100, 1), M.quay);
    for (let x = -120; x <= 120; x += 9) b.add(boxGeo(V(x - 0.2, 0, QUAY_Z + 0.3), V(x + 0.2, 0.55, QUAY_Z + 0.7)), M.steel); // bollards
    // ---- north row (fronts on z = 10, facing the street), back rows for the skyline ----
    setSight(sightLines());
    let x = -150, k = 0;
    while (x < 150) {
      const w = [7, 9, 8][k % 3], cx = x + w / 2, near = Math.abs(cx) < 34;
      const h = near ? [11.2, 14, 12.6][k % 3] : [7, 8.4, 9.8, 7][k % 4];
      house(b, cx, 10 + 4, Math.PI, w, 8, h, near ? [0, 4, 7][k % 3] : k % 8);
      x += w + 0.2; k++;
    }
    for (const [zf, hs] of [[28, [12, 14, 11]], [44, [14, 16, 12]], [62, [12, 15, 13]]] as const) {
      let xx = -140 + (zf % 7);
      while (xx < 140) { const w = 9; house(b, xx + w / 2, zf, Math.PI, w, 10, hs[Math.floor(Math.abs(xx) / 9) % 3], Math.floor(Math.abs(xx * 7 + zf)) % 8); xx += w + 0.6; }
    }
    // south row: warehouses and wharf sheds either side of the tank yard
    for (const sx of [-1, 1]) {
      let xx = 26, kk = 0;
      while (xx < 150) {
        const w = [12, 10, 14][kk % 3], h = [9.8, 8.4, 11.2][kk % 3];
        house(b, sx * (xx + w / 2), -10 - 5, 0, w, 10, h, [0, 4, 7, 2][kk % 4]);
        xx += w + 0.5; kk++;
      }
    }
    // a steeple over the North End (an Old North-like brick church tower), far behind the north row
    const tw = lam("steepleBrick", () => ({ map: warehouseHD("steeple", 6, 30, "#9c4a36") }));
    b.add(boxGeo(V(-66, 0, 78), V(-60, 30, 84), 0), tw);
    b.add(boxGeo(V(-65.4, 30, 78.6), V(-60.6, 35, 83.4), 0), lam("steepleWhite", () => ({ color: "#efe9dc" })));
    const sp = new THREE.ConeGeometry(2.6, 14, 8); b.add(sp, roofMat("#8f97a8"), new THREE.Matrix4().makeTranslation(-63, 42, 81));
    b.build(S);

    // seasonal roofs: every roof material keeps a bare and a snowy paint
    for (const [col, m] of ROOFS) { this.bareRoof.set(col, m.map!); const t = snowRoofHD(col); t.anisotropy = 8; this.snowRoof.set(col, t); }

    // ---- tank yard: winter (packed snow, crates) / summer park (grass, trees, benches) ----
    const yw = new Batch();
    yw.add(quadUp(-24, 24, QUAY_Z, -10, 4, 0.03), lam("yardSnow", () => ({ map: snowWalkHD() })));
    for (const [cx, cz] of [[-18, -14], [-16.8, -14.2], [18.5, -13.5], [-19, -48], [20, -46]] as const) yw.add(boxGeo(V(cx - 0.6, 0, cz - 0.6), V(cx + 0.6, 1.1, cz + 0.6)), lam("crate", () => ({ color: "#a8784a" })));
    yw.build(this.yardWinter); S.add(this.yardWinter);
    const ys = new Batch();
    ys.add(quadUp(-24, 24, QUAY_Z, -10, 4, 0.04), M.grass);
    ys.add(quadUp(-170, 170, -10, -7, 4, 0.13), M.stone); ys.add(quadUp(-170, 170, 7, 10, 4, 0.13), M.stone); // summer sidewalks
    for (const [n, tx, tz, h] of [["tree_oak", -16, -24, 9], ["tree_fat", 15, -27, 8], ["tree_default", -6, -40, 9.5], ["tree_oak", 9, -44, 10], ["tree_detailed", -19, -46, 8.5],
      ["tree_default", 19, -38, 9], ["tree-high-round", 3, -30, 9]] as const) prop(ys, kit, n, tx, 0, tz, h, tx);
    for (const [bx, bz] of [[-8, -12.5], [6, -12.5]]) {
      ys.add(boxGeo(V(bx - 1, 0.42, bz - 0.25), V(bx + 1, 0.5, bz + 0.25)), lam("bench", () => ({ color: "#7a5236" })));
      ys.add(boxGeo(V(bx - 1, 0.5, bz + 0.18), V(bx + 1, 0.95, bz + 0.26)), lam("bench", () => ({ color: "#7a5236" })));
      for (const s of [-0.85, 0.85]) ys.add(boxGeo(V(bx + s - 0.05, 0, bz - 0.2), V(bx + s + 0.05, 0.42, bz + 0.2)), M.steel);
    }
    for (let i = 0; i < 9; i++) prop(ys, kit, "plant_bush", -21 + i * 5.2, 0, -11.3, 1.1, i);
    ys.build(this.yardSummer); S.add(this.yardSummer);
    // icicles under the north-row eaves (winter): small cones along the cornice, visible in the January shots
    const ice = new Batch(), iceM = twoTone(new THREE.MeshPhongMaterial({ color: "#d8ecff", specular: "#ffffff", shininess: 90 }), 0.3);
    for (let xx = -30; xx < 30; xx += 0.45) { const L = 0.25 + 0.55 * Math.abs(Math.sin(xx * 3.7)); const c = new THREE.ConeGeometry(0.07, L, 5); c.rotateX(Math.PI); ice.add(c, iceM, new THREE.Matrix4().makeTranslation(xx, 6.8 - L / 2 + 0.02 * Math.sin(xx), 9.85)); }
    ice.build(this.icicles, false); S.add(this.icicles);

    // ---- water (harbour) ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "harbour1";
    const wm = new THREE.Mesh(quadUp(-900, 900, -900, QUAY_Z, 1, -1.6), waterM);
    wm.receiveShadow = true; S.add(wm);
    // a steamer moored off the quay (simple hull + deckhouse + funnel), smoke from the funnel
    const sb = new Batch();
    sb.add(boxGeo(V(-70, -1.6, -78), V(-30, 2.6, -70), 0), lam("hull", () => ({ color: "#2f3a4a" })));
    sb.add(boxGeo(V(-70, 2.6, -78), V(-30, 3.0, -70), 0), lam("hullTop", () => ({ color: "#b8463a" })));
    sb.add(boxGeo(V(-58, 3.0, -76.5), V(-42, 6.2, -71.5), 0), lam("deckhouse", () => ({ color: "#efe7d6" })));
    sb.add(new THREE.CylinderGeometry(1.1, 1.2, 6, 14), lam("funnel", () => ({ color: "#c9572f" })), new THREE.Matrix4().makeTranslation(-50, 9.2, -74));
    sb.build(S);
    const smokeT = smokeTex();
    for (let kk = 0; kk < 7; kk++) {
      const mat = new THREE.MeshLambertMaterial({ map: smokeT, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK);
      this.smoke.push({ m, mat, top: [-50, 12.4, -74], k: kk / 7 }); S.add(m);
    }

    // lunch bench on the south sidewalk
    const bb = new Batch(), benchM = lam("bench", () => ({ color: "#7a5236" }));
    bb.add(boxGeo(V(-12.2, 0.4, -9.55), V(-8.6, 0.48, -9.05)), benchM);
    bb.add(boxGeo(V(-12.2, 0.48, -9.75), V(-8.6, 0.95, -9.62)), benchM);
    for (const sx of [-11.9, -8.9]) bb.add(boxGeo(V(sx - 0.05, 0.12, -9.6), V(sx + 0.05, 0.4, -9.1)), M.steel);
    bb.build(S);
    // the painters' swing stage: a plank on two ropes from the tank rim
    const sgB = new Batch();
    sgB.add(boxGeo(V(-4.2, -0.12, -0.3), V(4.2, 0, 0.3)), lam("plank", () => ({ color: "#b07a4a" })));
    sgB.build(this.swingStage);
    for (const sx of [-3.9, 3.9]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, 0.5, 0), lam("rope", () => ({ color: "#c9a878" }))); r.position.x = sx; r.name = "rope"; this.swingStage.add(r); }
    S.add(this.swingStage);
    // ---- the tank ----
    const tm = tankMaterial(); TANK_U.uLeakMap.value = tankLeakHD();
    const NST = 24, dth = (Math.PI * 2) / NST;
    for (let i = 0; i < NST; i++) {
      const th = (i + 0.5) * dth;
      // three.js cylinder angle a: x = r sin a, z = r cos a
      const geo = new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 4, 1, true, i * dth, dth).translate(0, TANK_H / 2, 0);
      const bx = TANK_R * Math.sin(th), bz = TANK_R * Math.cos(th);
      geo.translate(-bx, 0, -bz);
      const mesh = new THREE.Mesh(geo, tm); mesh.castShadow = true; mesh.receiveShadow = true;
      const g = new THREE.Group(); g.position.set(TANK[0] + bx, 0, TANK[2] + bz); g.add(mesh);
      const facing = Math.cos(th); // +1 = faces the street (+z)
      this.staves.push({ g, th, maxA: 0.55 + 0.95 * Math.max(0, facing) + 0.25 * Math.abs(Math.sin(i * 2.3)), delay: 0.12 * Math.abs(Math.sin(i * 5.1)) });
      this.tank.add(g);
    }
    const roofG = new THREE.ConeGeometry(TANK_R + 0.35, 2.4, 48, 1, true).translate(0, 1.2, 0);
    this.roof = new THREE.Mesh(roofG, tm); this.roof.castShadow = true;
    this.tank.add(this.roof);
    this.tankBase = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.6, TANK_R + 0.9, 0.5, 48).translate(0, 0.25, 0), lam("tankFoot", () => ({ map: rep(stoneHD("copeHD"), 2, 0.2) })));
    this.tankBase.position.set(TANK[0], 0, TANK[2]); this.tankBase.receiveShadow = true;
    this.tank.add(this.tankBase);
    S.add(this.tank);

    // ---- flood heightfield ----
    const fg = new THREE.BufferGeometry();
    this.fpos = new Float32Array(NXF * NZF * 3); this.fcol = new Float32Array(NXF * NZF * 3);
    const fuv = new Float32Array(NXF * NZF * 2), fidx: number[] = [];
    for (let j = 0; j < NZF; j++) for (let i = 0; i < NXF; i++) {
      const n = j * NXF + i, xx = FX0 + i * FD, zz = FZ0 + j * FD;
      this.fpos.set([xx, -0.4, zz], n * 3); fuv.set([xx / 7, -zz / 7], n * 2);
      if (i < NXF - 1 && j < NZF - 1) { const a = n, bb = n + 1, c = n + NXF, d = n + NXF + 1; fidx.push(a, c, bb, bb, c, d); }
    }
    fg.setAttribute("position", new THREE.BufferAttribute(this.fpos, 3));
    fg.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(NXF * NZF * 3), 3));
    fg.setAttribute("color", new THREE.BufferAttribute(this.fcol, 3));
    fg.setAttribute("uv", new THREE.BufferAttribute(fuv, 2));
    fg.setIndex(fidx);
    this.floodMat = twoTone(new THREE.MeshPhongMaterial({ map: molassesHD(), vertexColors: true, color: 0xffffff, specular: "#6a5038", shininess: 60, emissive: "#2a0f03" }), 0.6);
    { const base = this.floodMat.onBeforeCompile; this.floodMat.onBeforeCompile = (sh, r) => { base.call(this.floodMat, sh, r); sh.fragmentShader = sh.fragmentShader.replace("mix( uShadeCol, lit, sunTerm )", "mix( uShadeCol * vec3( 1.35, 0.95, 0.5 ), lit, sunTerm )"); }; this.floodMat.customProgramCacheKey = () => "flood2"; } // warm-brown shade, not violet
    this.flood = new THREE.Mesh(fg, this.floodMat); this.flood.receiveShadow = true; this.flood.castShadow = false; this.flood.frustumCulled = false;
    S.add(this.flood);

    // ---- the elevated: bents (two columns + cross beam), two girders, ties, rails ----
    for (const cx of EL_COLS) for (const cz of [EL_Z - 2.2, EL_Z + 2.2]) {
      const s = new Strand(6, 0.42, 0.42, M.steel, 2); S.add(s.mesh); this.cols.push({ s, x: cx, z: cz });
    }
    const NX = this.ELX.length;
    for (const [z, y, w, h, mat] of [[EL_Z - 1.6, EL_Y - 0.75, 0.32, 1.1, M.steel], [EL_Z + 1.6, EL_Y - 0.75, 0.32, 1.1, M.steel], [EL_Z, EL_Y - 0.1, 4.2, 0.22, M.wood],
      [EL_Z - 0.72, EL_Y + 0.1, 0.12, 0.16, M.rail], [EL_Z + 0.72, EL_Y + 0.1, 0.12, 0.16, M.rail], [EL_Z - 2.2, EL_Y - 1.45, 0.3, 0.3, M.steel], [EL_Z + 2.2, EL_Y - 1.45, 0.3, 0.3, M.steel]] as const) {
      const s = new Strand(NX, w, h, mat, 2); S.add(s.mesh); this.girders.push({ s, z, y });
    }
    // train: two olive-green cars with a window band, on the elevated deck
    const carTex = ctex("carSide", 512, 128, (g) => {
      g.fillStyle = "#5d7a4a"; g.fillRect(0, 0, 512, 128);
      g.fillStyle = "#e9dcb8"; g.fillRect(0, 26, 512, 40);
      for (let i = 0; i < 10; i++) { g.fillStyle = "#6f7fc2"; g.fillRect(14 + i * 50, 30, 36, 32); g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(18 + i * 50, 33, 8, 26); }
      g.fillStyle = "rgba(30,30,30,0.3)"; g.fillRect(0, 118, 512, 10);
    });
    const carM = lam("carM", () => ({ map: carTex })), carRoof = lam("carRoof", () => ({ color: "#3d4a3a" }));
    for (let c = 0; c < 2; c++) {
      const g = new THREE.Group(), cb = new Batch();
      cb.add(boxGeo(V(-6.4, 0.7, -1.3), V(6.4, 3.4, 1.3), 0), carM);
      cb.add(boxGeo(V(-6.6, 3.4, -1.45), V(6.6, 3.75, 1.45), 0), carRoof);
      for (const sx of [-4.5, 4.5]) cb.add(boxGeo(V(sx - 1, 0.1, -1.0), V(sx + 1, 0.7, 1.0)), M.steel);
      cb.build(g);
      this.cars.push(g); this.train.add(g);
    }
    S.add(this.train);

    // ---- kitchen (modern, for the honey explanation) ----
    const K = KITCHEN, kb = new Batch(), KS = this.sets.kitchen;
    kb.add(quadUp(K[0] - 3, K[0] + 3, K[2] - 1.4, K[2] + 5, 1.6, 0), lam("lino", () => ({ map: linoHD() })));
    kb.add(quad(V(K[0] - 3, 0, K[2] - 1.4), V(K[0] + 3, 0, K[2] - 1.4), V(K[0] + 3, 3, K[2] - 1.4), V(K[0] - 3, 3, K[2] - 1.4), 6, 3), lam("tiles", () => ({ map: tilesHD() })));
    kb.add(quad(V(K[0] - 3, 0, K[2] + 5), V(K[0] - 3, 0, K[2] - 1.4), V(K[0] - 3, 3, K[2] - 1.4), V(K[0] - 3, 3, K[2] + 5), 6, 3), lam("kwall", () => ({ color: "#e8c98e" })));
    kb.add(quad(V(K[0] + 3, 0, K[2] - 1.4), V(K[0] + 3, 0, K[2] + 5), V(K[0] + 3, 3, K[2] + 5), V(K[0] + 3, 3, K[2] - 1.4), 6, 3), lam("kwall", () => ({ color: "#e8c98e" })));
    kb.add(quad(V(K[0] - 3, 3, K[2] - 1.4), V(K[0] + 3, 3, K[2] - 1.4), V(K[0] + 3, 3, K[2] + 5), V(K[0] - 3, 3, K[2] + 5)), lam("kceil", () => ({ color: "#f3ead8" })));
    const cab = lam("cabinet", () => ({ color: "#5f9a8f" })), top = lam("counterTop", () => ({ color: "#efe6d2" })), white = lam("appliance", () => ({ color: "#f4f4f0" }));
    kb.add(boxGeo(V(K[0] - 2.2, 0, K[2] - 1.4), V(K[0] + 3, 0.86, K[2] - 0.8), 0), cab);
    kb.add(boxGeo(V(K[0] - 2.2, 0.86, K[2] - 1.42), V(K[0] + 3, 0.92, K[2] - 0.76), 0), top);
    kb.add(boxGeo(V(K[0] - 2.2, 1.6, K[2] - 1.4), V(K[0] + 3, 2.4, K[2] - 1.05), 0), cab); // wall cupboards
    kb.add(boxGeo(V(K[0] - 3, 0, K[2] - 1.4), V(K[0] - 2.2, 1.95, K[2] - 0.7), 0), white); // fridge
    kb.add(boxGeo(V(K[0] - 2.35, 1.0, K[2] - 0.72), V(K[0] - 2.29, 1.6, K[2] - 0.66)), lam("handle", () => ({ color: "#9aa0a6" })));
    kb.add(boxGeo(V(K[0] - 3, 1.28, K[2] - 0.72), V(K[0] - 2.2, 1.3, K[2] - 0.69)), lam("handle", () => ({ color: "#9aa0a6" })));
    kb.add(boxGeo(V(K[0] + 1.2, 0.92, K[2] - 1.3), V(K[0] + 1.9, 1.32, K[2] - 0.85), 0), white); // microwave
    kb.add(quad(V(K[0] + 1.25, 0.97, K[2] - 0.849), V(K[0] + 1.72, 0.97, K[2] - 0.849), V(K[0] + 1.72, 1.27, K[2] - 0.849), V(K[0] + 1.25, 1.27, K[2] - 0.849)), lam("mwGlass", () => ({ color: "#2f3c52" })));
    for (let i = 0; i < 3; i++) kb.add(boxGeo(V(K[0] + 1.77, 1.0 + i * 0.09, K[2] - 0.86), V(K[0] + 1.85, 1.06 + i * 0.09, K[2] - 0.84)), lam("mwBtn", () => ({ color: "#d9d2c3" })));
    // table + plate of pancakes
    kb.add(boxGeo(V(K[0] - 0.9, 0.72, K[2] - 0.55), V(K[0] + 0.9, 0.78, K[2] + 0.55), 0), lam("tableTop", () => ({ map: rep(planksHD(), 0.6, 0.6) })));
    for (const [lx, lz] of [[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]]) kb.add(boxGeo(V(K[0] + lx - 0.04, 0, K[2] + lz - 0.04), V(K[0] + lx + 0.04, 0.72, K[2] + lz + 0.04)), lam("tableLeg", () => ({ color: "#7a5236" })));
    kb.add(new THREE.CylinderGeometry(0.17, 0.15, 0.02, 32), white, new THREE.Matrix4().makeTranslation(K[0] + 0.05, 0.79, K[2] - 0.15));
    for (let i = 0; i < 4; i++) kb.add(new THREE.CylinderGeometry(0.115 - i * 0.004, 0.118 - i * 0.004, 0.022, 28), lam("pancake", () => ({ color: "#d99a4e" })), new THREE.Matrix4().makeTranslation(K[0] + 0.05, 0.811 + i * 0.022, K[2] - 0.15));
    kb.add(boxGeo(V(K[0] + 0.4, 0.78, K[2] - 0.05), V(K[0] + 0.43, 0.79, K[2] + 0.2)), lam("fork", () => ({ color: "#b8bcc2" })));
    kb.build(KS);
    this.puddle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.012, 28), twoTone(new THREE.MeshPhongMaterial({ color: "#e0a020", specular: "#fff0c0", shininess: 90 }), 0.3));
    this.puddle.position.set(K[0] + 0.05, 0.9, K[2] - 0.15); KS.add(this.puddle);
    // window with a winter view light
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.45, 1.6) }));
    win.position.set(K[0] - 0.6, 1.95, K[2] - 1.39); win.layers.set(NOINK); KS.add(win);

    // ---- courthouse: plaza, steps, portico, pediment, flag ----
    const C = COURT, cb = new Batch(), CS = this.sets.court, gm = lam("granite", () => ({ map: granite() }));
    cb.add(quadUp(C[0] - 60, C[0] + 60, C[2] - 30, C[2] + 60, 4, 0), this.walkMat);
    for (let i = 0; i < 8; i++) cb.add(boxGeo(V(C[0] - 9, 0, C[2] - 4.5), V(C[0] + 9, 0.2 * (i + 1), C[2] - i * 0.5)), gm);
    cb.add(boxGeo(V(C[0] - 13, 0, C[2] - 24), V(C[0] + 13, 12, C[2] - 7), 0), lam("courtWall", () => ({ map: warehouseHD("court", 26, 12, "#b8a48c") })));
    cb.add(boxGeo(V(C[0] - 9.5, 1.6, C[2] - 7.2), V(C[0] + 9.5, 1.8, C[2] - 4.2)), gm);
    for (let i = 0; i < 6; i++) {
      const cx = C[0] - 7.5 + i * 3;
      cb.add(new THREE.CylinderGeometry(0.42, 0.48, 7.6, 18), lam("column", () => ({ color: "#ece5d6" })), new THREE.Matrix4().makeTranslation(cx, 1.8 + 3.8, C[2] - 5));
      cb.add(boxGeo(V(cx - 0.6, 9.4, C[2] - 5.6), V(cx + 0.6, 9.7, C[2] - 4.4)), gm);
    }
    cb.add(boxGeo(V(C[0] - 9.8, 9.7, C[2] - 7.5), V(C[0] + 9.8, 10.8, C[2] - 4.2), 3), gm);
    cb.add(tri(V(C[0] - 10, 10.8, C[2] - 4.25), V(C[0] + 10, 10.8, C[2] - 4.25), V(C[0], 14.2, C[2] - 4.25)), lam("pediment", () => ({ color: "#e6ded0" })));
    cb.add(quad(V(C[0] - 10.3, 10.75, C[2] - 4.0), V(C[0], 14.4, C[2] - 4.0), V(C[0], 14.4, C[2] - 7.6), V(C[0] - 10.3, 10.75, C[2] - 7.6)), roofMat("#8f97a8"));
    cb.add(quad(V(C[0], 14.4, C[2] - 4.0), V(C[0] + 10.3, 10.75, C[2] - 4.0), V(C[0] + 10.3, 10.75, C[2] - 7.6), V(C[0], 14.4, C[2] - 7.6)), roofMat("#8f97a8"));
    cb.add(new THREE.CylinderGeometry(0.08, 0.11, 11, 10), lam("pole", () => ({ color: "#d9d4c8" })), new THREE.Matrix4().makeTranslation(C[0] + 7, 5.5, C[2] + 2));
    cb.add(new THREE.SphereGeometry(0.16, 12, 8), lam("poleBall", () => ({ color: "#e8c45a" })), new THREE.Matrix4().makeTranslation(C[0] + 7, 11.1, C[2] + 2));
    for (let i = 0; i < 10; i++) { const zz = C[2] + 4 + i * 6; for (const s of [-1, 1]) house(cb, C[0] + s * 26, zz, s < 0 ? Math.PI / 2 : -Math.PI / 2, 6, 8, 9.8, i % 8); }
    cb.build(CS);
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.37, 14, 1), lam("flag48", () => ({ map: flag48(), side: THREE.DoubleSide })));
    this.flag.position.set(C[0] + 7, 10.1, C[2] + 2); this.flag.castShadow = true; this.flag.frustumCulled = false; CS.add(this.flag);

    setSight([]);
    for (const fg2 of FOREGROUND) {
      const o = kitClone(kit, fg2.kit, fg2.s ?? 1);
      if (!o) continue;
      o.position.set(...fg2.pos); o.rotation.y = fg2.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg2.a, b: fg2.b }); S.add(o);
    }
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], st = stateAt(id, f);
    for (const k of Object.keys(this.sets) as (keyof World["sets"])[]) this.sets[k].visible = s.set === k;
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (s.set === "kitchen") Rr = 8;
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // kitchen: the sun is a soft window light (no hard cast shadows across the room)
    this.sun.castShadow = s.set !== "kitchen";
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    if (s.set === "kitchen") { this.fog.near = 200; this.fog.far = 900; }
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(id === 12 ? 0.9 : 1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    for (const sm of this.smoke) {
      const u = (t * 0.11 + sm.k) % 1, sz = 2.5 + u * 8;
      sm.m.position.set(sm.top[0] - u * 14, sm.top[1] + u * 11 + u * u * 4, sm.top[2] + u * 3);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.85 * (1 - u) ** 1.2;
    }
    // ---- seasons ----
    const winter = st.season === "winter";
    this.walkMat.map = winter ? (this.walkMat.userData.snow ??= this.walkMat.map) : (this.walkMat.userData.stone ??= rep(stoneHD("copeHD"), 0.5, 0.5));
    for (const [col, m] of ROOFS) m.map = (winter ? this.snowRoof.get(col) : this.bareRoof.get(col)) ?? m.map;
    this.yardWinter.visible = winter; this.yardSummer.visible = !winter;
    this.icicles.visible = winter && (id === 5);
    for (const c of this.cols) c.s.mesh.visible = winter; // the elevated came down long before those summers
    for (const g2 of this.girders) g2.s.mesh.visible = winter;
    this.floodMat.emissive.set(s.light === "golden" ? "#583206" : "#2a0f03");
    // ---- painters' swing stage (shot 4) ----
    this.swingStage.visible = id === 4 && f >= 480 && f < 537;
    if (this.swingStage.visible) {
      const y = Math.max(0, st.tank.paintH - 1.15) + 0.12;
      this.swingStage.position.set(0, y, TANK[2] + TANK_R + 0.55);
      for (const c of this.swingStage.children) if (c.name === "rope") c.scale.y = Math.max(0.1, TANK_H + 0.3 - y);
    }
    // ---- tank, flood, elevated, train ----
    this.poseTank(st, t);
    this.poseFlood(st, t);
    this.poseElevated(st, t);
    // kitchen honey puddle: grows while the warm honey pours (1300-1352), stays after
    const pu = smooth((f - 1302) / 45);
    this.puddle.visible = s.set === "kitchen" && pu > 0.01;
    this.puddle.scale.set(0.02 + 0.08 * pu, 1, 0.02 + 0.08 * pu);
    // courthouse flag waves
    if (s.set === "court") {
      const p = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const u = (i % 15) / 14, y = i < 15 ? 0.685 : -0.685;
        p.setXYZ(i, u * 2.6, y + 0.06 * u * Math.sin(t * 4 - u * 3), 0.28 * u * Math.sin(t * 5 - u * 5));
      }
      p.needsUpdate = true; this.flag.geometry.computeVertexNormals();
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, f, st, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    for (const p of stg.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stg.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.face) { e2.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.rot ?? 0); }
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (let i = 0; i < ai; i++) this.actors[i].bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }

  private poseTank(st: State, t: number) {
    const tk = st.tank;
    this.tank.visible = tk.shown;
    if (!tk.shown) return;
    TANK_U.uPaintH.value = tk.newTank ? -1 : tk.paintH; TANK_U.uLeak.value = tk.newTank ? 0 : tk.leak;
    TANK_U.uSteel.value.set(tk.newTank ? "#a9b6c2" : "#8f9fae");
    const ts = tk.split;
    const axis = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const sv of this.staves) {
      let a = 0, lift = 0;
      if (ts >= 0) {
        const u = clamp01((ts - sv.delay) / 0.55);
        a = sv.maxA * easeOut(u) + 0.06 * Math.sin(u * Math.PI) * Math.sin(sv.th * 7);
        lift = 0;
      } else if (tk.shake) {
        a = -0.004 * Math.sin(t * 57 + sv.th * 3) * tk.shake; // groaning: the wall bulges and settles
      }
      axis.set(Math.cos(sv.th), 0, -Math.sin(sv.th)); // tangent: rotating about it by +a tips the top outward
      q.setFromAxisAngle(axis, a);
      sv.g.quaternion.copy(q); sv.g.position.y = lift;
    }
    // roof: blown up and tossed toward the harbour side, landing tilted on the staves behind
    if (ts >= 0) {
      const u = clamp01(ts / 1.4), hop = 9 * Math.sin(Math.min(1, u) * Math.PI) * (1 - u * 0.3);
      this.roof.position.set(TANK[0] + 3 * u, TANK_H + hop - 13.2 * smooth(u), TANK[2] - 9 * u);
      this.roof.rotation.set(-0.42 * easeOut(u), 0, 0.18 * easeOut(u));
    } else {
      this.roof.position.set(TANK[0], TANK_H + (tk.shake ? 0.02 * Math.sin(t * 40) : 0), TANK[2]); this.roof.rotation.set(0, 0, 0);
    }
  }

  private poseFlood(st: State, t: number) {
    const fl = st.flood;
    this.flood.visible = fl.on && st.tank.shown;
    if (!this.flood.visible) return;
    const P = this.fpos, Cc = this.fcol, H = this.fh;
    const R = frontR(fl.ts), Hc = crestH(fl.ts);
    const dark = MOL_DARK.clone().lerp(MOL_SET, fl.set);
    for (let j = 0; j < NZF; j++) for (let i = 0; i < NXF; i++) {
      const n = j * NXF + i, x = FX0 + i * FD, z = FZ0 + j * FD;
      const h = floodH(fl, x, z); H[n] = h;
      P[n * 3 + 1] = h > 0.005 ? h + 0.02 : -0.4;
      const r = Math.hypot(x - TANK[0], z - TANK[2]), sh = sheetD(fl.ts, r);
      const crest = r < TANK_R + 1.5 ? 0 : Math.pow(clamp01((h - sh) / Math.max(0.5, Hc)), 1.4) * (1 - fl.set) + 0.25 * clamp01(1 - Math.abs(r - R) / 3) * (1 - fl.set);
      Cc[n * 3] = dark.r + (MOL_CREST.r - dark.r) * crest; Cc[n * 3 + 1] = dark.g + (MOL_CREST.g - dark.g) * crest; Cc[n * 3 + 2] = dark.b + (MOL_CREST.b - dark.b) * crest;
    }
    const g = this.flood.geometry;
    g.attributes.position.needsUpdate = true; (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    g.computeVertexNormals();
    const map = this.floodMat.map!; map.offset.set(0.02 * t * (1 - fl.set), 0);
  }

  /** the elevated bends where the wave hits it (around x = 0): columns buckle toward the houses, the deck sags */
  private poseElevated(st: State, t: number) {
    const bendAt = (x: number) => st.bend * Math.exp(-((x / 13) ** 2));
    const dz = (x: number) => 1.6 * bendAt(x), dy = (x: number) => -2.4 * bendAt(x);
    for (const c of this.cols) {
      const k = bendAt(c.x), pts: THREE.Vector3[] = [];
      for (let i = 0; i < 6; i++) {
        const u = i / 5, top = EL_Y - 1.45;
        const bow = k * 1.3 * Math.sin(Math.PI * u) ; // buckled in the middle
        pts.push(V(c.x, u * (top + dy(c.x) * 0.9), c.z + dz(c.x) * u * u + bow + 0.002 * u)); // +z epsilon: one consistent strand frame
      }
      c.s.set(pts);
    }
    for (const gd of this.girders) gd.s.set(this.ELX.map((x) => V(x, gd.y + dy(x) + (gd.z > EL_Z ? 0.25 : -0.1) * bendAt(x) * 1.5, gd.z + dz(x))));
    this.train.visible = st.train !== null;
    if (st.train !== null) {
      this.cars.forEach((g, i) => {
        const cx = st.train! - i * 13.6;
        g.position.set(cx, EL_Y + 0.15 + dy(cx), EL_Z + dz(cx));
        const slope = (dy(cx + 1) - dy(cx - 1)) / 2;
        g.rotation.set(0.45 * bendAt(cx), 0, Math.atan(slope));
      });
    }
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.2 * wTime, 0.0);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
