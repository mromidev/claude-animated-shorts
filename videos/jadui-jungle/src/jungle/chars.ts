// Our own cast for "जादुई जंगल का रहस्य": Chintu (8, yellow shirt, blue shorts, red shoes), Sheru (golden baby lion),
// the Magical Tree's face, plus the forest critters and sprite atlases. Everything is drawn on Canvas2D with the
// Pen API (plum variable ink), then used as camera-facing cards in the 3D world (cards live on the NOINK layer).
import { Pen, INK, shade, mix } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

// ---------- palette (fixed: character consistency) ----------
export const C = {
  skin: "#e9b088", skinSh: "#c98a66", hair: "#1e1416",
  shirt: "#ffd02e", shirtSh: "#e2a915", shorts: "#2f6fd6", shortsSh: "#22529f", shoe: "#e3342b", shoeSole: "#fff4e6",
  lion: "#f2b23a", lionSh: "#d38a22", mane: "#c2571b", maneSh: "#9a3f12", muzzle: "#fff0c8", nose: "#5a2a1a",
  eyeW: "#ffffff", iris: "#3a2214", mouth: "#5a1e28", tongue: "#ef6f7c",
};

export type Expr = "smile" | "talk" | "surprise" | "worried" | "determined" | "laugh" | "kind" | "wow" | "silly" | "grin";
export type Arms = "down" | "swing" | "wave" | "up" | "reach" | "hold" | "cheer" | "point";

const limb = (p: Pen, a: P2, ang1: number, l1: number, ang2: number, l2: number, w: number, col: string): P2 => {
  // angles in degrees from straight down, positive toward +x
  const k: P2 = [a[0] + Math.sin(rad(ang1)) * l1, a[1] + Math.cos(rad(ang1)) * l1];
  const e: P2 = [k[0] + Math.sin(rad(ang2)) * l2, k[1] + Math.cos(rad(ang2)) * l2];
  p.line([a, k, e], col, w);
  return e;
};

const eye = (p: Pen, x: number, y: number, rx: number, ry: number, look: P2, blink: number, closed: "none" | "happy" | "sleep" = "none", irisCol = C.iris, glint = true) => {
  if (closed === "happy") { p.arc(x, y + ry * 0.25, rx * 0.9, ry * 0.7, 200, 340, 11); return; }
  if (closed === "sleep" || blink >= 0.85) { p.arc(x, y - ry * 0.1, rx * 0.9, ry * 0.5, 20, 160, 10); return; }
  const ryb = ry * (1 - blink);
  p.ell(x, y, rx, ryb, C.eyeW, 8);
  p.clip(ellPts(x, y, rx, ryb), () => {
    p.dot(x + look[0] * rx * 0.35, y + look[1] * ry * 0.3, rx * 0.62, irisCol);
    p.dot(x + look[0] * rx * 0.35, y + look[1] * ry * 0.3, rx * 0.36, "#120a08");
    if (glint) { p.dot(x + look[0] * rx * 0.35 - rx * 0.22, y + look[1] * ry * 0.3 - ry * 0.25, rx * 0.17, "#ffffff"); }
  });
};

const ellPts = (cx: number, cy: number, rx: number, ry: number, n = 40): P2[] => {
  const o: P2[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return o;
};

const mouth = (p: Pen, x: number, y: number, s: number, kind: "smile" | "open" | "o" | "laugh" | "flat" | "wavy" | "grin" | "tongue") => {
  switch (kind) {
    case "smile": p.arc(x, y - 10 * s, 34 * s, 22 * s, 20, 160, 9); break;
    case "flat": p.stroke([[x - 22 * s, y], [x + 22 * s, y + 2]], 9); break;
    case "wavy": p.stroke([[x - 26 * s, y + 4], [x - 9 * s, y - 5], [x + 9 * s, y + 4], [x + 26 * s, y - 4]], 8); break;
    case "o": p.ell(x, y, 14 * s, 18 * s, C.mouth, 8); break;
    case "open": {
      const pts: P2[] = []; for (let i = 0; i <= 20; i++) { const a = rad(i * 9); pts.push([x - 30 * s * Math.cos(a), y - 6 * s + 30 * s * Math.sin(a)]); }
      p.poly(pts, C.mouth, 8);
      p.clip(pts, () => p.ell(x, y + 22 * s, 18 * s, 12 * s, C.tongue, 0));
      break;
    }
    case "laugh": case "grin": {
      const w = kind === "laugh" ? 44 : 40, h = kind === "laugh" ? 40 : 24;
      const pts: P2[] = []; for (let i = 0; i <= 24; i++) { const a = rad(i * 7.5); pts.push([x - w * s * Math.cos(a), y - 10 * s + h * s * Math.sin(a)]); }
      p.poly(pts, C.mouth, 8);
      p.clip(pts, () => { p.ell(x, y + (h - 6) * s, 24 * s, 14 * s, C.tongue, 0); p.poly([[x - w * s, y - 10 * s], [x + w * s, y - 10 * s], [x + w * 0.8 * s, y], [x - w * 0.8 * s, y]], "#ffffff", 0); });
      break;
    }
    case "tongue": {
      p.arc(x, y - 10 * s, 34 * s, 20 * s, 20, 160, 9);
      p.ell(x + 8 * s, y + 18 * s, 13 * s, 17 * s, C.tongue, 7);
      p.stroke([[x + 8 * s, y + 8 * s], [x + 8 * s, y + 24 * s]], 4, shade(C.tongue, 0.7));
      break;
    }
  }
};

// =====================================================================================
// CHINTU: design 600 x 1000, soles at y = 975 (1.25 m tall)
// =====================================================================================
export type ChintuPose = { back?: boolean; expr: Expr; talk?: number; blink?: number; face?: number; look?: P2; walk?: number; run?: boolean; arms?: Arms; kneel?: number; hop?: number; wave?: number; tilt?: number };

export const drawChintu = (p: Pen, o: ChintuPose) => {
  const face = o.face ?? 0, phase = o.walk, run = !!o.run, kneel = o.kneel ?? 0;
  const g = p.g;
  const sw = phase === undefined ? 0 : Math.sin(phase * Math.PI * 2);
  const bob = phase === undefined ? 0 : Math.abs(Math.cos(phase * Math.PI * 2)) * (run ? 26 : 12);
  const base = 975 - (o.hop ?? 0) * 120;
  const lean = (run ? 9 : 0) * Math.sign(face || 1) + (o.tilt ?? 0);
  g.save();
  g.translate(300, base); g.rotate(rad(lean)); g.translate(-300, -base);
  const dy = -bob + kneel * 150 + (975 - base) * -1;
  g.translate(0, dy);

  // ---- legs ----
  const hipY = 745, legL = 98, shinL = 100;
  const legs: [number, number, number][] = []; // hip x, thigh angle, shin angle
  if (kneel > 0.5) {
    legs.push([268, -70, 10], [332, 10, -95]);
  } else if (phase !== undefined && run) {
    legs.push([290, 38 * sw * Math.sign(face || 1), (38 * sw - 40 * Math.max(0, sw)) * Math.sign(face || 1)],
      [310, -38 * sw * Math.sign(face || 1), (-38 * sw - 40 * Math.max(0, -sw)) * Math.sign(face || 1)]);
  } else if (phase !== undefined) {
    legs.push([270, 6 * sw * (face ? Math.sign(face) : 1) - 3, 10 * Math.max(0, sw) * -1], [330, -6 * sw * (face ? Math.sign(face) : 1) + 3, 10 * Math.max(0, -sw) * -1]);
  } else legs.push([268, 3, -2], [332, -3, 2]);
  const lift = (i: number) => (phase === undefined || run ? 0 : Math.max(0, i ? -sw : sw) * 34);
  legs.forEach(([hx, a1, a2], i) => {
    const hip: P2 = [hx, hipY - lift(i)];
    const foot = limb(p, hip, a1, legL, a2, shinL - lift(i) * 0.3, 40, C.skin);
    // shoe
    const fx = foot[0] + (face || (i ? 0.25 : -0.25)) * 24;
    p.ell(fx, foot[1] + 8, 40, 22, C.shoe, 9);
    p.poly([[fx - 38, foot[1] + 16], [fx + 38, foot[1] + 16], [fx + 34, foot[1] + 27], [fx - 34, foot[1] + 27]], C.shoeSole, 6);
  });

  // ---- shorts ----
  const sh: P2[] = [[218, 640], [382, 640], [392, 760], [312, 768], [300, 720], [288, 768], [208, 760]];
  p.gradFill(sh, C.shorts, C.shortsSh, rad(-60)); p.poly(sh, null, 10);

  // ---- arms (behind/in front order by pose) ----
  const arms = o.arms ?? (phase !== undefined ? "swing" : "down");
  const shL: P2 = [222, 470], shR: P2 = [378, 470];
  const armAng = (side: number): [number, number] => {
    switch (arms) {
      case "swing": return run ? [side * 10 + 50 * sw * side * -1, side * 10 + 50 * sw * side * -1 + 70 * Math.sign(face || 1)] : [side * 12 - 20 * sw * side, side * 12 - 20 * sw * side - 8];
      case "wave": return side > 0 ? [112 + 12 * Math.sin((o.wave ?? 0) * Math.PI * 2), 158 + 26 * Math.sin((o.wave ?? 0) * Math.PI * 2)] : [-14, -8];
      case "up": return [side * 150, side * 165];
      case "cheer": return [side * 128, side * 160];
      case "reach": return [side * 40 + 25, side * 60 + 35];
      case "hold": return [side * 30, side * 95 * -1 + side * 0];
      case "point": return side > 0 ? [100, 95] : [-12, -6];
      default: return [side * 14, side * 6];
    }
  };
  const drawArm = (s: P2, side: number) => {
    const [a1, a2] = armAng(side);
    const h = limb(p, s, a1, 92, a2, 88, 32, C.skin);
    p.dot(h[0], h[1], 25, INK); p.dot(h[0], h[1], 19, C.skin);
  };

  // ---- torso (shirt) ----
  const tor: P2[] = [[236, 440], [364, 440], [398, 480], [392, 655], [208, 655], [202, 480]];
  p.gradFill(tor, C.shirt, C.shirtSh, rad(-60), 0.3); p.poly(tor, null, 10);
  // sleeves
  for (const [x, s] of [[222, -1], [378, 1]] as const) {
    const sl: P2[] = [[x - 30 * s * -1 - (s > 0 ? 60 : 0), 445], [x + 34 * s, 470], [x + 26 * s, 540], [x - 20 * s, 540]];
    void sl;
  }
  // collar + pocket + buttons
  p.poly([[262, 440], [300, 478], [338, 440], [322, 436], [300, 458], [278, 436]], "#fff3c4", 7);
  p.poly([[318, 520], [362, 520], [360, 560], [320, 560]], shade(C.shirt, 0.92), 6);
  [500, 560, 615].forEach((y) => p.dot(298, y, 7, "#c98a10"));
  const late = arms === "wave" || arms === "cheer" || arms === "up";
  if (!late) { drawArm(shL, -1); drawArm(shR, 1); }
  // short sleeves over the shoulders
  const sleeve = (x: number, s: number) => p.poly([[x - 6 * s, 452], [x + 30 * s, 470], [x + 34 * s, 528], [x - 4 * s, 532]], C.shirt, 9);
  if (!late) { sleeve(212, -1); sleeve(388, 1); }

  // ---- head ----
  const hx = 300 + face * 10, hy = 292;
  p.ell(300, 430, 34, 26, C.skin, 0); // neck
  const ex = face * 42;
  p.ell(hx - 158 + Math.max(0, face) * 36, hy + 20, 30, 40, C.skin, 9); // ears
  p.ell(hx + 158 + Math.min(0, face) * 36, hy + 20, 30, 40, C.skin, 9);
  const head = ellPts(hx, hy, 160, 152, 64).map(([x, y]) => [x, y + (y > hy ? (y - hy) * 0.1 : 0)] as P2);
  p.shadedFill(head, C.skin, C.skinSh, rad(-130), 160, 0.45);
  p.poly(head, null, 11);
  // hair: cap of hair with a side fringe
  const hair: P2[] = [];
  for (let i = 0; i <= 30; i++) { const a = rad(180 + i * 6); hair.push([hx + 166 * Math.cos(a), hy - 8 + 160 * Math.sin(a)]); }
  hair.push([hx + 150, hy + 10], [hx + 120, hy - 40], [hx + 70 + ex, hy - 70], [hx + 40 + ex, hy - 34], [hx + 10 + ex, hy - 75], [hx - 40 + ex, hy - 40], [hx - 70 + ex, hy - 80], [hx - 125, hy - 30], [hx - 152, hy + 12]);
  p.poly(hair, C.hair, 10);
  p.stroke([[hx - 40 + ex, hy - 130], [hx + 10 + ex, hy - 150]], 7, "#4a3a40");
  // tuft on top
  p.poly([[hx - 10, hy - 150], [hx + 22, hy - 200], [hx + 30, hy - 148]], C.hair, 9);

  if (o.back) {
    p.poly(head.map(([x, y]) => [x, y] as P2), C.hair, 11);
    p.stroke([[hx - 60, hy - 60], [hx + 20, hy - 110]], 8, "#4a3a40");
    if (late) { drawArm([212, 474], -1); drawArm([388, 474], 1); sleeve(212, -1); sleeve(388, 1); }
    g.restore();
    return;
  }
  // ---- face ----
  const e = o.expr, blink = o.blink ?? 0, look = o.look ?? [face * 0.6, 0];
  const exy = hy + 18, sep = 62, s = 1;
  const closed = e === "laugh" ? "happy" : "none";
  const ery = e === "surprise" || e === "wow" ? 46 : 40;
  eye(p, hx - sep + ex, exy, 30, ery, look, blink, closed);
  eye(p, hx + sep + ex, exy, 30, ery, look, blink, closed);
  // brows
  const by = exy - 62;
  const brow = (x: number, side: number) => {
    let a = 0, dyb = 0;
    if (e === "worried" || e === "kind") { a = -14 * side; dyb = -4; }
    if (e === "determined") { a = 16 * side; dyb = 6; }
    if (e === "surprise" || e === "wow") dyb = -16;
    const l = 30;
    p.stroke([[x - l * Math.cos(rad(a)), by + dyb - l * Math.sin(rad(a)) * side * 0 - side * l * Math.sin(rad(a)) * 0], [x + l * Math.cos(rad(a)), by + dyb + Math.sin(rad(a)) * l * 1]], 12, C.hair);
  };
  brow(hx - sep + ex, -1); brow(hx + sep + ex, 1);
  // nose
  p.arc(hx + ex * 1.3, exy + 52, 12, 10, 20, 160, 7, shade(C.skinSh, 0.85));
  // mouth
  const mx = hx + ex * 1.1, my = exy + 102;
  const talk = o.talk ?? 0;
  let mk: Parameters<typeof mouth>[4] = "smile";
  if (e === "laugh") mk = "laugh";
  else if (e === "surprise" || e === "wow") mk = talk > 0.5 ? "open" : "o";
  else if (e === "worried") mk = talk > 0.5 ? "open" : "wavy";
  else if (e === "determined") mk = talk > 0.5 ? "open" : "grin";
  else if (e === "talk" || talk > 0.5) mk = "open";
  else if (e === "grin") mk = "grin";
  mouth(p, mx, my, s, mk);
  if (late) { drawArm([212, 474], -1); drawArm([388, 474], 1); sleeve(212, -1); sleeve(388, 1); }
  g.restore();
};

// =====================================================================================
// SHERU: design 800 x 800, soles at y = 775 (0.8 m tall standing)
// =====================================================================================
export type SheruPose = { back?: boolean; expr: Expr; talk?: number; blink?: number; face?: number; look?: P2; pose: "sit" | "stand" | "jump" | "run" | "dig"; phase?: number; tail?: number; wink?: boolean };

const maneTufts = (p: Pen, cx: number, cy: number, r: number, col: string, n = 14, seed = 1) => {
  const pts: P2[] = [];
  for (let i = 0; i < n * 6; i++) {
    const a = (i / (n * 6)) * Math.PI * 2, k = i % 6;
    const rr = r * (1 + 0.16 * Math.sin((k / 6) * Math.PI) + 0.03 * Math.sin(i * 1.7 + seed));
    pts.push([cx + rr * Math.cos(a), cy + rr * 0.95 * Math.sin(a)]);
  }
  p.shadedFill(pts, col, C.maneSh, rad(-120), r, 0.4);
  p.poly(pts, null, 11);
};

export const drawSheru = (p: Pen, o: SheruPose) => {
  const g = p.g, face = o.face ?? 0, ph = o.phase ?? 0, sw = Math.sin(ph * Math.PI * 2);
  const dir = Math.sign(face || 1);
  g.save();
  let hx = 400 + face * 110, hy = 300, bodyY = 590;
  let jumpY = 0;
  if (o.pose === "jump") jumpY = -40;
  if (o.pose === "run") { hy += Math.abs(Math.cos(ph * Math.PI * 2)) * -18; bodyY = 560 + Math.abs(Math.cos(ph * Math.PI * 2)) * -14; }
  if (o.pose === "sit") { hy = 330; }
  if (o.pose === "dig") { hy = 420; hx = 400 + face * 150; }
  g.translate(0, jumpY);

  // tail
  const tw = (o.tail ?? 0) * 25;
  const tb: P2 = o.pose === "sit" ? [400 - dir * 130, 700] : [400 - dir * 190, bodyY - 20];
  const tm: P2 = [tb[0] - dir * 90, tb[1] - 70 + tw], te: P2 = [tb[0] - dir * 120 + tw, tb[1] - 170 + tw * 0.5];
  p.line([tb, tm, te], C.lion, 22);
  p.ell(te[0], te[1], 30, 36, C.mane, 9);

  // body + legs
  const leg = (x: number, y: number, a: number, len: number, col: string) => {
    const e = limb(p, [x, y], a, len * 0.55, a * 0.6, len * 0.45, 46, col);
    p.ell(e[0] + dir * 8, e[1] + 6, 34, 22, col, 9);
    // toes
    p.stroke([[e[0] + dir * 8 - 10, e[1] + 6], [e[0] + dir * 8 - 10, e[1] + 22]], 5); p.stroke([[e[0] + dir * 8 + 10, e[1] + 6], [e[0] + dir * 8 + 10, e[1] + 22]], 5);
  };
  if (o.pose === "sit") {
    leg(320, 640, 25, 120, C.lionSh); leg(480, 640, -25, 120, C.lionSh);
    const body = ellPts(400, 600, 150, 150);
    p.shadedFill(body, C.lion, C.lionSh, rad(-120), 150); p.poly(body, null, 11);
    p.ell(400, 640, 80, 90, C.muzzle, 0);
    leg(345, 620, 2, 150, C.lion); leg(455, 620, -2, 150, C.lion);
  } else {
    const run = o.pose === "run", jump = o.pose === "jump", dig = o.pose === "dig";
    const k = run ? 40 * sw : jump ? 0 : 0;
    const back = (i: number) => (run ? -k * (i ? 1 : -1) : jump ? -40 * dir * (i ? 1 : 0.6) : 0);
    leg(400 - dir * 130, bodyY + 20, back(0) - (dig ? 0 : 0), 190, C.lionSh);
    leg(400 + dir * 90, bodyY + 20, (run ? k : jump ? 40 * dir : dig ? 60 * dir * (0.5 + 0.5 * sw) : 0), 190, C.lionSh);
    const body = ellPts(400, bodyY, 200, 115);
    p.shadedFill(body, C.lion, C.lionSh, rad(-120), 180); p.poly(body, null, 11);
    p.ell(400 + dir * 30, bodyY + 55, 120, 45, C.muzzle, 0);
    leg(400 - dir * 160, bodyY + 40, back(1), 170, C.lion);
    leg(400 + dir * 120, bodyY + 40, (run ? -k : jump ? 50 * dir : dig ? -50 * dir * (0.5 - 0.5 * sw) : 0), 170, C.lion);
  }

  // head: mane, ears, face
  maneTufts(p, hx, hy, 215, C.mane);
  for (const s of [-1, 1]) { p.ell(hx + s * 135 + face * 20, hy - 140, 46, 44, C.lion, 10); p.ell(hx + s * 135 + face * 20, hy - 136, 24, 22, "#f6c98a", 0); }
  if (o.back) { maneTufts(p, hx, hy + 6, 190, C.mane, 14, 4); g.restore(); return; }
  const fpts = ellPts(hx, hy + 10, 170, 158, 60);
  p.shadedFill(fpts, C.lion, C.lionSh, rad(-125), 165, 0.45); p.poly(fpts, null, 10);
  const fx = hx + face * 55;
  // eyes (big, expressive)
  const e = o.expr, blink = o.blink ?? 0, look = o.look ?? [face * 0.5, 0.1];
  const sep = 66, ey = hy - 10;
  const big = e === "wow" || e === "surprise" ? 1.14 : 1;
  const closed = e === "laugh" ? "happy" : "none";
  eye(p, fx - sep, ey, 46 * big, 54 * big, e === "silly" ? [0.6, 0] : look, blink, o.wink ? "happy" : closed);
  eye(p, fx + sep, ey, 46 * big, 54 * big, e === "silly" ? [-0.6, 0] : look, blink, closed);
  // brows
  const bY = ey - 72;
  for (const s of [-1, 1]) {
    let a = 0, d = 0;
    if (e === "worried") { a = -18 * s; d = -6; } else if (e === "determined") { a = 14 * s; d = 8; } else if (e === "wow" || e === "surprise") d = -18;
    const x = fx + s * sep;
    p.stroke([[x - 28, bY + d + (a * s > 0 ? 0 : 0) - 28 * Math.sin(rad(a))], [x + 28, bY + d + 28 * Math.sin(rad(a))]], 13, C.maneSh);
  }
  // muzzle + nose
  p.ell(fx - 38, hy + 92, 52, 42, C.muzzle, 9); p.ell(fx + 38, hy + 92, 52, 42, C.muzzle, 9);
  p.ell(fx, hy + 82, 50, 22, C.muzzle, 0);
  p.poly([[fx - 30, hy + 52], [fx + 30, hy + 52], [fx, hy + 82]], C.nose, 7);
  p.dot(fx - 58, hy + 96, 4, C.maneSh); p.dot(fx - 46, hy + 108, 4, C.maneSh); p.dot(fx + 58, hy + 96, 4, C.maneSh); p.dot(fx + 46, hy + 108, 4, C.maneSh);
  // mouth
  const talk = o.talk ?? 0, my = hy + 150;
  let mk: Parameters<typeof mouth>[4] = "smile";
  if (e === "laugh") mk = "laugh"; else if (e === "silly") mk = "tongue"; else if (e === "grin") mk = "grin";
  else if (e === "wow" || e === "surprise") mk = talk > 0.5 ? "open" : "o";
  else if (e === "worried") mk = talk > 0.5 ? "open" : "wavy";
  else if (talk > 0.5 || e === "talk") mk = "open";
  mouth(p, fx, my, 0.95, mk);
  g.restore();
};

// =====================================================================================
// MAGIC TREE FACE: design 1000 x 700 (no body: drawn onto a card in front of the trunk)
// =====================================================================================
export type TreeFace = { open: number; talk: number; smile: number; look?: P2; glow: number };
export const drawTreeFace = (p: Pen, o: TreeFace) => {
  const bark = "#6b4128", barkD = "#3e2416";
  // sockets
  for (const s of [-1, 1]) {
    const cx = 500 + s * 170, cy = 260;
    p.ell(cx, cy, 120, 100, barkD, 0);
    if (o.open > 0.05) {
      const ry = 78 * o.open;
      p.ell(cx, cy, 92, ry, mix("#ffe9a0", "#fff8d8", o.glow), 10);
      p.clip(ellPts(cx, cy, 92, ry), () => {
        const lk = o.look ?? [0, 0.2];
        p.dot(cx + lk[0] * 30, cy + lk[1] * 20, 50, "#ffb52e");
        p.dot(cx + lk[0] * 30, cy + lk[1] * 20, 26, "#3a1d0c");
        p.dot(cx + lk[0] * 30 - 16, cy + lk[1] * 20 - 18, 11, "#ffffff");
      });
    } else p.arc(cx, cy - 10, 80, 40, 15, 165, 14, "#2a170e");
    // heavy bark brow
    p.poly([[cx - 140, cy - 92 + s * 0], [cx + 130, cy - 120 - s * 14], [cx + 140, cy - 80 - s * 14], [cx - 130, cy - 58]], bark, 12);
  }
  // nose knot
  p.ell(500, 420, 60, 48, bark, 11);
  p.arc(500, 425, 30, 22, 30, 150, 7, barkD);
  // mouth
  const t = o.talk;
  if (t > 0.08) {
    const h = 30 + 70 * t;
    const pts: P2[] = []; for (let i = 0; i <= 24; i++) { const a = rad(i * 7.5); pts.push([500 - 150 * Math.cos(a), 545 - 10 + h * Math.sin(a)]); }
    p.poly(pts, "#2a120a", 12);
    p.clip(pts, () => p.ell(500, 545 + h, 90, 40, "#ff9a3c", 0));
  } else p.arc(500, 520 - o.smile * 10, 150, 40 + o.smile * 50, 20, 160, 16, "#2a170e");
};

// =====================================================================================
// critters: bird (300x300), rabbit (400x400), squirrel (400x400), butterfly (200x160)
// =====================================================================================
export const drawBird = (p: Pen, o: { flap: number; hurt: boolean; bandage?: boolean; expr: "sad" | "happy"; blink?: number }) => {
  const body = "#3fa6ec", wing = "#2178c4";
  p.poly([[60, 190], [20, 170], [30, 215]], wing, 8); // tail
  p.ell(150, 180, 90, 75, body, 10);
  p.ell(165, 205, 55, 40, "#d9f1ff", 0);
  // wing
  const up = o.flap;
  if (o.hurt) p.poly([[105, 175], [70, 225], [150, 205]], wing, 9);
  else p.ell(120, 165 - up * 45, 62, 26 + (1 - up) * 10, wing, 9, 0, 360, -25 - up * 40);
  if (o.bandage) { p.band([[85, 200], [140, 196]], "#ffffff", 16, 4); p.band([[100, 222], [120, 180]], "#ffffff", 12, 4); }
  p.poly([[232, 168], [278, 182], [232, 196]], "#ffa21f", 7);
  eye(p, 200, 160, 20, 22, [0.4, 0], o.blink ?? 0, o.expr === "happy" ? "happy" : "none");
  if (o.expr === "sad") p.stroke([[182, 130], [214, 138]], 6);
  p.stroke([[135, 252], [130, 285]], 6, "#ffa21f"); p.stroke([[165, 252], [168, 285]], 6, "#ffa21f");
};

export const drawRabbit = (p: Pen, o: { hop: number; expr: "happy" | "smile" }) => {
  const fur = "#f4f1ee", sh = "#cfc6d6";
  const y = -o.hop * 60;
  p.g.save(); p.g.translate(0, y);
  p.ell(200, 300, 110, 80, fur, 10);
  p.ell(110, 300, 30, 30, "#ffffff", 9);
  for (const [x, a] of [[245, -12], [290, 10]]) { p.g.save(); p.g.translate(x, 120); p.g.rotate(rad(a)); p.ell(0, -40, 24, 80, fur, 10); p.ell(0, -40, 11, 60, "#f7b7c5", 0); p.g.restore(); }
  p.ell(270, 200, 80, 70, fur, 10);
  p.shadedFill(ellPts(200, 300, 108, 78), fur, sh, rad(-120), 100);
  p.poly(ellPts(200, 300, 110, 80), null, 10);
  p.ell(270, 200, 80, 70, fur, 10);
  eye(p, 300, 190, 16, 20, [0.4, 0], 0, o.expr === "happy" ? "happy" : "none");
  p.ell(345, 215, 10, 8, "#f08aa0", 5);
  mouth(p, 330, 245, 0.5, o.expr === "happy" ? "laugh" : "smile");
  p.ell(170, 372, 40, 18, fur, 8); p.ell(260, 372, 30, 16, fur, 8);
  p.g.restore();
};

export const drawSquirrel = (p: Pen, o: { hop: number }) => {
  const fur = "#d9772f", sh = "#a8541e";
  p.g.save(); p.g.translate(0, -o.hop * 50);
  const tail: P2[] = [];
  for (let i = 0; i <= 30; i++) { const a = rad(-90 + i * 9); tail.push([130 + 90 * Math.cos(a) * (1 + 0.1 * Math.sin(i * 2)), 180 + 140 * Math.sin(a) * (1 + 0.1 * Math.sin(i * 2))]); }
  p.poly(tail, fur, 10); p.ell(150, 200, 40, 90, sh, 0);
  p.ell(230, 290, 70, 85, fur, 10); p.ell(240, 310, 40, 50, "#f6d6a8", 0);
  p.ell(255, 180, 62, 56, fur, 10);
  p.poly([[220, 140], [230, 100], [250, 135]], fur, 8);
  eye(p, 278, 172, 14, 17, [0.4, 0], 0, "happy");
  p.dot(312, 192, 7, INK);
  mouth(p, 290, 215, 0.45, "laugh");
  p.ell(220, 372, 34, 16, fur, 8); p.ell(275, 372, 30, 15, fur, 8);
  p.g.restore();
};

export const BUTTERFLY_COLS = [["#ff6fb5", "#ffd1ec"], ["#ffb02e", "#fff0b8"], ["#8a6bff", "#e1d7ff"], ["#2fd0c5", "#d5fbf6"], ["#ff5a4a", "#ffd8a8"]];
export const drawButterfly = (p: Pen, ci: number) => {
  const [a, b] = BUTTERFLY_COLS[ci % BUTTERFLY_COLS.length];
  for (const s of [-1, 1]) {
    p.poly([[100, 80], [100 + s * 90, 10], [100 + s * 96, 70], [100 + s * 20, 84]], a, 7);
    p.poly([[100, 84], [100 + s * 70, 150], [100 + s * 30, 150], [100 + s * 6, 92]], a, 7);
    p.dot(100 + s * 55, 50, 12, b);
  }
  p.ell(100, 90, 9, 40, INK, 0);
  p.stroke([[100, 52], [86, 20]], 4); p.stroke([[100, 52], [114, 20]], 4);
};

// flower / plant atlas: 8 cells of 256 x 256
export const FLOWER_CELLS = 8;
export const drawFlower = (p: Pen, k: number) => {
  const cols = ["#ff5f8a", "#ffd23a", "#9b6bff", "#ff8a3a", "#ffffff", "#ff4b4b", "#4fc3ff", "#ff9ee0"];
  const c = cols[k % cols.length];
  const stem = "#3c9a3a";
  if (k === 6) { // grass tuft
    for (let i = 0; i < 9; i++) { const x = 50 + i * 20; p.poly([[x - 14, 250], [x + (i - 4) * 9, 90 + (i % 3) * 30], [x + 14, 250]], i % 2 ? "#5fbf3f" : "#46a33a", 5); }
    return;
  }
  if (k === 7) { // mushroom
    p.poly([[105, 250], [110, 150], [146, 150], [151, 250]], "#fff4e0", 8);
    const cap: P2[] = []; for (let i = 0; i <= 20; i++) { const a = rad(180 + i * 9); cap.push([128 + 105 * Math.cos(a), 160 + 95 * Math.sin(a)]); }
    p.poly(cap, "#e83b3b", 9);
    [[90, 110], [140, 90], [175, 130], [120, 140]].forEach(([x, y]) => p.ell(x, y, 13, 10, "#ffffff", 0));
    return;
  }
  p.line([[128, 250], [124, 190], [128, 120]], stem, 12);
  p.ell(95, 200, 30, 14, "#4fb04a", 6, 0, 360, -30); p.ell(160, 185, 30, 14, "#4fb04a", 6, 0, 360, 30);
  const n = k % 2 ? 6 : 5;
  for (let i = 0; i < n; i++) { const a = rad((i * 360) / n - 90); p.ell(128 + Math.cos(a) * 42, 100 + Math.sin(a) * 42, 34, 26, c, 7, 0, 360, (i * 360) / n); }
  p.ell(128, 100, 24, 24, k === 1 ? "#ff8a1f" : "#ffe14a", 7);
};
