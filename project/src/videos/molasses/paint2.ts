// Painted textures for the molasses short: riveted tank plates, leak streaks, snowy roofs and sidewalks, the
// 48-star flag, kitchen tiles, a warehouse facade, the molasses sheen. Same conventions as paint.ts (ctex cache,
// seams painted in as dark tints, no heavy ink in textures: the world ink pass draws the silhouettes).
import * as THREE from "three";
import { ctex, jit, rng } from "./paint";

type G = CanvasRenderingContext2D;
type R = () => number;
const U = (r: R, a: number, b: number) => a + (b - a) * r();
const TAU = Math.PI * 2;
const blotch = (g: G, x: number, y: number, rad: number, sx: number, rgb: string, a: number) => {
  g.save(); g.translate(x, y); g.scale(sx, 1);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(-rad, -rad, rad * 2, rad * 2);
  g.restore();
};

/** one tank stave (3.59 m wide x 15 m tall) as a NEUTRAL light grey (the shader multiplies the steel / brown paint
 *  colour in): 6 plate courses with lap seams, vertical seams, rivet rows with a lit top and a dark underside. */
export const tankPlateHD = () => ctex("tankPlate", 512, 2048, (g, r) => {
  const W = 512, H = 2048, py = H / 15; // px per metre
  g.fillStyle = "#e4e4e4"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 40, 140), 1.3, r() < 0.5 ? "255,255,255" : "150,150,150", 0.12);
  const rivet = (x: number, y: number) => {
    g.fillStyle = "rgba(60,60,64,0.55)"; g.beginPath(); g.arc(x + 1.5, y + 2, 5.5, 0, TAU); g.fill();
    g.fillStyle = "#f2f2f2"; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, TAU); g.fill();
  };
  // course seams (lap joints): a dark shadow line under a light lip, two rivet rows
  for (let c = 1; c < 6; c++) {
    const y = H - c * 2.5 * py;
    g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(0, y - 6, W, 4);
    g.fillStyle = "rgba(55,55,60,0.55)"; g.fillRect(0, y - 2, W, 5);
    for (const dy of [-16, 14]) for (let x = 10; x < W; x += 24) rivet(x, y + dy);
  }
  // vertical seam at the stave edge (wraps), offset per course
  for (let c = 0; c < 6; c++) {
    const y0 = H - (c + 1) * 2.5 * py, y1 = H - c * 2.5 * py, x = c % 2 ? W / 2 : 4;
    g.fillStyle = "rgba(55,55,60,0.5)"; g.fillRect(x - 2, y0, 5, y1 - y0);
    g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(x - 6, y0, 3, y1 - y0);
    for (let y = y0 + 14; y < y1 - 8; y += 24) { rivet(x - 16, y); rivet(x + 16, y); }
  }
  // base angle ring
  g.fillStyle = "rgba(60,60,66,0.5)"; g.fillRect(0, H - 22, W, 22);
  for (let x = 10; x < W; x += 24) rivet(x, H - 11);
});

/** leak streaks as a DATA mask (red = streak strength): dark molasses trails running down from the seams */
export const tankLeakHD = () => {
  const t = ctex("tankLeak", 256, 1024, (g, r) => {
    const W = 256, H = 1024, py = H / 15;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    for (let c = 1; c < 6; c++) {
      const y = H - c * 2.5 * py;
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const x = U(r, 10, W - 10), len = U(r, 0.5, 2.2) * py, w0 = U(r, 4, 9);
        const gr = g.createLinearGradient(0, y, 0, y + len);
        gr.addColorStop(0, "rgba(255,0,0,0.95)"); gr.addColorStop(0.8, "rgba(255,0,0,0.75)"); gr.addColorStop(1, "rgba(255,0,0,0)");
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - w0, y); g.lineTo(x + w0, y);
        g.quadraticCurveTo(x + w0 * 0.6, y + len * 0.6, x + 2, y + len); g.lineTo(x - 2, y + len);
        g.quadraticCurveTo(x - w0 * 0.6, y + len * 0.6, x - w0, y); g.fill();
        g.fillStyle = "rgba(255,0,0,0.95)"; g.beginPath(); g.ellipse(x, y + len * 0.97, w0 * 0.7, w0 * 0.9, 0, 0, TAU); g.fill(); // drop bulb
      }
    }
  });
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
};

/** roof tiles under snow: white cover with soft blue shading and the tile courses peeking through near the eaves */
export const snowRoofHD = (col: string) => ctex("snowRoof" + col, 1024, 1024, (g, r) => {
  const S = 1024, C = 64;
  g.fillStyle = col; g.fillRect(0, 0, S, S);
  for (let row = 0; row < S / C; row++) { g.fillStyle = "rgba(55,22,18,0.3)"; g.fillRect(0, row * C + C - 5, S, 5); }
  g.fillStyle = "#f4f6fb"; g.fillRect(0, 0, S, S);
  for (let row = 0; row < S / C; row++) {
    const y = row * C;
    g.fillStyle = "rgba(150,170,210,0.22)"; g.fillRect(0, y + C - 10, S, 8); // soft course ridges under the snow
    g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(0, y + C - 14, S, 3);
  }
  for (let i = 0; i < 30; i++) { // bare patches where the tiles show
    const x = U(r, 0, S), y = U(r, 0, S), w = U(r, 30, 120), h = U(r, 10, 26);
    g.fillStyle = jit(r, col, 0.08); g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(55,22,18,0.25)"; g.fillRect(x - w * 0.8, y + h * 0.3, w * 1.6, 3);
  }
  for (let i = 0; i < 20; i++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 60, 180), 1.5, "170,190,230", 0.12);
});

/** sidewalk under trodden snow: white-blue with grey slush ruts and footprints */
export const snowWalkHD = () => { const t = ctex("snowWalk", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#eef2f9"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 60, 220), 1.6, r() < 0.5 ? "170,185,215" : "255,255,255", 0.25);
  for (let i = 0; i < 90; i++) { // footprints
    const x = U(r, 0, S), y = U(r, 0, S), a = U(r, -0.4, 0.4);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = "rgba(140,155,190,0.35)"; g.beginPath(); g.ellipse(0, 0, 9, 18, 0, 0, TAU); g.fill();
    g.restore();
  }
  for (let i = 0; i < 12; i++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 40, 120), 3, "120,115,110", 0.18); // slush
}); t.repeat.set(0.25, 0.25); return t; };

/** the 1919 US flag (48 stars as dots: no text) */
export const flag48 = () => ctex("flag48", 380, 200, (g) => {
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f4efe6" : "#b8323c"; g.fillRect(0, (i * 200) / 13, 380, 200 / 13 + 1); }
  g.fillStyle = "#2c3a6e"; g.fillRect(0, 0, 152, (7 * 200) / 13);
  g.fillStyle = "#f4efe6";
  for (let row = 0; row < 6; row++) for (let c = 0; c < 8; c++) { g.beginPath(); g.arc(12 + c * 18.5, 10 + row * 17.5, 3.6, 0, TAU); g.fill(); }
});

/** kitchen wall: cream subway tiles */
export const tilesHD = () => ctex("tiles", 1024, 1024, (g, r) => {
  const S = 1024, tw = 128, th = 64;
  g.fillStyle = "#c9bfae"; g.fillRect(0, 0, S, S);
  for (let y = 0, row = 0; y < S; y += th, row++) for (let x = -(row % 2) * tw / 2; x < S; x += tw) {
    g.fillStyle = jit(r, "#f1e9da", 0.03, 3, 0.1); g.fillRect(x + 3, y + 3, tw - 6, th - 6);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(x + 8, y + 7, tw - 30, 4);
  }
});
/** kitchen floor: checker lino */
export const linoHD = () => ctex("lino", 512, 512, (g) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#e9ddc4" : "#5f8f8a"; g.fillRect(x * 64, y * 64, 64, 64); }
  g.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i <= 8; i++) { g.fillRect(i * 64 - 1, 0, 2, 512); g.fillRect(0, i * 64 - 1, 512, 2); }
});

/** warehouse / tenement brick with arched windows (no signs), per metre 64 px */
export const warehouseHD = (key: string, wm: number, hm: number, wall = "#a4503a") => {
  const PX = Math.min(64, 2048 / Math.max(wm, hm)), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("wh" + key, W, H, (g, r) => {
    g.fillStyle = "#d8bfa0"; g.fillRect(0, 0, W, H);
    const bw = m(0.25), bh = m(0.085);
    for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) { g.fillStyle = jit(r, wall, 0.12, 5, 0.15); g.fillRect(x + 1, y + 1, bw - 2, bh - 2); }
    for (let i = 0; i < 10; i++) blotch(g, U(r, 0, W), U(r, 0, H), m(U(r, 0.6, 2)), 1.4, "60,35,30", 0.12);
    const floors = Math.max(1, Math.floor(hm / 3.2)), n = Math.max(1, Math.floor(wm / 2.6));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) * W) / n, by = H - m(fl * 3.2 + 0.8), ww = m(fl === 0 ? 1.6 : 1.0), wh = m(fl === 0 ? 2.2 : 1.6), x0 = cx - ww / 2, y0 = by - wh;
      g.fillStyle = "#e9dcc6"; g.beginPath(); g.moveTo(x0 - m(0.1), by + m(0.08)); g.lineTo(x0 - m(0.1), y0 + ww / 2); g.arc(cx, y0 + ww / 2, ww / 2 + m(0.1), Math.PI, 0); g.lineTo(x0 + ww + m(0.1), by + m(0.08)); g.fill();
      const gl = g.createLinearGradient(0, y0, 0, by); gl.addColorStop(0, "#8d9cdb"); gl.addColorStop(1, "#4f5a9e");
      g.fillStyle = fl === 0 && i % 2 ? "#5a3a2a" : gl;
      g.beginPath(); g.moveTo(x0, by); g.lineTo(x0, y0 + ww / 2); g.arc(cx, y0 + ww / 2, ww / 2, Math.PI, 0); g.lineTo(x0 + ww, by); g.fill();
      g.fillStyle = "rgba(240,235,225,0.9)"; g.fillRect(cx - m(0.025), y0, m(0.05), wh); g.fillRect(x0, y0 + wh * 0.55, ww, m(0.05));
    }
    g.fillStyle = "rgba(50,35,30,0.35)"; g.fillRect(0, H - m(0.4), W, m(0.4));
    g.fillStyle = "#cdb595"; g.fillRect(0, 0, W, m(0.35)); g.fillStyle = "rgba(60,40,30,0.4)"; g.fillRect(0, m(0.35), W, 3);
  });
};

/** molasses surface paint (neutral, multiplied by the molasses colour in the shader): long glossy flow streaks */
export const molassesHD = () => ctex("molasses", 1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = "#c8c8c8"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 80, 260), 2.2, r() < 0.5 ? "255,255,255" : "120,120,120", 0.25);
  g.lineCap = "round";
  for (let i = 0; i < 120; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), len = U(r, 40, 200), w = U(r, 2, 7);
    for (const ox of [0, -S, S]) {
      g.strokeStyle = `rgba(255,255,255,${U(r, 0.18, 0.4)})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x + ox, y); g.bezierCurveTo(x + ox + len * 0.3, y - 10, x + ox + len * 0.7, y + 10, x + ox + len, y); g.stroke();
    }
  }
});

/** stone for the courthouse: pale granite blocks */
export const granite = (key = "granite") => ctex(key, 1024, 1024, (g, r) => {
  const S = 1024, bh = 64;
  g.fillStyle = "#a99f92"; g.fillRect(0, 0, S, S);
  for (let y = 0, row = 0; y < S; y += bh, row++) {
    let x = -(row % 2) * 90;
    while (x < S) { const w = U(r, 140, 220); g.fillStyle = jit(r, "#e3dccf", 0.05, 4, 0.2); g.fillRect(x + 3, y + 3, w - 6, bh - 6); x += w; }
  }
  for (let i = 0; i < 20; i++) blotch(g, U(r, 0, S), U(r, 0, S), U(r, 60, 200), 1.4, "120,110,100", 0.08);
});

export { rng };
