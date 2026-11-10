// Low-poly 3D cast in the soft "architectural study" look: people, elephants, camels built from primitives,
// posed every frame (walk / stand / sit / lie / cheer / hammer / wave). Smooth standard materials, no outlines.
import * as THREE from "three";

const std = (c: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0, ...extra });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

export type Look = { skin: string; robe: string; pants: string; turban?: string; hair?: string; beard?: string; veil?: string; sash?: string; shoes: string; jewel?: boolean; long?: boolean; kid?: boolean };
const SK = ["#d9a274", "#c98a5e", "#b5774a", "#e0ad80", "#a8693e"];
export const LOOKS: Record<string, Look> = {
  sj: { skin: "#e0a87e", robe: "#f1e3b8", pants: "#b8323a", turban: "#f6efdc", beard: "#2a1d18", sash: "#b8323a", shoes: "#c79a3a", jewel: true, long: true },
  sjOld: { skin: "#e0a87e", robe: "#d9d3c6", pants: "#7a6a8a", turban: "#ecebe6", beard: "#eeece6", sash: "#7a6a8a", shoes: "#a88a5a", long: true },
  mumtaz: { skin: "#e9b088", robe: "#c2385a", pants: "#c2385a", hair: "#1e1416", veil: "#f2c94c", shoes: "#c79a3a", long: true },
  aurangzeb: { skin: "#d9a274", robe: "#2e5d3a", pants: "#efe6d2", turban: "#efe9da", beard: "#1a1210", sash: "#c9a13a", shoes: "#5a3b2a", jewel: true, long: true },
  kid: { skin: "#d9a274", robe: "#f0a830", pants: "#3b5b9a", hair: "#1e1416", shoes: "#c98a5e", kid: true },
  father: { skin: "#c98a5e", robe: "#5a7ab5", pants: "#efe6d2", turban: "#d8433a", beard: "#2a1d18", shoes: "#7a4f32" },
};
export const lookOf = (who: string): Look => {
  if (LOOKS[who]) return LOOKS[who];
  const v = Number(who.slice(1)) || 0;
  return { skin: SK[v % 5], robe: ["#c96d3b", "#e0c48a", "#6a8fb5", "#9a5a3a", "#e6dcc6", "#7a9a4a"][v % 6], pants: "#efe6d2", turban: ["#efe9da", "#d8433a", "#f0a830", "#e0c48a", "#ffffff"][v % 5], beard: v % 3 === 0 ? "#2a1d18" : undefined, shoes: "#7a4f32" };
};

export type FigPose = { walk?: number; mode?: "stand" | "walk" | "sit" | "lie"; cheer?: number; hammer?: number; wave?: number; headTilt?: number; sad?: boolean };

/** a person: origin at the feet, facing +z */
export class Person {
  root = new THREE.Group(); body = new THREE.Group(); head = new THREE.Group();
  legL = new THREE.Group(); legR = new THREE.Group(); armL = new THREE.Group(); armR = new THREE.Group();
  m = { skin: std("#d9a274"), robe: std("#ffffff"), pants: std("#ffffff"), turban: std("#ffffff"), hair: std("#1e1416"), beard: std("#2a1d18"), veil: std("#f2c94c"), sash: std("#b8323a"), shoes: std("#7a4f32"), eye: std("#1a1416", { roughness: 0.4 }), gold: std("#d9b24c", { metalness: 0.5, roughness: 0.35 }) };
  parts: Record<string, THREE.Object3D> = {};
  hammerObj: THREE.Group;
  constructor() {
    const m = this.m;
    this.root.add(this.body);
    // legs: pivot at the hip (y 0.9)
    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0.9, 0);
      leg.add(mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.86, 10), m.pants, 0, -0.45, 0));
      leg.add(mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), m.shoes, 0, -0.88, 0.05));
      this.body.add(leg);
    }
    // robe (jama): flared skirt + torso
    this.parts.skirt = mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.62, 18, 1, true), m.robe, 0, 0.6, 0); (this.parts.skirt as THREE.Mesh).material = m.robe;
    this.parts.short = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 16), m.robe, 0, 0.98, 0);
    this.body.add(this.parts.skirt, this.parts.short);
    this.body.add(mesh(new THREE.CapsuleGeometry(0.2, 0.38, 6, 16), m.robe, 0, 1.22, 0));
    this.parts.sash = mesh(new THREE.TorusGeometry(0.205, 0.04, 6, 20), m.sash, 0, 0.98, 0); this.parts.sash.rotation.x = Math.PI / 2; this.body.add(this.parts.sash);
    // arms: pivot at the shoulder
    for (const [arm, x] of [[this.armL, -0.27], [this.armR, 0.27]] as const) {
      arm.position.set(x, 1.42, 0);
      arm.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 10), m.robe, 0, -0.3, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), m.skin, 0, -0.63, 0));
      this.body.add(arm);
    }
    this.hammerObj = new THREE.Group();
    this.hammerObj.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), std("#8a5a34"), 0, -0.12, 0.0));
    this.hammerObj.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), std("#7d848c", { metalness: 0.4, roughness: 0.5 }), 0, 0.06, 0));
    this.hammerObj.position.set(0, -0.66, 0.05); this.hammerObj.rotation.x = Math.PI / 2;
    this.armR.add(this.hammerObj);
    // head
    this.head.position.set(0, 1.62, 0);
    this.head.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10), m.skin, 0, -0.08, 0));
    this.head.add(mesh(new THREE.SphereGeometry(0.15, 20, 16), m.skin, 0, 0.1, 0));
    for (const x of [-0.055, 0.055]) this.head.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), m.eye, x, 0.13, 0.135));
    this.head.add(mesh(new THREE.ConeGeometry(0.025, 0.06, 8), m.skin, 0, 0.08, 0.15)).rotation.x = Math.PI / 2;
    this.parts.beard = mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.beard, 0, 0.05, 0.03); this.parts.beard.scale.set(1, 1.1, 1);
    this.parts.turban = new THREE.Group();
    const tb = mesh(new THREE.SphereGeometry(0.175, 18, 12), m.turban, 0, 0.2, -0.01); tb.scale.set(1.05, 0.72, 1.05); this.parts.turban.add(tb);
    const tr = mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 22), m.turban, 0, 0.17, 0); tr.rotation.x = Math.PI / 2; this.parts.turban.add(tr);
    this.parts.jewel = new THREE.Group();
    this.parts.jewel.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), std("#d8433a", { roughness: 0.3 }), 0, 0.22, 0.16));
    this.parts.jewel.add(mesh(new THREE.ConeGeometry(0.018, 0.2, 6), std("#f4f1ea"), 0.02, 0.36, 0.12));
    this.parts.turban.add(this.parts.jewel);
    this.parts.hair = mesh(new THREE.SphereGeometry(0.158, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair, 0, 0.11, -0.01);
    this.parts.veil = mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), m.veil, 0, 0.08, -0.03); this.parts.veil.scale.set(1, 1.25, 1);
    this.head.add(this.parts.beard, this.parts.turban, this.parts.hair, this.parts.veil);
    this.body.add(this.head);
  }
  dress(who: string) {
    const L = lookOf(who), m = this.m;
    m.skin.color.set(L.skin); m.robe.color.set(L.robe); m.pants.color.set(L.pants); m.shoes.color.set(L.shoes);
    m.turban.color.set(L.turban ?? "#ffffff"); m.hair.color.set(L.hair ?? "#1e1416"); m.beard.color.set(L.beard ?? "#2a1d18");
    m.veil.color.set(L.veil ?? "#ffffff"); m.sash.color.set(L.sash ?? L.robe);
    this.parts.turban.visible = !!L.turban; this.parts.jewel.visible = !!L.jewel; this.parts.beard.visible = !!L.beard;
    this.parts.hair.visible = !!L.hair && !L.veil; this.parts.veil.visible = !!L.veil;
    this.parts.skirt.visible = !!L.long; this.parts.short.visible = !L.long; this.parts.sash.visible = !!L.sash;
    this.root.scale.setScalar(L.kid ? 0.66 : 1);
  }
  pose(p: FigPose) {
    const two = Math.PI * 2, walk = p.mode === "walk" ? Math.sin((p.walk ?? 0) * two) : 0;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.legL.rotation.set(walk * 0.5, 0, 0); this.legR.rotation.set(-walk * 0.5, 0, 0);
    this.armL.rotation.set(-walk * 0.45, 0, -0.08); this.armR.rotation.set(walk * 0.45, 0, 0.08);
    if (p.mode === "walk") this.body.position.y = Math.abs(Math.cos((p.walk ?? 0) * two)) * 0.03;
    this.head.rotation.set(((p.headTilt ?? 0) * Math.PI) / 180 + (p.sad ? 0.35 : 0), 0, 0);
    if (p.mode === "sit") {
      this.body.position.y = -0.45;
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.set(-0.5, 0, -0.1); this.armR.rotation.set(-0.5, 0, 0.1);
    }
    if (p.cheer !== undefined) { const k = p.cheer; this.armL.rotation.set(0, 0, -2.6 - 0.3 * k); this.armR.rotation.set(0, 0, 2.6 + 0.3 * k); }
    if (p.wave !== undefined) this.armR.rotation.set(0, 0, 2.3 + 0.35 * Math.sin(p.wave * two));
    this.hammerObj.visible = p.hammer !== undefined;
    if (p.hammer !== undefined) this.armR.rotation.set(-0.6 - 1.6 * (1 - p.hammer), 0, 0.15);
    if (p.mode === "lie") { this.armL.rotation.set(0, 0, -0.15); this.armR.rotation.set(0, 0, 0.15); }
  }
}

/** elephant facing +z, feet at y 0, 3.2 m tall at the head */
export class Elephant {
  root = new THREE.Group(); legs: THREE.Group[] = []; trunk = new THREE.Group();
  constructor(seed = 0) {
    const grey = std(["#9a95a3", "#8f8a99", "#a29dab"][seed % 3], { roughness: 0.95 });
    const body = mesh(new THREE.SphereGeometry(1, 24, 18), grey, 0, 2.0, 0); body.scale.set(1.15, 1.0, 1.7); this.root.add(body);
    [[-0.6, 1.0], [0.6, 1.0], [-0.6, -1.0], [0.6, -1.0]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 1.6, z);
      g.add(mesh(new THREE.CylinderGeometry(0.33, 0.3, 1.6, 12), grey, 0, -0.8, 0));
      this.legs.push(g); this.root.add(g);
    });
    const head = mesh(new THREE.SphereGeometry(0.75, 20, 16), grey, 0, 2.55, 1.7); this.root.add(head);
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.75, 16, 12), grey, s * 0.7, 2.55, 1.45); e.scale.set(0.18, 1.0, 0.85); this.root.add(e); }
    this.trunk.position.set(0, 2.35, 2.3);
    let parent: THREE.Object3D = this.trunk;
    for (let i = 0; i < 5; i++) { const seg = new THREE.Group(); seg.position.y = i === 0 ? 0 : -0.32; seg.rotation.x = 0.12; seg.add(mesh(new THREE.CylinderGeometry(0.2 - i * 0.025, 0.18 - i * 0.025, 0.34, 10), grey, 0, -0.16, 0)); parent.add(seg); parent = seg; }
    this.root.add(this.trunk);
    const ivory = std("#f4f1ea");
    for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.07, 0.7, 8), ivory, s * 0.32, 2.05, 2.25); t.rotation.x = 2.2; this.root.add(t); }
    for (const x of [-0.3, 0.3]) this.root.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), std("#1a1416"), x, 2.75, 2.35));
    const cloth = mesh(new THREE.BoxGeometry(2.05, 0.9, 1.6), std("#b8323a"), 0, 2.6, -0.2); this.root.add(cloth);
    const trim = mesh(new THREE.BoxGeometry(2.1, 0.12, 1.65), std("#e0b84a", { metalness: 0.3, roughness: 0.5 }), 0, 2.2, -0.2); this.root.add(trim);
  }
  pose(phase: number) {
    const two = Math.PI * 2;
    this.legs.forEach((g, i) => { g.rotation.x = Math.sin((phase + (i === 0 || i === 3 ? 0 : 0.5)) * two) * 0.28; });
    this.trunk.rotation.x = 0.1 + Math.sin(phase * two) * 0.12;
    this.root.children[0].position.y = 2.0 + Math.abs(Math.cos(phase * two * 2)) * 0.04;
  }
}

/** camel facing +z with two coloured sacks */
export class Camel {
  root = new THREE.Group(); legs: THREE.Group[] = []; neck = new THREE.Group();
  constructor(seed = 0) {
    const fur = std(["#d6a660", "#c9975a", "#ddb06e"][seed % 3], { roughness: 0.95 });
    const body = mesh(new THREE.SphereGeometry(0.6, 20, 14), fur, 0, 1.55, 0); body.scale.set(0.9, 0.85, 1.6); this.root.add(body);
    const hump = mesh(new THREE.SphereGeometry(0.45, 16, 12), fur, 0, 2.0, -0.05); hump.scale.set(1, 0.9, 1.2); this.root.add(hump);
    [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.7], [0.3, -0.7]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 1.35, z);
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.35, 8), fur, 0, -0.67, 0));
      this.legs.push(g); this.root.add(g);
    });
    this.neck.position.set(0, 1.7, 0.85); this.neck.rotation.x = 0.55;
    this.neck.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.0, 10), fur, 0, 0.45, 0));
    const head = mesh(new THREE.SphereGeometry(0.22, 14, 10), fur, 0, 0.95, 0.15); head.scale.set(0.8, 0.8, 1.5); this.neck.add(head);
    this.root.add(this.neck);
    for (const [s, c] of [[-1, "#2f6fb5"], [1, "#c2385a"]] as const) this.root.add(mesh(new THREE.BoxGeometry(0.28, 0.55, 0.7), std(c), s * 0.62, 1.55, 0));
  }
  pose(phase: number) {
    const two = Math.PI * 2;
    this.legs.forEach((g, i) => { g.rotation.x = Math.sin((phase + (i === 0 || i === 3 ? 0 : 0.5)) * two) * 0.35; });
    this.neck.rotation.x = 0.55 + Math.sin(phase * two * 2) * 0.06;
  }
}
