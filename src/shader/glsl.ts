export const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

const BODY = `
vec2 wrap2(vec2 p, float f) {
  return mod(mod(p, vec2(f)) + vec2(f), vec2(f));
}

float H(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33 + uSeed);
  return fract((p3.x + p3.y) * p3.z);
}

float SC() {
  return max(1.0, floor(uScale + 0.5));
}

float RES() {
  return uPixels > 1.5 ? uPixels : 96.0;
}

float N(vec2 uv, float freq) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = H(wrap2(i, freq));
  float b = H(wrap2(i + vec2(1.0, 0.0), freq));
  float c = H(wrap2(i + vec2(0.0, 1.0), freq));
  float d = H(wrap2(i + vec2(1.0, 1.0), freq));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float FBM(vec2 uv, float freq) {
  float v = 0.0;
  float a = 0.5;
  float f = freq;
  for (int i = 0; i < 4; i++) {
    v += a * N(uv, f);
    f *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 worley(vec2 uv, float freq) {
  vec2 p = uv * freq;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = wrap2(i + g, freq);
      vec2 o = vec2(H(cell + 0.37), H(cell + 8.91));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

vec3 pick4(float t) {
  t = clamp(t, 0.0, 0.999);
  float q = floor(t * 4.0);
  if (q < 1.0) return uC0;
  if (q < 2.0) return uC1;
  if (q < 3.0) return uC2;
  return uC3;
}

vec3 mix4(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.3333) return mix(uC0, uC1, t * 3.0);
  if (t < 0.6666) return mix(uC1, uC2, (t - 0.3333) * 3.0);
  return mix(uC2, uC3, (t - 0.6666) * 3.0);
}

vec2 brickUv(vec2 uv, float cols, float rows) {
  float row = floor(uv.y * rows);
  float x = fract(uv.x * cols + mod(row, 2.0) * 0.5);
  float y = fract(uv.y * rows);
  return vec2(x, y);
}

float face(vec2 b, float mx, float my, float freqHint) {
  float ax = freqHint / max(RES(), 1.0);
  ax = max(ax, 0.001);
  return smoothstep(0.0, ax, b.x - mx)
    * smoothstep(0.0, ax, (1.0 - mx) - b.x)
    * smoothstep(0.0, ax, b.y - my)
    * smoothstep(0.0, ax, (1.0 - my) - b.y);
}

float gid(vec2 uv, float f) {
  return wrap2(floor(uv * f), f).x;
}

vec3 finish(vec3 c, vec2 uv) {
  if (uLook < 0.5) {
    float luma = dot(c, vec3(0.25, 0.55, 0.2));
    c = pick4(clamp(luma * 1.05, 0.0, 0.999));
  } else if (uLook < 1.5) {
    float luma = dot(c, vec3(0.3, 0.5, 0.2));
    float bristle = N(vec2(uv.y * 14.0 * SC(), uv.x * 2.0 * SC()), 6.0);
    float dab = N(uv, 5.0 * SC());
    c = mix4(clamp(luma * 0.72 + dab * 0.25 + (bristle - 0.5) * 0.1, 0.0, 1.0));
    c *= vec3(1.05, 0.97, 0.88);
  } else if (uLook < 2.5) {
    float micro = FBM(uv, 40.0);
    float pore = N(uv, 28.0 * SC());
    float shade = FBM(uv, 6.0 * SC());
    c *= 0.76 + 0.4 * shade;
    c += (micro - 0.5) * 0.12 + (pore - 0.5) * 0.07;
    c += pow(clamp(pore, 0.0, 1.0), 8.0) * 0.16;
  } else {
    float luma = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix4(clamp(floor(luma * 3.0) / 2.0, 0.0, 1.0));
  }
  float grain = N(uv, 16.0 * SC()) - 0.5;
  float wearAmt = uLook < 0.5 ? 0.06 : 0.22;
  c += grain * uWear * wearAmt;
  return clamp(c, 0.0, 1.0);
}
`;

const MAIN = `
void main() {
  vec2 uv = fract(vUv * max(uRepeat, 1.0));
  float grid = uPixels;
  if (uLook < 0.5 && grid < 1.5) grid = 32.0;
  if (grid > 1.5) {
    uv = (floor(uv * grid) + 0.5) / grid;
  }
  gl_FragColor = vec4(finish(groutStyle(uv), uv), 1.0);
}
`;

const LIVE_UNIFORMS = `
varying vec2 vUv;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uTime;
uniform float uSeed;
uniform float uScale;
uniform float uPixels;
uniform float uWear;
uniform float uRepeat;
uniform float uLook;
`;

export function liveFragment(styleGlsl: string): string {
  return `${PRECISION}${LIVE_UNIFORMS}${BODY}${styleGlsl}\n${MAIN}`;
}

export type BakedTile = {
  name: string;
  id: string;
  motion: boolean;
  seed: number;
  scale: number;
  pixels: number;
  wear: number;
  look: number;
  colors: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
};

function f3(c: [number, number, number]): string {
  return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;
}

function f1(n: number): string {
  return `${n.toFixed(2)}`;
}

export function exportFragment(styleGlsl: string, tile: BakedTile): string {
  const time = tile.motion
    ? "uniform float uTime;"
    : "const float uTime = 0.0;";
  const header = `// Grout Shader reusable tile
// ${tile.name} (${tile.id})
// Sample with UV 0..1. The result is periodic — repeat it.
// Vertex: attribute vec2 aPos; varying vec2 vUv; gl_Position = vec4(aPos,0,0,1); vUv = aPos*0.5+0.5;
`;
  const uniforms = `
varying vec2 vUv;
const vec3 uC0 = ${f3(tile.colors[0])};
const vec3 uC1 = ${f3(tile.colors[1])};
const vec3 uC2 = ${f3(tile.colors[2])};
const vec3 uC3 = ${f3(tile.colors[3])};
${time}
const float uSeed = ${f1(tile.seed)};
const float uScale = ${f1(tile.scale)};
const float uPixels = ${f1(tile.pixels)};
const float uWear = ${f1(tile.wear)};
const float uLook = ${f1(tile.look)};
const float uRepeat = 1.0;
`;
  return `${header}${PRECISION}${uniforms}${BODY}${styleGlsl}\n${MAIN}`;
}
