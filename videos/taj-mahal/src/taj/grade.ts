// Small display-referred grade after tone mapping: exposure, contrast, saturation, warm/cool split tone, vignette.
import { Effect, BlendFunction } from "postprocessing";
import { Uniform, Vector3 } from "three";

const frag = /* glsl */ `
uniform float uExp; uniform float uCon; uniform float uSat; uniform vec3 uShadow; uniform vec3 uHigh; uniform float uVig;
vec3 toS(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
vec3 toL(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = toS(inputColor.rgb * uExp);
  c = (c - 0.5) * uCon + 0.5;
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, uSat);
  c += uShadow * (1.0 - smoothstep(0.0, 0.5, y)) + uHigh * smoothstep(0.5, 1.0, y);
  vec2 d = (uv - 0.5) * vec2(1.0, 0.75);
  c *= 1.0 - uVig * smoothstep(0.25, 0.75, length(d) * 1.35);
  outputColor = vec4(toL(clamp(c, 0.0, 1.0)), inputColor.a);
}`;

export class MoodGrade extends Effect {
  constructor() {
    super("MoodGrade", frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uExp", new Uniform(1)], ["uCon", new Uniform(1.06)], ["uSat", new Uniform(1.12)],
        ["uShadow", new Uniform(new Vector3(0.0, 0.01, 0.03))], ["uHigh", new Uniform(new Vector3(0.02, 0.01, -0.01))], ["uVig", new Uniform(0.22)],
      ]),
    });
  }
  set(exp: number, con: number, sat: number, shadow: [number, number, number], high: [number, number, number], vig: number) {
    this.uniforms.get("uExp")!.value = exp; this.uniforms.get("uCon")!.value = con; this.uniforms.get("uSat")!.value = sat;
    (this.uniforms.get("uShadow")!.value as Vector3).set(...shadow); (this.uniforms.get("uHigh")!.value as Vector3).set(...high);
    this.uniforms.get("uVig")!.value = vig;
  }
}
