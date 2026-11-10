// "जादुई जंगल का रहस्य – एक छोटी सी दोस्ती": 1920x1080, 30 fps.
// One three.js world posed per frame (world.ts) + post: ink -> lens blur -> bloom -> NEUTRAL tone map -> mood grade.
// Overlays (DOM): title, Hindi subtitles synced to the word timings, the moral, the end card, flashes and fades.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, interpolate, Easing, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import "@fontsource/baloo-2/devanagari-700.css";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/devanagari-800.css";
import "@fontsource/noto-sans-devanagari/devanagari-700.css";
import { World } from "./world";
import { InkPass } from "./ink";
import { LensBlur } from "./lensblur";
import { MoodGrade } from "./grade";
import { FPS, TOTAL, SHOTS, shotIndexAt, glowAt, T_BURST, lineAt, clamp01 } from "./story";

export const FILM_FRAMES = TOTAL;
const W = 1920, H = 1080;

type Toggles = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean; overlay: boolean; msaa: number; shadows: boolean; dpr?: number };
const toggles = (): Toggles => ({ ink: true, lens: false, bloom: true, grade: true, overlay: true, msaa: 0, shadows: true, ...((getInputProps() as { post?: Partial<Toggles> }).post ?? {}) });

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const { camera, scene, size } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(toggles, []);
  useEffect(() => { scene.fog = world.fog; }, [scene, world]);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera, { widthNear: 4.2, widthFar: 2.6, distNear: 4, distFar: 70, fadeNear: 90, fadeFar: 260 }),
    lens: new LensBlur({ maxCoC: 22, nearScale: 1.1 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.75, luminanceThreshold: 0.92, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 6, radius: 0.7 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new MoodGrade(),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  world.update(t, cam, { w: size.width, h: size.height });
  // depth of field per shot
  const shot = SHOTS[shotIndexAt(t)];
  cam.getWorldDirection(fwd);
  const c = shot.cam(t, (t - shot.a) / (shot.b - shot.a));
  if (shot.focus) fpt.set(...shot.focus(t)); else fpt.set(...c.look);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = shot.dof * 1.3;
  // mood grade follows the forest's magic
  const G = glowAt(t);
  const dim = clamp01((1 - G) / 0.68);
  const burst = clamp01(G - 1) / 0.3;
  fx.grade.set(1.0 + 0.05 * burst, 1.06, 1.14 - 0.42 * dim + 0.08 * burst, [0.0, 0.01 + 0.01 * dim, 0.03 + 0.05 * dim], [0.02 + 0.02 * burst, 0.012 + 0.01 * burst, -0.01 - 0.02 * dim], 0.2 + 0.12 * dim);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={on.msaa}>
        {on.ink ? <primitive object={fx.ink} dispose={null} /> : <></>}
        {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : <></>}
        {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : <></>}
        {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : <></>}
        <primitive object={fx.tone} dispose={null} />
        {on.grade ? <primitive object={fx.grade} dispose={null} /> : <></>}
      </EffectComposer>
    </>
  );
};

// ---------------- overlays ----------------
const HFONT = "'Baloo 2', 'Noto Sans Devanagari', sans-serif";
const SFONT = "'Noto Sans Devanagari', 'Baloo 2', sans-serif";
const outline = (px: number, c = "#1d1030") => {
  const s: string[] = [];
  for (let a = 0; a < 16; a++) s.push(`${(Math.cos((a / 16) * Math.PI * 2) * px).toFixed(1)}px ${(Math.sin((a / 16) * Math.PI * 2) * px).toFixed(1)}px 0 ${c}`);
  return s.join(",");
};

const Title: React.FC<{ t: number }> = ({ t }) => {
  if (t > 5.0) return null;
  const a = interpolate(t, [0.3, 1.0, 4.1, 4.8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = interpolate(t, [0.3, 1.1], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 120, opacity: a }}>
      <div style={{ transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ fontFamily: HFONT, fontWeight: 800, fontSize: 104, color: "#ffe066", textShadow: outline(7) + ", 0 10px 24px rgba(0,0,0,0.35)", lineHeight: 1.15 }}>जादुई जंगल का रहस्य</div>
        <div style={{ fontFamily: HFONT, fontWeight: 700, fontSize: 56, color: "#ffffff", textShadow: outline(5), marginTop: 6 }}>एक छोटी सी दोस्ती</div>
      </div>
    </AbsoluteFill>
  );
};

const SPK_COL: Record<string, string> = { narrator: "#ffffff", chintu: "#ffe14d", sheru: "#ffb066", tree: "#9df2c2" };
const SPK_NAME: Record<string, string> = { narrator: "", chintu: "चिंटू", sheru: "शेरू", tree: "जादुई पेड़" };

const Subtitle: React.FC<{ t: number }> = ({ t }) => {
  const L = lineAt(t);
  if (!L || L.t0 > 81) return null; // the moral has its own title
  const a = interpolate(t, [L.t0 - 0.1, L.t0 + 0.08, L.t1 + 0.3, L.t1 + 0.45], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = L.text.split(" ");
  // highlight words already spoken
  let spoken = 0;
  for (let i = 0; i < L.words.length; i++) if (t >= L.words[i].t) spoken = i + 1;
  const name = SPK_NAME[L.spk];
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 54, opacity: a }}>
      <div style={{ maxWidth: 1760, textAlign: "center", fontFamily: SFONT, fontWeight: 700, fontSize: 46, lineHeight: 1.35, padding: "10px 34px 12px", borderRadius: 22, background: "rgba(20,10,35,0.42)" }}>
        {name ? <span style={{ color: SPK_COL[L.spk], textShadow: outline(3.5), marginRight: 18 }}>{name}:</span> : null}
        {words.map((w, i) => (
          <span key={i} style={{ color: i < spoken ? SPK_COL[L.spk] : "#ffffff", textShadow: outline(3.5), opacity: i < spoken || L.spk !== "narrator" ? 1 : 0.92 }}>{w}{i < words.length - 1 ? " " : ""}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Moral: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  const t = f / fps;
  if (t < 81.5) return null;
  const words = ["सच्ची", "दोस्ती", "और", "दया", "से", "दुनिया", "खूबसूरत", "बनती", "है!"];
  const tag = spring({ frame: f - Math.round(81.5 * fps), fps, config: { damping: 12 } });
  const out = interpolate(t, [85.2, 85.7], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 70, opacity: out }}>
      <div style={{ transform: `scale(${tag})`, fontFamily: HFONT, fontWeight: 800, fontSize: 70, color: "#ff8a3d", textShadow: outline(6, "#ffffff") + ", 0 6px 18px rgba(0,0,0,0.3)" }}>सीख</div>
      <div style={{ marginTop: 6, maxWidth: 1500, textAlign: "center" }}>
        {words.map((w, i) => {
          const k = spring({ frame: f - Math.round((81.9 + i * 0.32) * fps), fps, config: { damping: 9, stiffness: 140 } });
          return <span key={i} style={{ display: "inline-block", margin: "0 12px", transform: `translateY(${(1 - k) * 60}px) scale(${0.4 + 0.6 * k})`, opacity: clamp01(k * 1.5), fontFamily: HFONT, fontWeight: 800, fontSize: 84, color: i === 1 || i === 3 ? "#ffe066" : "#ffffff", textShadow: outline(7) + ", 0 8px 22px rgba(0,0,0,0.35)" }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  const t = f / fps;
  if (t < 85.4) return null;
  const k = spring({ frame: f - Math.round(85.4 * fps), fps, config: { damping: 14 } });
  const b = spring({ frame: f - Math.round(86.0 * fps), fps, config: { damping: 8, stiffness: 160 } });
  const ring = Math.sin((t - 86) * 9) * 14 * clamp01(1 - (t - 86.2) / 1.2) * (t > 86.2 ? 1 : 0);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 110 }}>
      <div style={{ transform: `scale(${k})`, fontFamily: HFONT, fontWeight: 800, fontSize: 92, color: "#ffe066", textShadow: outline(7) + ", 0 10px 24px rgba(0,0,0,0.35)" }}>देखने के लिए धन्यवाद!</div>
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 26, transform: `scale(${b})` }}>
        <div style={{ background: "linear-gradient(#ff3b3b, #d91414)", color: "white", fontFamily: HFONT, fontWeight: 800, fontSize: 50, padding: "8px 46px 4px", borderRadius: 60, border: "5px solid #fff", boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>सब्सक्राइब करें</div>
        <svg width="84" height="84" viewBox="0 0 64 64" style={{ transform: `rotate(${ring}deg)`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}>
          <path d="M32 6c-2 0-4 2-4 4v2C19 14 14 22 14 31v12l-5 6v3h46v-3l-5-6V31c0-9-5-17-14-19v-2c0-2-2-4-4-4z" fill="#ffd23a" stroke="#1d1030" strokeWidth="3" />
          <circle cx="32" cy="57" r="5" fill="#ffd23a" stroke="#1d1030" strokeWidth="3" />
        </svg>
      </div>
      <div style={{ marginTop: 18, transform: `scale(${b})`, fontFamily: HFONT, fontWeight: 700, fontSize: 44, color: "#ffffff", textShadow: outline(4) }}>👍 लाइक करें • शेयर करें • अगली कहानी के लिए जुड़े रहें!</div>
    </AbsoluteFill>
  );
};

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("800 80px 'Baloo 2'", "जादुई"), document.fonts.load("700 80px 'Baloo 2'", "जादुई"),
      document.fonts.load("700 50px 'Noto Sans Devanagari'", "चिंटू"),
    ]).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const on = toggles();
  useFonts();
  const dpr = (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
  // fades / flashes
  const black = interpolate(t, [0, 0.6], [1, 0], { extrapolateRight: "clamp" });
  const gold = t > T_BURST - 0.1 && t < T_BURST + 1.2 ? interpolate(t, [T_BURST - 0.1, T_BURST + 0.08, T_BURST + 1.2], [0, 0.75, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  // soft dip on place changes
  const cutDip = [35.5, 38.4, 55.6, 68.0].reduce((m, c) => Math.max(m, 1 - Math.min(1, Math.abs(t - c) / 0.18)), 0) * 0.0;
  return (
    <AbsoluteFill style={{ background: "#cfe6ff" }}>
      <ThreeCanvas width={W} height={H} {...(dpr ? { dpr } : {})} shadows={on.shadows} gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 45, near: 0.1, far: 1500 }}>
        <Inner />
      </ThreeCanvas>
      {gold > 0 && <AbsoluteFill style={{ background: "radial-gradient(circle at 45% 60%, #fff6c8 0%, #ffd56a 45%, rgba(255,200,90,0.0) 100%)", opacity: gold, mixBlendMode: "screen" }} />}
      {cutDip > 0 && <AbsoluteFill style={{ background: "#fff", opacity: cutDip }} />}
      {on.overlay && <Title t={t} />}
      {on.overlay && <Subtitle t={t} />}
      {on.overlay && <Moral f={f} />}
      {on.overlay && <EndCard f={f} />}
      {black > 0 && <AbsoluteFill style={{ background: "#000", opacity: black }} />}
    </AbsoluteFill>
  );
};
