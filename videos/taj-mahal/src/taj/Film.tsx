// "ताज महल के टेढ़े मीनार": 1080x1920, 30 fps. One three.js world posed per frame (world.ts) + post:
// ink -> bloom -> NEUTRAL tone map -> grade. No captions. Overlays: the white flash after the hook, fades.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, interpolate, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./world";
import { InkPass } from "./ink";
import { MoodGrade } from "./grade";
import { FPS, L, DURATION, SHOTS } from "./story";
import { VIDEO_DURATION, storyTime } from "./timemap";

export const FILM_FRAMES = Math.ceil(VIDEO_DURATION * FPS);
const W = 1080, H = 1920;
type Toggles = { ink: boolean; bloom: boolean; grade: boolean; msaa: number; shadows: boolean };
const toggles = (): Toggles => ({ ink: false, bloom: true, grade: true, msaa: 4, shadows: true, ...((getInputProps() as { post?: Partial<Toggles> }).post ?? {}) });

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const t = storyTime(f / FPS);
  const { camera, scene, size } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(toggles, []);
  useEffect(() => { scene.fog = world.fog; }, [scene, world]);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera, { widthNear: 5.1, widthFar: 3.0, distNear: 6, distFar: 120, fadeNear: 260, fadeFar: 700 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new MoodGrade(),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const lk = world.update(t, camera as THREE.PerspectiveCamera, { w: size.width, h: size.height });
  const g = lk.grade;
  fx.grade.set(g[0] * 1.03, 1.0, g[2] * 0.9, [g[3][0] * 0.5, g[3][1] * 0.5, g[3][2] * 0.5], [g[4][0] * 0.6, g[4][1] * 0.6, g[4][2] * 0.6], 0.1);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={on.msaa}>
        {on.ink ? <primitive object={fx.ink} dispose={null} /> : <></>}
        {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : <></>}
        <primitive object={fx.tone} dispose={null} />
        {on.grade ? <primitive object={fx.grade} dispose={null} /> : <></>}
      </EffectComposer>
    </>
  );
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const t = storyTime(f / FPS);
  const on = toggles();
  const dpr = (getInputProps() as { dpr?: number }).dpr;
  const black = Math.max(interpolate(t, [0, 0.5], [1, 0], { extrapolateRight: "clamp" }), interpolate(t, [DURATION - 1.0, DURATION - 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const flash = interpolate(t, [L[1] - 0.04, L[1] + 0.02, L[1] + 0.3], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // soft dip at place changes (cuts between sets)
  const dipAt = [L[3], L[4], L[6], 62.75, L[13], L[14], L[15], 80.2, 84.3];
  const dip = dipAt.reduce((m, c) => Math.max(m, 1 - Math.min(1, Math.abs(t - c) / 0.12)), 0) * 0.35;
  void SHOTS;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={W} height={H} {...(dpr ? { dpr } : {})} shadows={on.shadows ? "soft" : false} gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 45, near: 0.1, far: 2000 }}>
        <Inner />
      </ThreeCanvas>
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
      {dip > 0 && <AbsoluteFill style={{ background: "#000", opacity: dip }} />}
      {black > 0 && <AbsoluteFill style={{ background: "#000", opacity: black }} />}
    </AbsoluteFill>
  );
};
