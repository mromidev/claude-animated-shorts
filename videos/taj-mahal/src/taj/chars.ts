// Our own cast for "ताज महल के टेढ़े मीनार": bean-head cards drawn with toon.ts (bodyFront / bodySide), dressed as
// Mughal-era people, plus side-view elephants and camels, the lying figures, the plan sheet and the inlay slab.
import { Pen, Outfit, INK, shade, mix, bodyFront, bodySide, Expr } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

// ---------- cast (fixed palette: same look in every shot) ----------
const SKIN_IN = ["#d9a274", "#c98a5e", "#b5774a", "#e0ad80", "#a8693e"];
export const SHAH_JAHAN: Outfit = {
  jacket: "#f1e3b8", dress: "#f1e3b8", pants: "#b8323a", boots: "#c79a3a", hat: "turban", turban: "#f6efdc", jewel: true,
  beard: "#2a1d18", sash: "#b8323a", skin: "#e0a87e", build: "stout", buttons: "#e8c45a",
};
export const SHAH_JAHAN_OLD: Outfit = { ...SHAH_JAHAN, jacket: "#d9d3c6", dress: "#d9d3c6", beard: "#f4f2ec", jewel: false, sash: "#7a6a8a", turban: "#ecebe6" };
export const MUMTAZ: Outfit = { jacket: "#c2385a", dress: "#c2385a", pants: "#c2385a", boots: "#c79a3a", hat: "hair", hair: "#1e1416", veil: "#f2c94c", skin: "#e9b088" };
export const AURANGZEB: Outfit = {
  jacket: "#2e5d3a", dress: "#2e5d3a", pants: "#efe6d2", boots: "#5a3b2a", hat: "turban", turban: "#efe9da", jewel: true,
  beard: "#1a1210", sash: "#c9a13a", skin: "#d9a274", buttons: "#e8c45a",
};
export const worker = (v: number): Outfit => ({
  jacket: ["#c96d3b", "#e0c48a", "#6a8fb5", "#9a5a3a", "#e6dcc6", "#7a9a4a"][v % 6],
  pants: "#efe6d2", boots: "#7a4f32", hat: "turban", turban: ["#efe9da", "#d8433a", "#f0a830", "#e0c48a", "#ffffff"][v % 5],
  skin: SKIN_IN[v % 5], moustache: v % 3 === 0 ? "#2a1d18" : undefined, belt: null,
});
export const KID: Outfit = { jacket: "#f0a830", pants: "#3b5b9a", boots: "#c98a5e", hat: "hair", hair: "#1e1416", build: "kid", skin: "#d9a274" };
export const FATHER: Outfit = { jacket: "#5a7ab5", pants: "#efe6d2", boots: "#7a4f32", hat: "turban", turban: "#d8433a", moustache: "#2a1d18", skin: "#c98a5e" };

export type Who = "sj" | "sjOld" | "mumtaz" | "aurangzeb" | "kid" | "father" | `w${number}`;
export const outfitOf = (w: Who): Outfit =>
  w === "sj" ? SHAH_JAHAN : w === "sjOld" ? SHAH_JAHAN_OLD : w === "mumtaz" ? MUMTAZ : w === "aurangzeb" ? AURANGZEB : w === "kid" ? KID : w === "father" ? FATHER : worker(Number(w.slice(1)));

export type Pose = {
  who: Who; view: "front" | "side"; expr: Expr; mode?: "march" | "stroll" | "stand" | "sit"; phase?: number; blink?: number;
  facing?: -1 | 0 | 1; hammer?: number; wave?: number; cheer?: number; tilt?: number; headTilt?: number; look?: number;
};
/** a standing character on a 600 x 1000 card, soles at y = 975 */
export const drawPerson = (p: Pen, o: Pose) => {
  const out = outfitOf(o.who), seed = o.who.length * 7 + (o.who.startsWith("w") ? Number(o.who.slice(1)) * 3 : 0) + 1;
  if (o.view === "side") bodySide(p, out, { expr: o.expr, mode: o.mode === "march" || o.mode === "stroll" ? "march" : "stand", phase: o.phase ?? 0, stride: o.mode === "stroll" ? 0.7 : 1, stomp: 0.6, blink: o.blink ?? 0, seed });
  else bodyFront(p, out, {
    expr: o.expr, mode: o.mode ?? "stand", phase: o.phase ?? 0, blink: o.blink ?? 0, facing: o.facing ?? 0, seed, look: o.look ?? 0,
    prop: o.hammer !== undefined ? ["hammer", o.hammer] : null, wave: o.wave, cheer: o.cheer, tilt: o.tilt ?? 0, headTilt: o.headTilt ?? 0,
  });
};

/** a figure lying on its back (head to the left) on a 1000 x 600 card: the standing drawing turned 90 deg */
export const drawLying = (p: Pen, who: Who, expr: Expr, blink: number) => {
  const g = p.g;
  g.save();
  g.translate(20, 560); g.rotate(rad(-90));
  // standing drawing occupies x 0..600, y 0..1000 -> after the turn it lies along +x
  g.translate(-190, -100);
  drawPerson(new Pen(g), { who, view: "front", expr, mode: "stand", blink });
  g.restore();
};

// ---------- animals (side view, facing screen-right) ----------
/** elephant on a 1000 x 800 card, feet at y = 775; phase 0..1 walk cycle */
export const drawElephant = (p: Pen, phase: number, seed = 0) => {
  const grey = ["#9a95a3", "#8f8a99", "#a29dab"][seed % 3], dark = shade(grey, 0.72), two = Math.PI * 2;
  const bob = Math.cos(phase * two * 2) * 6;
  const leg = (x: number, ph: number, far: boolean) => {
    const s = Math.sin((phase + ph) * two), up = Math.max(0, s) * 26;
    const top: P2 = [x, 520 + bob], foot: P2 = [x + s * 40, 765 - up];
    p.line([top, [(top[0] + foot[0]) / 2 + 6, 650], foot], far ? dark : grey, 70);
    p.ell(foot[0], foot[1] + 4, 40, 12, far ? shade(dark, 0.9) : shade(grey, 0.9), 8);
  };
  leg(330, 0.5, true); leg(690, 0, true);
  // tail
  p.line([[210, 430 + bob], [175, 520 + bob], [180, 600 + bob]], dark, 12);
  // body
  p.ell(470, 450 + bob, 280, 175, null, 0);
  const body: P2[] = []; for (let i = 0; i < 60; i++) { const a = (i / 60) * two; body.push([470 + 280 * Math.cos(a), 450 + bob + 175 * Math.sin(a) * (Math.sin(a) < 0 ? 1.05 : 0.95)]); }
  p.gradFill(body, grey, dark, rad(-110));
  p.poly(body, null, 12);
  // decorated cloth (jhool) on the back
  const cl: P2[] = [[360, 300 + bob], [600, 300 + bob], [630, 470 + bob], [340, 470 + bob]];
  p.poly(cl, "#b8323a", 9);
  p.band([[345, 455 + bob], [625, 455 + bob]], "#e8c45a", 18, 3);
  for (let i = 0; i < 5; i++) p.dot(380 + i * 55, 470 + bob, 10, "#e8c45a");
  leg(380, 0, false); leg(640, 0.5, false);
  // head, ear, trunk, tusk, eye
  const hx = 760, hy = 380 + bob;
  p.ell(hx, hy, 120, 115, grey, 12);
  const sw = Math.sin(phase * two) * 0.12;
  const trunk: P2[] = [[hx + 70, hy + 40], [hx + 120, hy + 140], [hx + 115 + 30 * sw * 4, hy + 250], [hx + 150 + 40 * sw * 4, hy + 330]];
  p.line(trunk, grey, 62);
  p.poly([[hx + 60, hy + 85], [hx + 150, hy + 120], [hx + 70, hy + 105]], "#f4f1ea", 6);
  p.ell(hx - 60, hy + 10, 85, 120, dark, 11, 0, 360, -8);
  p.dot(hx + 45, hy - 25, 11);
  p.arc(hx + 45, hy - 40, 20, 10, 200, 340, 6);
};

/** camel on a 1000 x 900 card, feet at y = 875, with two colourful sacks */
export const drawCamel = (p: Pen, phase: number, seed = 0) => {
  const fur = ["#d6a660", "#c9975a", "#ddb06e"][seed % 3], dark = shade(fur, 0.75), two = Math.PI * 2, bob = Math.cos(phase * two * 2) * 8;
  const leg = (x: number, ph: number, far: boolean) => {
    const s = Math.sin((phase + ph) * two), up = Math.max(0, s) * 30;
    p.line([[x, 520 + bob], [x + s * 30 + 10, 700 - up * 0.5], [x + s * 55, 865 - up]], far ? dark : fur, 30);
    p.ell(x + s * 55 + 10, 868 - up, 26, 10, far ? dark : fur, 7);
  };
  leg(330, 0.5, true); leg(600, 0, true);
  p.line([[260, 470 + bob], [235, 560 + bob]], dark, 12);
  const body: P2[] = []; for (let i = 0; i < 60; i++) { const a = (i / 60) * two; body.push([450 + 210 * Math.cos(a), 470 + bob + 110 * Math.sin(a)]); }
  p.gradFill(body, fur, dark, rad(-110)); p.poly(body, null, 11);
  p.ell(440, 340 + bob, 110, 110, fur, 11, 180, 360); // hump
  // sacks
  for (const [x, c] of [[360, "#2f6fb5"], [520, "#c2385a"]] as const) {
    p.poly([[x - 60, 380 + bob], [x + 60, 380 + bob], [x + 70, 540 + bob], [x - 70, 540 + bob]], c, 9);
    p.band([[x - 66, 450 + bob], [x + 66, 450 + bob]], "#e8c45a", 14, 3);
  }
  leg(380, 0, false); leg(640, 0.5, false);
  // neck + head
  const nod = Math.sin(phase * two * 2) * 10;
  p.line([[620, 440 + bob], [700, 330 + bob], [760, 230 + bob + nod]], fur, 70);
  p.ell(800, 215 + bob + nod, 80, 48, fur, 11, 0, 360, 12);
  p.dot(810, 195 + bob + nod, 9);
  p.ell(770, 168 + bob + nod, 14, 22, dark, 6);
  p.arc(860, 238 + bob + nod, 18, 10, 20, 160, 5);
};

// ---------- props on cards ----------
/** the plan sheet Shah Jahan unrolls: a paper with a blue line drawing of the tomb (1000 x 700) */
export const drawPlan = (p: Pen, k: number) => {
  p.poly([[20, 40], [980, 20], [990, 680], [10, 670]], "#f1e6c8", 10);
  p.ell(20, 355, 22, 320, "#e3d4ad", 8);
  p.ell(985, 350, 22, 330, "#e3d4ad", 8);
  const blue = "#2f5fa8", w = 6;
  const line = (pts: P2[]) => p.stroke(pts, w, blue);
  const draw = (u: number) => u <= k;
  // plinth, walls, iwan arch, drum, dome, finial, minarets
  if (draw(0.1)) line([[180, 600], [820, 600]]);
  if (draw(0.25)) { line([[330, 600], [330, 400], [670, 400], [670, 600]]); }
  if (draw(0.4)) { const a: P2[] = [[440, 600], [440, 480]]; for (let i = 0; i <= 12; i++) a.push([440 + 60 * (1 - Math.cos(rad(i * 7.5))) , 480 - 70 * Math.sin(rad(i * 15)) ** 0.8]); line(a); line([[500, 410], [560, 480], [560, 600]]); }
  if (draw(0.55)) line([[420, 400], [420, 360], [580, 360], [580, 400]]);
  if (draw(0.7)) { const d: P2[] = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = Math.PI * t; d.push([500 - Math.cos(a) * 95 * (1 + 0.25 * Math.sin(a)), 360 - Math.sin(a) ** 1.4 * 150 - t * t * 20]); } line(d); }
  if (draw(0.8)) line([[500, 205], [500, 160]]);
  if (draw(0.92)) for (const x of [230, 770]) { line([[x - 18, 600], [x - 12, 300], [x + 12, 300], [x + 18, 600]]); for (const y of [400, 330]) line([[x - 26, y], [x + 26, y]]); line([[x - 20, 300], [x, 265], [x + 20, 300]]); }
};

/** pietra dura: white marble slab with a flowering vine; k 0..1 = how many stones are already set (800 x 800) */
export const INLAY_STONES = ["#c23b2e", "#2c4f9e", "#2f8a5a", "#e0a42a", "#7a3f8a", "#d86a3a"];
export const drawInlay = (p: Pen, k: number) => {
  p.poly([[0, 0], [800, 0], [800, 800], [0, 800]], "#f4f1ea", 0);
  for (let i = 0; i < 18; i++) p.stroke([[i * 50, 0], [i * 50 + 160, 800]], 2, "#e6e1d8"); // faint marble veins
  p.poly([[30, 30], [770, 30], [770, 770], [30, 770]], null, 8);
  const stem: P2[] = []; for (let i = 0; i <= 30; i++) stem.push([400 + 30 * Math.sin(i * 0.35), 740 - i * 20]);
  p.stroke(stem, 12, "#2f6b42");
  const items: { x: number; y: number; r: number; c: string; leaf?: boolean; a?: number }[] = [];
  for (let j = 0; j < 6; j++) { const y = 660 - j * 95, s = j % 2 ? 1 : -1; items.push({ x: 400 + s * 85, y, r: 50, c: "#2f8a5a", leaf: true, a: s * 35 }); }
  const flowers: [number, number, string][] = [[400, 140, INLAY_STONES[0]], [260, 300, INLAY_STONES[1]], [540, 360, INLAY_STONES[3]], [250, 540, INLAY_STONES[4]], [560, 600, INLAY_STONES[5]]];
  for (const [x, y, c] of flowers) for (let i = 0; i < 6; i++) { const a = rad(i * 60); items.push({ x: x + Math.cos(a) * 38, y: y + Math.sin(a) * 38, r: 30, c }); }
  const n = Math.round(items.length * Math.max(0, Math.min(1, k)));
  items.slice(0, n).forEach((it) => {
    if (it.leaf) p.ell(it.x, it.y, it.r, it.r * 0.42, it.c, 5, 0, 360, it.a);
    else p.ell(it.x, it.y, it.r, it.r * 0.8, it.c, 5, 0, 360, Math.atan2(it.y - 300, it.x - 400) * 57);
  });
  for (const [x, y] of flowers) if (n > items.length * 0.6) p.dot(x, y, 16, "#e8c45a");
};

/** jali screen panel: pierced marble lattice, alpha holes (512 x 512) */
export const drawJali = (g: CanvasRenderingContext2D) => {
  g.fillStyle = "#f2efe8"; g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = "destination-out";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const cx = 16 + x * 32, cy = 16 + y * 32;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8, r = i % 2 ? 6 : 11; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  g.globalCompositeOperation = "source-over";
  g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(5, 5, 502, 502);
};

export { mix };
