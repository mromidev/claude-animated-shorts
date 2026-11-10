// Real-time web player for the Taj Mahal short: the same three.js world as the Remotion film (world.ts), driven by
// the narration's clock so picture and voice stay in sync. Built into one HTML page by tools/build_web.mjs.
import * as THREE from "three";
import { World } from "../taj/world";
import { NOINK } from "../taj/ink";
import { L, DURATION } from "../taj/story";
import { VIDEO_DURATION, storyTime } from "../taj/timemap";

declare const AUDIO_URL: string;
const $ = (id: string) => document.getElementById(id)!;
const canvas = $("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 2000);
camera.layers.enable(NOINK);
const world = new World();
scene.add(world.root); scene.fog = world.fog;

const audio = new Audio(AUDIO_URL); audio.preload = "auto";
let playing = false, clock = 0, last = performance.now(), fullHD = true;

const frame = $("frame"), flash = $("flash"), fade = $("fade");
function resize() {
  const w = frame.clientWidth, h = frame.clientHeight;
  // Full HD: draw a 1080 x 1920 buffer whatever the on-screen size; otherwise the screen's own pixels
  const pr = fullHD ? Math.max(1080 / w, 1920 / h) : Math.min(2, devicePixelRatio || 1);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
}
addEventListener("resize", resize);

function setPlaying(p: boolean) {
  playing = p;
  $("play").textContent = p ? "⏸ रोकें" : "▶ चलाएँ";
  if (p) { audio.currentTime = clock; audio.play().catch(() => {}); } else audio.pause();
  $("start").hidden = true;
}
$("start").onclick = () => setPlaying(true);
$("play").onclick = () => setPlaying(!playing);
$("again").onclick = () => { clock = 0; setPlaying(true); };
$("hd").onclick = () => { fullHD = !fullHD; $("hd").setAttribute("aria-pressed", String(fullHD)); resize(); };
$("rec").onclick = (e) => { e.stopPropagation(); document.body.classList.add("rec"); clock = 0; setPlaying(true); };
$("stage").addEventListener("click", () => document.body.classList.remove("rec"));
$("bar").onclick = (e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); clock = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * VIDEO_DURATION; if (playing) audio.currentTime = clock; };
audio.addEventListener("ended", () => { playing = false; $("play").textContent = "▶ चलाएँ"; });

const bar = $("bari");
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) {
    // follow the audio clock when it is running; it is the reference for lip-sync and beats
    if (!audio.paused && !Number.isNaN(audio.currentTime) && audio.currentTime > 0) clock = audio.currentTime; else clock += dt;
    if (clock >= VIDEO_DURATION) { clock = VIDEO_DURATION; playing = false; $("play").textContent = "▶ चलाएँ"; }
  }
  const t = storyTime(clock);
  const size = { w: frame.clientWidth, h: frame.clientHeight };
  const lk = world.update(t, camera, size);
  renderer.toneMappingExposure = lk.grade[0] * 1.03;
  // the white flash after the hook, soft dips at place changes, fade in/out
  const fl = Math.max(0, 1 - Math.abs(t - (L[1] + 0.02)) / 0.28) * 0.9;
  const dips = [L[3], L[4], L[6], 62.75, L[13], L[14], L[15], 80.2, 84.3].reduce((m, c) => Math.max(m, 1 - Math.min(1, Math.abs(t - c) / 0.12)), 0) * 0.35;
  const blk = Math.max(1 - Math.min(1, t / 0.5), Math.min(1, Math.max(0, (t - (DURATION - 1.0)) / 0.9)), dips);
  flash.style.opacity = String(fl); fade.style.opacity = String(blk);
  bar.style.width = (clock / VIDEO_DURATION * 100).toFixed(2) + "%";
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
resize();
requestAnimationFrame(loop);
(window as unknown as { __setT: (x: number) => void }).__setT = (x: number) => { clock = x; playing = false; $("start").hidden = true; };
