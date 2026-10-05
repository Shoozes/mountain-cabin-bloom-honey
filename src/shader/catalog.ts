export const CATEGORIES = [
  "Reviewed",
  "Bond",
  "Ground",
  "Built",
  "Fiber",
  "Metal",
  "Nature",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LOOKS = [
  { id: "pixel", label: "Pixel art", value: 0 },
  { id: "painted", label: "Painted", value: 1 },
  { id: "real", label: "Hyper real", value: 2 },
  { id: "poster", label: "Poster", value: 3 },
] as const;

export type LookId = (typeof LOOKS)[number]["id"];

export const SIZES = [
  { value: 16, label: "16×16" },
  { value: 32, label: "32×32" },
  { value: 64, label: "64×64" },
  { value: 128, label: "128×128" },
  { value: 0, label: "Smooth" },
] as const;

export function lookValue(id: string): number {
  return LOOKS.find((look) => look.id === id)?.value ?? 0;
}

export type StyleDef = {
  id: string;
  name: string;
  category: Category;
  /** Matches grout-render createRetroPreset when set. */
  preset?: string;
  blurb: string;
  motion?: boolean;
  palette: [string, string, string, string];
  glsl: string;
};

export type PaletteChoice = {
  id: string;
  name: string;
  colors?: [string, string, string, string];
};

export const PALETTES: PaletteChoice[] = [
  { id: "style", name: "Style" },
  { id: "mortar", name: "Mortar", colors: ["#2a2724", "#6d675f", "#b7b0a4", "#ece4d6"] },
  { id: "kiln", name: "Kiln", colors: ["#3a221c", "#8a3e2d", "#d4652f", "#f0d2b4"] },
  { id: "moss", name: "Moss", colors: ["#1c2618", "#3d5233", "#7d9a62", "#d5ddc4"] },
  { id: "sea", name: "Sea", colors: ["#102028", "#1d4e66", "#3e8ea8", "#d5eef2"] },
  { id: "ember", name: "Ember", colors: ["#2a120c", "#8a2e16", "#e26a2c", "#f6d36a"] },
  { id: "ink", name: "Ink", colors: ["#14120f", "#3a342c", "#a39886", "#efe6d6"] },
  { id: "copper", name: "Copper", colors: ["#2c1a12", "#6e3b28", "#b8734a", "#e6c2a2"] },
  { id: "bone", name: "Bone", colors: ["#4a3d32", "#8a7564", "#d9cbb8", "#f4efe6"] },
  { id: "pico8", name: "PICO-8", colors: ["#1d2b53", "#5f574f", "#c2c3c7", "#fff1e8"] },
  { id: "gameboy", name: "Game Boy", colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { id: "nes", name: "NES", colors: ["#000000", "#7c7c7c", "#f8f8f8", "#a81000"] },
];

const g = (
  partial: Omit<StyleDef, "glsl"> & { glsl: string },
): StyleDef => partial;

function toonWood(o: {
  cols: number;
  gap: number;
  grainFx: number;
  grainFy: number;
  grainAmt: number;
  knot: number;
  crack: number;
  bevel: number;
  steps: number;
}): string {
  return `float hash1(vec2 p) {
      p += uSeed;
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),
                 mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.0;
        a *= 0.5;
      }
      return v;
    }
    float pnoise(vec2 p, float period) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      vec2 pp = vec2(period);
      float a = hash1(mod(i, pp));
      float b = hash1(mod(i + vec2(1.0, 0.0), pp));
      float c = hash1(mod(i + vec2(0.0, 1.0), pp));
      float d = hash1(mod(i + vec2(1.0, 1.0), pp));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float sdBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }
    float rowCount(float col, float cols) {
      return 3.0 + floor(hash1(vec2(mod(col, cols), 5.2)) * 3.0);
    }
    float boardSDF(vec2 uv, vec2 id, float rows, float cols, out vec2 luv) {
      vec2 cell = vec2(1.0 / cols, 1.0 / rows);
      vec2 center = (id + 0.5) * cell;
      vec2 p = uv - center;
      luv = p / cell + 0.5;
      vec2 b = max(cell * 0.5 - vec2(${o.gap.toFixed(4)}), vec2(0.001));
      return sdBox(p, b, 0.0012);
    }
    vec3 boardColor(vec2 id, vec2 luv, out float surfH) {
      float pick = hash1(id + 4.0);
      vec3 base = mix(uC0, uC1, pick);
      base = mix(base, uC2, hash1(id + 8.0) * 0.55);
      float grain = fbm(vec2(luv.x * ${o.grainFx.toFixed(2)}, luv.y * ${o.grainFy.toFixed(2)}) + id * 3.1);
      base = mix(base, mix(uC0, uC2, grain), ${o.grainAmt.toFixed(3)});
      float knot = 0.0;
      if (hash1(id + 1.7) > ${o.knot.toFixed(3)}) {
        vec2 k = vec2(hash1(id + 2.2), hash1(id + 3.4));
        vec2 kp = (luv - vec2(0.32 + 0.36 * k.x, 0.38 + 0.24 * k.y)) * vec2(1.15, 1.7);
        float kd = length(kp);
        knot = 1.0 - smoothstep(0.05, 0.2, kd);
        float ring = abs(fract(kd * 7.0) - 0.5);
        base = mix(base, uC0, knot * 0.85);
        base = mix(base, uC1, knot * (1.0 - smoothstep(0.04, 0.18, ring)) * 0.7);
      }
      float crack = smoothstep(0.62, 0.84, fbm(vec2(luv.y * 7.0, luv.x * 1.4) + id));
      base = mix(base, uC3, clamp(crack * ${o.crack.toFixed(2)} * 0.34, 0.0, 1.0));
      surfH = (grain - 0.5) * 0.10 - knot * 0.25 - crack * 0.4;
      return base;
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      float cols = ${o.cols.toFixed(1)} * sc;
      vec3 col = uC3 * (0.85 + 0.3 * pnoise(uv * 24.0, 24.0));
      float h = 0.0;
      float c = floor(uv.x * cols);
      float rows = rowCount(c, cols);
      float baseRow = floor(uv.y * rows);
      for (int dy = -1; dy <= 1; dy++) {
        float row = baseRow + float(dy);
        float sy = uv.y;
        if (row < 0.0) { row += rows; sy += 1.0; }
        else if (row >= rows) { row -= rows; sy -= 1.0; }
        vec2 id = vec2(mod(c, cols), row);
        vec2 luv;
        float d = boardSDF(vec2(uv.x, sy), id, rows, cols, luv);
        float face = smoothstep(0.0018, -0.0018, d);
        if (face > 0.001) {
          float surfH;
          vec3 bc = boardColor(id, luv, surfH);
          float bevel = smoothstep(0.0, ${o.bevel.toFixed(4)}, -d);
          bc *= mix(0.22, 1.0, bevel);
          col = mix(col, bc, face);
          h = mix(h, 0.5 + bevel * 0.5 + surfH, face);
        }
      }
      float diff = clamp(h, 0.0, 1.0);
      diff = floor(diff * ${o.steps.toFixed(1)} + 0.5) / ${o.steps.toFixed(1)};
      col *= mix(0.82, 1.16, diff);
      col *= 0.96 + 0.04 * cos(uv.x * 6.28318) * cos(uv.y * 6.28318);
      return clamp(col, 0.0, 1.0);
    }`;
}

export const STYLES: StyleDef[] = [
  g({
    id: "brick",
    name: "Running Bond",
    category: "Reviewed",
    preset: "brick",
    blurb: "Cookbook brick. Offset courses and a pale mortar joint.",
    palette: ["#4a241c", "#8d3b2c", "#c46a52", "#cfc3b2"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      float rows = 4.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float m = face(b, 0.07, 0.11, cols);
      float n = N(uv, 8.0 * sc);
      float speckle = N(uv, 16.0 * sc);
      vec3 body = pick4(0.08 + 0.72 * n + 0.12 * speckle);
      return mix(uC3, body, m);
    }`,
  }),
  g({
    id: "stone",
    name: "Rubble",
    category: "Reviewed",
    preset: "stone",
    blurb: "Cookbook stone. Noisy faces broken by dark joints.",
    palette: ["#6a6862", "#7e7c76", "#908e88", "#b4b0a6"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 9.0 * sc;
      vec2 w = worley(uv, f);
      float edge = 1.0 - smoothstep(0.015, 0.07, w.y - w.x);
      float n = FBM(uv, f);
      vec3 body = mix(uC1, uC2, n);
      body = mix(body, uC3, N(uv, 16.0 * sc) * 0.28);
      return mix(body, uC0, edge * 0.92);
    }`,
  }),
  g({
    id: "metal",
    name: "Rivet Panel",
    category: "Reviewed",
    preset: "metal",
    blurb: "Cookbook metal. Vertical seams and paired rivets.",
    palette: ["#2c3842", "#5d6e7c", "#8ea0ae", "#d5e2ea"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      vec2 g = fract(vec2(uv.x * cols, uv.y * cols));
      float ax = cols / max(RES(), 1.0);
      float seam = 1.0 - smoothstep(0.0, max(ax, 0.001), g.x - 0.025) * smoothstep(0.0, max(ax, 0.001), 0.975 - g.x);
      float n = N(uv, 8.0 * sc);
      vec3 body = mix(uC1, uC2, n);
      float d = min(length(g - vec2(0.22, 0.22)), length(g - vec2(0.78, 0.78)));
      float rivet = 1.0 - smoothstep(0.04, 0.075, d);
      float hi = 1.0 - smoothstep(0.0, 0.028, d);
      vec3 c = mix(body, uC0, seam);
      c = mix(c, uC2, rivet);
      return mix(c, uC3, hi * rivet);
    }`,
  }),
  g({
    id: "wood",
    name: "Plank Grain",
    category: "Reviewed",
    preset: "wood",
    blurb: "Cookbook wood. Horizontal grain, plank gaps, and knots.",
    palette: ["#3a2418", "#6b4228", "#a56b3e", "#e2c29a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 4.0 * sc;
      float fy = fract(uv.y * rows);
      float gap = smoothstep(0.0, max(rows / RES(), 0.001) * 2.0, fy);
      float wob = N(uv, 2.0 * sc);
      float lines = abs(fract(uv.y * (16.0 * sc) + wob * 2.0) - 0.5);
      float dark = 1.0 - smoothstep(0.04, 0.2, lines);
      vec2 cell = wrap2(floor(uv * vec2(2.0 * sc)), 2.0 * sc);
      vec2 pf = fract(uv * vec2(2.0 * sc));
      vec2 ko = vec2(H(cell), H(cell + 5.0));
      float knot = 1.0 - smoothstep(0.05, 0.16, length(pf - (0.28 + 0.44 * ko)));
      vec3 c = mix(uC1, uC2, N(uv, 4.0 * sc));
      c = mix(c, uC0, dark * 0.7);
      c = mix(c, uC0, knot);
      c = mix(c, uC3, (1.0 - knot) * N(uv, 10.0 * sc) * 0.18);
      return mix(uC0, c, gap);
    }`,
  }),
  g({
    id: "sawn-oak",
    name: "Sawn Oak",
    category: "Fiber",
    blurb: "Shadertoy mdy3R1 board. Distorted fbm, musgrave grain, and the three wood colors.",
    palette: ["#080300", "#401c0a", "#855230", "#e7c39a"],
    glsl: `float sum2(vec2 v) { return dot(v, vec2(1.0)); }
    float h31(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 333.3456);
      return fract(sum2(p3.xy) * p3.z);
    }
    float h21(vec2 p) { return h31(p.xyx); }
    float n31(vec3 p) {
      vec3 s = vec3(7.0, 157.0, 113.0);
      vec3 ip = floor(p);
      p = fract(p);
      p = p * p * (3.0 - 2.0 * p);
      vec4 h = vec4(0.0, s.yz, sum2(s.yz)) + dot(ip, s);
      h = mix(fract(sin(h) * 43758.545), fract(sin(h + s.x) * 43758.545), p.x);
      h.xy = mix(h.xz, h.yw, p.y);
      return mix(h.x, h.y, p.z);
    }
    float fbm8(vec3 p) {
      float sum = 0.0;
      float amp = 1.0;
      float tot = 0.0;
      for (int i = 0; i < 8; i++) {
        sum += amp * n31(p);
        tot += amp;
        amp *= 0.5;
        p *= 2.0;
      }
      return sum / tot;
    }
    float fbm3(vec3 p) {
      float sum = 0.0;
      float amp = 1.0;
      float tot = 0.0;
      for (int i = 0; i < 3; i++) {
        sum += amp * n31(p);
        tot += amp;
        p *= 2.0;
      }
      return sum / tot;
    }
    float musgrave8(vec3 p, float dimension, float lacunarity) {
      float sum = 0.0;
      float amp = 1.0;
      float m = pow(lacunarity, -dimension);
      for (int i = 0; i < 8; i++) {
        sum += (n31(p) * 2.0 - 1.0) * amp;
        amp *= m;
        p *= lacunarity;
      }
      return sum;
    }
    float musgrave2(vec3 p, float dimension, float lacunarity) {
      float sum = 0.0;
      float amp = 1.0;
      float m = pow(lacunarity, -dimension);
      for (int i = 0; i < 2; i++) {
        sum += (n31(p) * 2.0 - 1.0) * amp;
        amp *= m;
        p *= lacunarity;
      }
      return sum;
    }
    vec3 randomPos(float seed) {
      vec4 s = vec4(seed, 0.0, 1.0, 2.0);
      return vec3(h21(s.xy), h21(s.xz), h21(s.xw)) * 100.0 + 100.0;
    }
    float fbmDistorted(vec3 p) {
      p += (vec3(n31(p + randomPos(0.0)), n31(p + randomPos(1.0)), n31(p + randomPos(2.0))) * 2.0 - 1.0) * 1.12;
      return fbm8(p);
    }
    vec3 waveFbmX(vec3 p) {
      float n = p.x * 20.0;
      n += 0.4 * fbm3(p * 3.0);
      return vec3(sin(n) * 0.5 + 0.5, p.yz);
    }
    vec3 matWood(vec3 p) {
      float n1 = fbmDistorted(p * vec3(7.8, 1.17, 1.17));
      n1 = mix(n1, 1.0, 0.2);
      float n2 = mix(musgrave8(vec3(n1 * 4.6), 0.0, 2.5), n1, 0.85);
      float dirt = 1.0 - musgrave8(waveFbmX(p * vec3(0.01, 0.15, 0.15)), 0.26, 2.4) * 0.4;
      float grain = 1.0 - smoothstep(0.2, 1.0, musgrave2(p * vec3(500.0, 6.0, 1.0), 2.0, 2.5)) * 0.2;
      n2 *= dirt * grain;
      float a = clamp((n2 - 0.19) / 0.37, 0.0, 1.0);
      float b = clamp((n2 - 0.56) / 0.44, 0.0, 1.0);
      return pow(max(mix(mix(uC0, uC1, a), uC2, b), 0.0), vec3(0.4545));
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      vec3 p = vec3((uv - 0.5) * vec2(1.78, 1.0) * sc, mod(uSeed, 8.0));
      return matWood(p);
    }`,
  }),
  g({
    id: "toon-plank",
    name: "Toon Plank",
    category: "Fiber",
    blurb: "Cartoon boards. Grain, knots, cracks, bevel, and 5-step cel light.",
    palette: ["#48220b", "#9b480d", "#d97925", "#090401"],
    glsl: toonWood({
      cols: 8,
      gap: 0.0043,
      grainFx: 6,
      grainFy: 4.4,
      grainAmt: 0.23,
      knot: 0.455,
      crack: 2.55,
      bevel: 0.014,
      steps: 5,
    }),
  }),
  g({
    id: "knot-comic",
    name: "Knot Comic",
    category: "Fiber",
    blurb: "Same plank functions, mismatched: wide boards, a knot on almost every one, cracks off.",
    palette: ["#5c2e10", "#c46a22", "#f0b15a", "#1a0c06"],
    glsl: toonWood({
      cols: 4,
      gap: 0.006,
      grainFx: 3.5,
      grainFy: 2.2,
      grainAmt: 0.4,
      knot: 0.08,
      crack: 0,
      bevel: 0.02,
      steps: 3,
    }),
  }),
  g({
    id: "crack-comic",
    name: "Crack Comic",
    category: "Fiber",
    blurb: "Same plank functions, mismatched: thin boards, heavy cracks, knots almost never.",
    palette: ["#2a140c", "#6a3818", "#c48448", "#0c0704"],
    glsl: toonWood({
      cols: 12,
      gap: 0.003,
      grainFx: 9,
      grainFy: 7,
      grainAmt: 0.08,
      knot: 0.92,
      crack: 4.2,
      bevel: 0.008,
      steps: 4,
    }),
  }),
  g({
    id: "dark-panels",
    name: "Dark Panels",
    category: "Fiber",
    blurb: "Dark stained panels. Warped fbm in a 16×3 stagger with thin seams.",
    palette: ["#0c0806", "#3a2416", "#5e3b22", "#100c0a"],
    glsl: `float nrand(vec2 co) {
      co += uSeed;
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(nrand(i + vec2(0.0, 0.0)), nrand(i + vec2(1.0, 0.0)), u.x),
                 mix(nrand(i + vec2(0.0, 1.0)), nrand(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 x, float H) {
      float G = exp2(-H);
      float f = 1.0;
      float a = 1.0;
      float t = 0.0;
      for (int i = 0; i < 8; i++) {
        t += a * noise(f * x);
        f *= 2.0;
        a *= G;
      }
      return t;
    }
    float fn(float x) { return nrand(vec2(x, 3.7)); }
    float edgeMask(vec2 uv, vec2 size) {
      float blur = 1.0 / max(RES(), 1.0);
      vec2 fuv = fract(uv);
      float d = min(min(fuv.x, 1.0 - fuv.x) / size.x, min(fuv.y, 1.0 - fuv.y) / size.y);
      return 1.0 - smoothstep(blur, blur + 0.002, d);
    }
    vec3 woodTexture(vec2 uv) {
      vec2 iuv = floor(uv);
      vec2 fuv = fract(uv);
      vec2 uv2 = fuv + 10.0 * noise(iuv);
      uv2 += 20.0 * fbm(uv2, 1.0);
      float n = clamp(fbm(uv2, 1.0), 0.0, 1.0);
      return mix(uC0, mix(uC1, uC2, n), n);
    }
    vec3 groutStyle(vec2 uv) {
      float sc = max(SC(), 1.0);
      vec2 size = vec2(16.0, 3.0) * sc;
      vec2 p = uv * size;
      p.y += 0.5 * fn(floor(p.x));
      vec3 color = uC3;
      color = mix(color, uC0, edgeMask(p, size));
      color = mix(color, woodTexture(p), 0.62);
      return pow(max(color, 0.0), vec3(0.8));
    }`,
  }),
  g({
    id: "grass",
    name: "Turf",
    category: "Reviewed",
    preset: "grass",
    blurb: "Short even turf. Fine blades held in a tight olive range.",
    palette: ["#4a611c", "#536923", "#5c7226", "#6a8030"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 42.0 * sc;
      float rows = 26.0 * sc;
      float x = abs(fract(uv.x * cols) - 0.5);
      float blade = 1.0 - smoothstep(0.1, 0.46, x);
      float y = fract(uv.y * rows);
      float tip = smoothstep(0.08, 0.4, y);
      vec3 c = mix(uC0, uC1, N(uv, 4.0 * sc));
      c = mix(c, uC2, blade * 0.5);
      return mix(c, uC3, blade * tip * N(uv, 9.0 * sc) * 0.22);
    }`,
  }),
  g({
    id: "checkerboard",
    name: "Checker",
    category: "Reviewed",
    preset: "checkerboard",
    blurb: "Cookbook checker. Even tiles, a little scuff.",
    palette: ["#1a1816", "#efe6d6", "#8a8074", "#d4652f"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      float c = mod(g.x + g.y, 2.0);
      float dirt = N(uv, n * 2.0);
      return mix(c < 0.5 ? uC0 : uC1, uC2, dirt * 0.12);
    }`,
  }),
  g({
    id: "water",
    name: "Shallow Water",
    category: "Reviewed",
    preset: "water",
    blurb: "Shallow turquoise water. Small caustic ripples and pale crests.",
    motion: true,
    palette: ["#4ea8a6", "#67b6b3", "#8ecfc8", "#e7f7f4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv + vec2(uTime * 0.015, uTime * 0.01);
      float a = FBM(p, 5.0 * sc);
      float b = FBM(p + vec2(0.37, 0.13), 8.0 * sc);
      float crest = smoothstep(0.58, 0.86, b);
      vec3 c = mix(uC0, uC1, 0.35 + 0.65 * a);
      c = mix(c, uC2, b * 0.7);
      return mix(c, uC3, crest * 0.28);
    }`,
  }),
  g({
    id: "lava",
    name: "Magma",
    category: "Reviewed",
    preset: "lava",
    blurb: "Cookbook lava. Hot flow cut by cooled cracks.",
    motion: true,
    palette: ["#2a0a06", "#9a220c", "#e25822", "#ffd36a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv + vec2(uTime * 0.04, uTime * 0.012);
      float n = FBM(p, 3.0 * sc);
      float hot = smoothstep(0.55, 0.92, n);
      vec2 w = worley(uv, 5.0 * sc);
      float crack = 1.0 - smoothstep(0.02, 0.07, w.y - w.x);
      vec3 c = mix4(n);
      c = mix(c, uC3, hot);
      return mix(c, uC0, crack * (1.0 - hot) * 0.85);
    }`,
  }),
  g({
    id: "sand",
    name: "Dry Sand",
    category: "Reviewed",
    preset: "sand",
    blurb: "Cookbook sand. Fine grain and a few darker pebbles.",
    palette: ["#7a6244", "#c4a56e", "#e6d2a4", "#f6ecd0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 12.0 * sc);
      float n2 = N(uv + vec2(0.17, 0.04), 20.0 * sc);
      vec3 c = pick4(0.22 + 0.55 * n);
      c = mix(c, uC3, smoothstep(0.72, 0.92, n2));
      float f = 5.0 * sc;
      vec2 w = worley(uv, f);
      float rare = step(0.78, H(wrap2(floor(uv * f), f)));
      float pebble = (1.0 - smoothstep(0.1, 0.2, w.x)) * rare;
      return mix(c, uC0, pebble);
    }`,
  }),

  g({
    id: "buttered",
    name: "Buttered Grout",
    category: "Bond",
    blurb: "Irregular tiles with a thick, pale joint. The mill's namesake.",
    palette: ["#6a5346", "#b08968", "#d8c3a5", "#efe4d4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float f = 4.0 * SC();
      vec2 w = worley(uv, f);
      float joint = 1.0 - smoothstep(0.045, 0.13, w.y - w.x);
      float n = N(uv, f * 2.0);
      vec3 tile = pick4(0.08 + 0.78 * n);
      vec3 mortar = mix(uC3, uC2, 0.35);
      return mix(tile, mortar, joint);
    }`,
  }),
  g({
    id: "herringbone",
    name: "Herringbone",
    category: "Bond",
    blurb: "Parquet planks that flip direction every cell.",
    palette: ["#3e291c", "#7a5132", "#b58355", "#e6d2b4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 4.0 * sc;
      vec2 p = uv * n;
      vec2 id = floor(p);
      vec2 f = fract(p);
      float flip = mod(id.x + id.y, 2.0);
      vec2 q = flip > 0.5 ? f.yx : f.xy;
      float m = face(q, 0.08, 0.12, n);
      float grain = N(flip > 0.5 ? uv.yx : uv, 8.0 * sc);
      vec3 c = mix(uC0, uC2, 0.3 + 0.6 * grain);
      return mix(uC3, c, m);
    }`,
  }),
  g({
    id: "basket",
    name: "Basket Weave",
    category: "Bond",
    blurb: "Over-under strips that swap axis each cell.",
    palette: ["#4a3424", "#8b6240", "#c49562", "#edd7b0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 4.0 * sc;
      vec2 id = floor(uv * n);
      vec2 f = fract(uv * n);
      float alt = mod(id.x + id.y, 2.0);
      float bands = alt < 0.5 ? step(0.5, fract(f.y * 3.0)) : step(0.5, fract(f.x * 3.0));
      vec3 c = mix(uC0, uC2, bands);
      float border = 1.0 - face(f, 0.05, 0.05, n);
      return mix(c, uC1, border * 0.85);
    }`,
  }),
  g({
    id: "subway",
    name: "Subway Tile",
    category: "Bond",
    blurb: "Long ceramic courses with a narrow grout line.",
    palette: ["#8e8a84", "#d9d4cc", "#f4f1ea", "#c45a3a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      float rows = 6.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float m = face(b, 0.045, 0.1, rows);
      float glaze = 0.45 + 0.4 * N(uv, 3.0 * sc);
      vec3 body = mix(uC1, uC2, glaze);
      body = mix(body, uC3, step(0.97, N(uv, 10.0 * sc)) * 0.35);
      return mix(uC0, body, m);
    }`,
  }),
  g({
    id: "chevron",
    name: "Chevron",
    category: "Bond",
    blurb: "Sawtooth bands that close on the tile edge.",
    palette: ["#241c18", "#6e4a34", "#c9844a", "#f0e2cc"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = fract(uv.y * (4.0 * sc));
      float x = fract(uv.x * (2.0 * sc));
      float v = abs(x - 0.5);
      float band = abs(fract(y + v) - 0.5);
      float on = 1.0 - smoothstep(0.12, 0.22, band);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, mix(uC1, uC2, n), on);
    }`,
  }),
  g({
    id: "diamond",
    name: "Diamond Tile",
    category: "Bond",
    blurb: "A diamond set in each cell, joint at the corners.",
    palette: ["#2c2824", "#6a645c", "#b7aea2", "#f2ebe1"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 5.0 * SC();
      vec2 f = fract(uv * n);
      float d = abs(f.x - 0.5) + abs(f.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float shade = N(uv, n * 2.0);
      vec3 body = mix(uC1, uC2, shade);
      return mix(uC0, body, m);
    }`,
  }),
  g({
    id: "mosaic",
    name: "Tessera",
    category: "Bond",
    blurb: "Small chips, each its own palette index, bright grout.",
    palette: ["#1e3a4c", "#c4563a", "#e0b15a", "#f4efe6"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float f = 8.0 * SC();
      // Pixel chunks sit on cell centers so opposite edges share a chip.
      // A hard mortar keeps ordered dither from flipping only one side.
      if (uLook < 0.5) {
        vec2 p = fract(uv + 0.5 / f);
        vec2 cell = wrap2(floor(p * f), f);
        vec2 w = worley((cell + 0.5) / f, f);
        float mortar = step(w.y - w.x, 0.055);
        return mix(pick4(H(cell)), uC3, mortar);
      }
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.03, 0.08, w.y - w.x);
      float n = H(wrap2(floor(uv * f), f));
      return mix(pick4(n), uC3, mortar);
    }`,
  }),
  g({
    id: "cobble",
    name: "Cobble",
    category: "Bond",
    blurb: "Rounded fieldstones with deep joints.",
    palette: ["#2a2926", "#5e5a54", "#8d877e", "#cfc6b8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float f = 5.0 * SC();
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.05, 0.14, w.y - w.x);
      float n = N(uv, 10.0 * SC());
      vec3 c = pick4(0.25 + 0.5 * n);
      return mix(c, uC0, mortar);
    }`,
  }),
  g({
    id: "hex-bond",
    name: "Hex Bond",
    category: "Bond",
    blurb: "Offset diamonds that read as a hex pavement.",
    palette: ["#3d342c", "#7d6a58", "#c2a88c", "#efe4d6"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 6.0 * sc, 4.0 * sc);
      float d = abs(b.x - 0.5) * 0.9 + abs(b.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float n = N(uv, 6.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      return mix(uC0, c, m);
    }`,
  }),
  g({
    id: "honeycomb",
    name: "Honeycomb",
    category: "Bond",
    blurb: "Tight offset cells with a dark shared wall.",
    palette: ["#3a2a12", "#a87420", "#e2b04a", "#f6e2a8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = abs(b.x - 0.5) * 0.85 + abs(b.y - 0.5);
      float wall = smoothstep(0.36, 0.46, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, 0.4 + 0.5 * n);
      return mix(c, uC0, wall);
    }`,
  }),

  g({
    id: "dirt",
    name: "Packed Dirt",
    category: "Ground",
    blurb: "Brown earth with the odd pale stone.",
    palette: ["#3a2a1c", "#6b4a30", "#8d6844", "#cbb48a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float clod = FBM(uv, 3.0 * sc);
      float grit = N(uv, 11.0 * sc);
      float pit = N(uv, 6.0 * sc);
      float t = clamp(clod * 0.62 + grit * 0.22 + (pit - 0.5) * 0.12, 0.0, 0.999);
      vec3 c = pick4(t);
      float stone = smoothstep(0.82, 0.96, N(uv, 16.0 * sc));
      return mix(c, uC3, stone);
    }`,
  }),
  g({
    id: "gravel",
    name: "Gravel",
    category: "Ground",
    blurb: "Loose stones sitting in a darker bed.",
    palette: ["#2a2824", "#6a655c", "#9a9388", "#d9d2c6"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float f = 9.0 * SC();
      // Pixel stones are whole cells straddling the tile edge, so the rim matches.
      if (uLook < 0.5) {
        vec2 p = fract(uv + 0.5 / f);
        vec2 cell = wrap2(floor(p * f), f);
        vec2 w = worley((cell + 0.5) / f, f);
        float stone = 1.0 - step(0.40, w.x);
        return mix(uC0, pick4(H(cell)), stone);
      }
      vec2 w = worley(uv, f);
      float stone = 1.0 - smoothstep(0.12, 0.28, w.x);
      float n = H(wrap2(floor(uv * f), f));
      return mix(uC0, pick4(n), stone);
    }`,
  }),
  g({
    id: "mud",
    name: "Wet Mud",
    category: "Ground",
    blurb: "Dark soil with glossy low spots.",
    palette: ["#1c140e", "#4a3424", "#6e5034", "#c8b49a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 3.0 * SC());
      vec3 c = mix4(0.15 + 0.65 * n);
      float puddle = smoothstep(0.62, 0.82, n);
      return mix(c, uC3, puddle * 0.65);
    }`,
  }),
  g({
    id: "snow",
    name: "Snow Field",
    category: "Ground",
    blurb: "Soft drifts and a few cold sparks.",
    palette: ["#3e6284", "#7aa4c4", "#b9d4e8", "#e7f3fb"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float spark = step(0.93, N(uv, 18.0 * sc));
      vec3 c = mix(uC0, uC3, 0.45 + 0.55 * n);
      c = mix(c, uC3, spark);
      // Painted warms the ramp; a wider cool mix keeps blue-white shadows.
      // Poster needs the same spread or it collapses onto one stop.
      if (uLook > 0.5 && uLook < 1.5) {
        c = mix(uC0, uC3, clamp(n * 1.05 - 0.02, 0.0, 1.0));
      } else if (uLook > 2.5) {
        c = mix(uC0, uC3, smoothstep(0.28, 0.72, n));
      }
      return c;
    }`,
  }),
  g({
    id: "ash",
    name: "Ash",
    category: "Ground",
    blurb: "Cool cinders with a rare live ember.",
    motion: true,
    palette: ["#1a1918", "#4a4744", "#8a847c", "#e25822"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      vec3 c = pick4(n * 0.8);
      float ember = step(0.975, N(uv + vec2(uTime * 0.02, 0.0), 12.0 * sc));
      return mix(c, uC3, ember);
    }`,
  }),
  g({
    id: "clay",
    name: "Raw Clay",
    category: "Ground",
    blurb: "Soft sedimentary bands in kiln clay.",
    palette: ["#6a382c", "#a85a42", "#d48968", "#f0c8b0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 0.65 * N(uv, 5.0 * sc) + 0.35 * N(uv, 2.0 * sc);
      float bands = 0.5 + 0.5 * sin(uv.y * 6.28318 * 3.0 * sc + n * 2.0);
      return pick4(0.15 + 0.55 * n + 0.12 * bands);
    }`,
  }),
  g({
    id: "peat",
    name: "Peat",
    category: "Ground",
    blurb: "Dark fibrous soil, almost black between strands.",
    palette: ["#14110e", "#2c2418", "#4a3a24", "#7a6840"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fib = 1.0 - smoothstep(0.02, 0.2, abs(fract(uv.y * 14.0 * sc + N(uv, 3.0 * sc)) - 0.5));
      vec3 c = pick4(n * 0.75);
      c = mix(c, uC1, fib * 0.45);
      // Painted and poster were stuck on the dark stop. Fibers reach uC3
      // before those finishes quantize. Pixel and hyper-real stay on the line above.
      if (uLook > 0.5 && uLook < 1.5) {
        float t = clamp(max(smoothstep(0.08, 0.7, fib), smoothstep(0.28, 0.78, n)), 0.0, 1.0);
        c = mix(uC0, uC3, t);
      } else if (uLook > 2.5) {
        float strand = max(fib, smoothstep(0.42, 0.75, n));
        c = mix(uC0, uC3, smoothstep(0.35, 0.88, strand));
      }
      return c;
    }`,
  }),
  g({
    id: "moss",
    name: "Moss Clumps",
    category: "Ground",
    blurb: "Rounded colonies on a bare patch of soil.",
    palette: ["#1a1812", "#2f4a28", "#5e8a44", "#c6d6a4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 5.0 * sc);
      float clump = 1.0 - smoothstep(0.12, 0.42, w.x);
      float n = FBM(uv, 6.0 * sc);
      vec3 leaf = pick4(0.35 + 0.55 * n);
      return mix(uC0, leaf, clump);
    }`,
  }),
  g({
    id: "granite",
    name: "Granite",
    category: "Ground",
    blurb: "Salt-and-pepper granite. Fine mineral specks, no open cracks.",
    palette: ["#6e6e68", "#84847e", "#94948c", "#d2cec4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float base = N(uv, 7.0 * sc);
      float pepper = smoothstep(0.45, 0.82, N(uv, 52.0 * sc));
      float salt = smoothstep(0.72, 0.96, N(uv, 44.0 * sc + 1.7));
      float warm = smoothstep(0.8, 0.98, N(uv, 28.0 * sc + 4.0));
      vec3 c = mix(uC1, uC2, base);
      c = mix(c, uC0, pepper * 0.55);
      c = mix(c, uC3, salt * 0.75);
      return mix(c, vec3(uC2.r, uC1.g, uC0.b), warm * 0.35);
    }`,
  }),
  g({
    id: "asphalt",
    name: "Asphalt",
    category: "Ground",
    blurb: "Tar, pale aggregate, and a wandering crack.",
    palette: ["#121212", "#2a2a28", "#8a8680", "#d0ccc4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 6.0 * sc);
      vec3 c = mix(uC0, uC1, n);
      vec2 w = worley(uv, 2.0 * sc);
      float crack = 1.0 - smoothstep(0.012, 0.05, w.y - w.x);
      float stones = step(0.86, N(uv, 18.0 * sc));
      c = mix(c, uC2, stones);
      return mix(c, uC0, crack * 0.92);
    }`,
  }),
  g({
    id: "erosion",
    name: "Strata",
    category: "Ground",
    blurb: "Stacked sediment with a dark bed line.",
    palette: ["#2c241c", "#6a5344", "#a78462", "#e2d0b4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float strata = fract(uv.y * 6.0 * sc + n * 1.4);
      float line = 1.0 - smoothstep(0.0, 0.08, strata);
      vec3 c = pick4(0.15 + 0.7 * n);
      return mix(c, uC0, line * 0.85);
    }`,
  }),

  g({
    id: "concrete",
    name: "Concrete",
    category: "Built",
    blurb: "Flat gray with a crack that skips some cells.",
    palette: ["#3a3a38", "#6e6e6a", "#9a9a94", "#d2d0c8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.5 * sc);
      float agg = N(uv, 18.0 * sc);
      float t = clamp(0.32 + 0.38 * n + (agg - 0.5) * 0.16, 0.0, 0.999);
      vec3 c = pick4(t);
      vec2 w = worley(uv, 2.2 * sc);
      float crack = 1.0 - smoothstep(0.012, 0.045, w.y - w.x);
      float allow = step(0.62, H(wrap2(floor(uv * 2.0 * sc), 2.0 * sc)));
      c = mix(c, uC2, step(0.9, agg) * 0.55);
      return mix(c, uC0, crack * allow);
    }`,
  }),
  g({
    id: "stucco",
    name: "Stucco",
    category: "Built",
    blurb: "Fine sandy dash, almost a solid tone.",
    palette: ["#c2a88c", "#d8c4aa", "#ead8c4", "#f6eee4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 18.0 * sc);
      float n2 = N(uv, 6.0 * sc);
      return pick4(0.25 + 0.45 * n2 + 0.22 * n);
    }`,
  }),
  g({
    id: "cinder",
    name: "Cinder Block",
    category: "Built",
    blurb: "A block face with three core holes.",
    palette: ["#1c1c1a", "#5c5c58", "#8a8a84", "#c8c6be"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 2.0 * sc;
      vec2 g = fract(uv * vec2(cols, sc));
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      float h1 = length(g - vec2(0.25, 0.5));
      float h2 = length(g - vec2(0.5, 0.5));
      float h3 = length(g - vec2(0.75, 0.5));
      float hole = 1.0 - smoothstep(0.07, 0.11, min(h1, min(h2, h3)));
      float seam = 1.0 - face(g, 0.03, 0.04, cols);
      c = mix(c, uC0, hole);
      return mix(c, uC0, seam * 0.8);
    }`,
  }),
  g({
    id: "shingle",
    name: "Shingles",
    category: "Built",
    blurb: "Offset courses with a shadow under each lip.",
    palette: ["#2a2420", "#5c4638", "#8c6850", "#c4a080"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      float rows = 6.0 * sc;
      float row = floor(uv.y * rows);
      float x = fract(uv.x * cols + mod(row, 2.0) * 0.5);
      float y = fract(uv.y * rows);
      float m = face(vec2(x, y), 0.04, 0.08, cols);
      float shade = 0.25 + 0.45 * N(uv, cols) + 0.15 * y;
      vec3 c = pick4(shade);
      c = mix(c, uC0, smoothstep(0.72, 0.98, y));
      return mix(uC0, c, m);
    }`,
  }),
  g({
    id: "pantile",
    name: "Pantile",
    category: "Built",
    blurb: "Overlapping barrel tiles, offset each course.",
    palette: ["#6a2c24", "#a84838", "#d47858", "#f0c8b0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 4.0 * sc;
      float cols = 6.0 * sc;
      float row = floor(uv.y * rows);
      vec2 f = fract(vec2(uv.x * cols + mod(row, 2.0) * 0.5, uv.y * rows));
      float d = length((f - vec2(0.5, 0.22)) * vec2(0.85, 1.45));
      float cap = 1.0 - smoothstep(0.66, 0.78, d);
      float n = N(uv, 8.0 * sc);
      return mix(uC0, mix(uC1, uC2, n), cap);
    }`,
  }),
  g({
    id: "plaster",
    name: "Cracked Plaster",
    category: "Built",
    blurb: "Warm wall color with hairline cracks.",
    palette: ["#6a5348", "#cbb59a", "#e4d4c0", "#f6efe6"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      vec2 w = worley(uv, 3.0 * sc);
      float crack = 1.0 - smoothstep(0.01, 0.04, w.y - w.x);
      return mix(c, uC0, crack * 0.75);
    }`,
  }),
  g({
    id: "terrazzo",
    name: "Terrazzo",
    category: "Built",
    blurb: "Chips scattered in a honed binder.",
    palette: ["#2c3a3a", "#d8d2c8", "#c45a3a", "#e0b15a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 7.0 * sc;
      vec2 w = worley(uv, f);
      float chip = 1.0 - smoothstep(0.14, 0.24, w.x);
      float idn = H(wrap2(floor(uv * f), f));
      vec3 base = mix(uC0, uC1, 0.45 + 0.55 * N(uv, 3.0 * sc));
      vec3 fleck = pick4(idn);
      return mix(base, fleck, chip * step(0.42, idn));
    }`,
  }),
  g({
    id: "slate",
    name: "Slate",
    category: "Built",
    blurb: "Stacked cleft sheets. Blue-gray faces and thin staggered joints.",
    palette: ["#3e464c", "#5c656c", "#737a82", "#8d949b"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 7.0 * sc;
      float cols = 3.0 * sc;
      vec2 b = brickUv(uv, cols, rows);
      float seam = face(b, 0.045, 0.1, rows);
      float n = N(uv, 9.0 * sc);
      float cleft = 1.0 - smoothstep(0.04, 0.2, abs(fract(uv.x * cols * 2.0 + n) - 0.5));
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC3, cleft * 0.22);
      return mix(uC0, c, seam);
    }`,
  }),
  g({
    id: "rebar",
    name: "Rebar Grid",
    category: "Built",
    blurb: "Concrete seen through a rust-dark bar grid.",
    palette: ["#4a2c1c", "#8a8a84", "#b0aea6", "#d8d4cc"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      float gx = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.x * 3.0 * sc) - 0.5));
      float gy = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.y * 3.0 * sc) - 0.5));
      return mix(c, uC0, clamp(gx + gy, 0.0, 1.0));
    }`,
  }),
  g({
    id: "ceramic",
    name: "Glazed Tile",
    category: "Built",
    blurb: "Square glaze pools inside a dark joint.",
    palette: ["#1c2428", "#1e6a78", "#3aa8a0", "#d8f2ee"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      vec2 g = fract(uv * cols);
      float m = face(g, 0.06, 0.06, cols);
      float glaze = FBM(uv, 2.0 * sc);
      vec3 c = mix4(0.35 + 0.5 * glaze);
      return mix(uC0, c, m);
    }`,
  }),

  g({
    id: "canvas",
    name: "Canvas",
    category: "Fiber",
    blurb: "Plain weave, one thread over the next.",
    palette: ["#cbb892", "#e4d2ae", "#f3e6c8", "#faf6ee"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 14.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float thread = alt < 0.5 ? f.y : f.x;
      float v = smoothstep(0.12, 0.5, thread) * (1.0 - smoothstep(0.5, 0.88, thread));
      return mix(uC0, uC2, v);
    }`,
  }),
  g({
    id: "linen",
    name: "Linen",
    category: "Fiber",
    blurb: "A loose grid of slubs, almost cloth.",
    palette: ["#b7a48c", "#d2c2aa", "#e6d8c4", "#f7f1e8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float vx = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.x * 22.0 * sc) - 0.5));
      float hy = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.y * 22.0 * sc) - 0.5));
      float n = N(uv, 8.0 * sc);
      return mix(uC1, uC3, clamp(max(vx, hy) * 0.85 + n * 0.2, 0.0, 1.0));
    }`,
  }),
  g({
    id: "knit",
    name: "Knit",
    category: "Fiber",
    blurb: "Offset loops, like a ribbed sweater.",
    palette: ["#3a2428", "#8a4450", "#c47078", "#f0c8c4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length((b - vec2(0.5, 0.58)) * vec2(1.15, 1.7));
      float loop = (1.0 - smoothstep(0.26, 0.42, d)) * smoothstep(0.1, 0.2, d);
      float n = N(uv, 4.0 * sc);
      vec3 yarn = mix(uC1, uC2, n);
      return mix(uC0, yarn, loop);
    }`,
  }),
  g({
    id: "quilt",
    name: "Quilt",
    category: "Fiber",
    blurb: "Stitched squares with alternating diagonals.",
    palette: ["#2a2428", "#8a3e48", "#d4896a", "#f2e2c8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      vec2 f = fract(uv * n);
      float alt = mod(g.x + g.y, 2.0);
      float d = alt < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float stitch = 1.0 - smoothstep(0.02, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      vec3 c = mix(uC1, uC2, 1.0 - smoothstep(0.0, 0.25, d));
      return mix(c, uC0, stitch);
    }`,
  }),
  g({
    id: "thatch",
    name: "Thatch",
    category: "Fiber",
    blurb: "Bundled straw, offset, with a dark tie.",
    palette: ["#4a3418", "#8a6428", "#c49648", "#e8d09a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float clumps = 5.0 * sc;
      float row = floor(uv.y * clumps);
      float x = fract(uv.x * clumps + mod(row, 2.0) * 0.5);
      float y = fract(uv.y * clumps);
      float strand = abs(fract((x + y) * 7.0) - 0.5);
      float s = 1.0 - smoothstep(0.06, 0.28, strand);
      vec3 c = mix(uC0, uC2, s);
      c = mix(c, uC1, 1.0 - smoothstep(0.0, 0.18, y));
      return c;
    }`,
  }),
  g({
    id: "denim",
    name: "Denim",
    category: "Fiber",
    blurb: "Twill diagonal with a little wash.",
    palette: ["#14283c", "#1e466e", "#3d6ea0", "#c5d4e4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float d = fract((uv.x + uv.y * 0.5) * 24.0 * sc);
      float tw = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(0.28, 0.5, d));
      float n = N(uv, 10.0 * sc);
      return mix(uC0, uC2, tw * 0.9 + 0.12 * n);
    }`,
  }),
  g({
    id: "corduroy",
    name: "Corduroy",
    category: "Fiber",
    blurb: "Vertical wales with a soft valley between.",
    palette: ["#3a241c", "#7a4030", "#b46848", "#e8c4a8"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = abs(fract(uv.x * 16.0 * sc) - 0.5);
      float wale = 1.0 - smoothstep(0.08, 0.42, y);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, uC2, wale * (0.7 + 0.3 * n));
    }`,
  }),
  g({
    id: "burlap",
    name: "Burlap",
    category: "Fiber",
    blurb: "Coarse open weave, gaps at the crossings.",
    palette: ["#3a2c18", "#8a6a3c", "#c4a06a", "#ead8b4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 8.0 * SC();
      vec2 f = fract(uv * n);
      float gap = smoothstep(0.08, 0.2, f.x) * smoothstep(0.08, 0.2, f.y)
        * (1.0 - smoothstep(0.72, 0.9, f.x)) * (1.0 - smoothstep(0.72, 0.9, f.y));
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      vec3 thread = alt < 0.5 ? uC1 : uC2;
      return mix(uC0, thread, gap);
    }`,
  }),
  g({
    id: "reed",
    name: "Woven Reed",
    category: "Fiber",
    blurb: "Wide flat strands crossing on a square.",
    palette: ["#3e3424", "#8a7048", "#c4a46c", "#f0e0bc"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = 6.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float wave = 0.5 + 0.5 * sin((alt < 0.5 ? f.x : f.y) * 6.28318);
      vec3 c = mix(uC1, uC2, wave);
      float edge = 1.0 - face(f, 0.07, 0.07, n);
      return mix(c, uC0, edge * 0.7);
    }`,
  }),
  g({
    id: "paper",
    name: "Laid Paper",
    category: "Fiber",
    blurb: "Warm sheet with fiber flecks.",
    palette: ["#8a7a62", "#d9cbb0", "#f0e6d4", "#faf6ee"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fleck = step(0.94, N(uv, 20.0 * sc));
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, fleck);
    }`,
  }),

  g({
    id: "brushed",
    name: "Brushed Steel",
    category: "Metal",
    blurb: "Long horizontal grain, cool and flat.",
    palette: ["#2a3036", "#66727c", "#a8b4be", "#e6eef2"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 40.0 * sc + (N(uv, 3.0 * sc) - 0.5) * 1.4) - 0.5);
      float b = 1.0 - smoothstep(0.02, 0.22, streaks);
      float n = N(uv, 8.0 * sc);
      return mix(uC0, uC3, 0.28 + 0.45 * b + 0.12 * n);
    }`,
  }),
  g({
    id: "rust",
    name: "Rust",
    category: "Metal",
    blurb: "Flaking oxide with dark pits.",
    palette: ["#2a140c", "#8a3418", "#c46228", "#e8a85a"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.6 * sc);
      float flake = FBM(uv + vec2(0.17, 0.09), 6.5 * sc);
      float pits = worley(uv, 7.0 * sc).x;
      vec3 c = mix4(clamp(n * 0.72 + flake * 0.28, 0.0, 1.0));
      float scale = smoothstep(0.42, 0.58, flake) * (1.0 - smoothstep(0.58, 0.74, flake));
      c = mix(c, uC3, scale * 0.35);
      return mix(c, uC0, 1.0 - smoothstep(0.04, 0.14, pits));
    }`,
  }),
  g({
    id: "tread",
    name: "Diamond Plate",
    category: "Metal",
    blurb: "Raised treads staggered across a brushed bed.",
    palette: ["#24282c", "#5a646c", "#8e9aa2", "#d5dee4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      float rows = 6.0 * sc;
      float row = floor(uv.y * rows);
      vec2 f = fract(vec2(uv.x * cols + mod(row, 2.0) * 0.5, uv.y * rows));
      float d = abs(f.x - 0.5) + abs(f.y - 0.42) * 1.25;
      float bump = 1.0 - smoothstep(0.18, 0.34, d);
      float n = N(uv, 10.0 * sc);
      vec3 base = mix(uC0, uC1, 0.35 + 0.4 * n);
      return mix(base, uC3, bump);
    }`,
  }),
  g({
    id: "carbon",
    name: "Carbon Twill",
    category: "Metal",
    blurb: "2×2 twill, dark, with a faint sheen.",
    palette: ["#0e0e10", "#2a2a30", "#6a6a74", "#c8c8d0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv * (8.0 * sc);
      vec2 i = floor(p);
      vec2 f = fract(p);
      float d = mod(i.x + i.y, 2.0) < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float twill = 1.0 - smoothstep(0.12, 0.42, d);
      float n = N(uv, 16.0 * sc);
      return mix(uC0, uC2, twill * 0.85 + n * 0.12);
    }`,
  }),
  g({
    id: "copper",
    name: "Copper Sheet",
    category: "Metal",
    blurb: "Brushed copper with a dull stain.",
    palette: ["#4a2414", "#a85a32", "#d48958", "#f0d2b0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 28.0 * sc) - 0.5);
      float b = 1.0 - smoothstep(0.04, 0.28, streaks);
      float stain = FBM(uv, 2.0 * sc);
      vec3 c = mix(uC0, uC2, 0.35 + 0.5 * b);
      return mix(c, uC3, smoothstep(0.62, 0.9, stain) * 0.55);
    }`,
  }),
  g({
    id: "vent",
    name: "Vent",
    category: "Metal",
    blurb: "Horizontal slots in a painted housing.",
    palette: ["#14181c", "#3a444c", "#7a868e", "#d0d8de"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 10.0 * sc;
      float y = fract(uv.y * rows);
      float slot = smoothstep(0.18, 0.28, y) * (1.0 - smoothstep(0.62, 0.74, y));
      float n = N(uv, 2.0 * sc);
      vec3 housing = mix(uC1, uC2, n);
      return mix(uC0, housing, 1.0 - slot);
    }`,
  }),
  g({
    id: "gold",
    name: "Gold Leaf",
    category: "Metal",
    blurb: "Uneven leaf with bright flakes.",
    palette: ["#5a3a12", "#a87820", "#e2b04a", "#fff0c0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float flake = N(uv, 12.0 * sc);
      vec3 c = mix4(0.3 + 0.55 * n);
      return mix(c, uC3, smoothstep(0.76, 0.95, flake));
    }`,
  }),
  g({
    id: "anodized",
    name: "Anodized",
    category: "Metal",
    blurb: "A dyed metal band that shifts across the tile.",
    palette: ["#14202c", "#1e5a7a", "#c45a6a", "#f0d2a0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float v = 0.5 + 0.5 * sin(uv.y * 6.28318 * 2.0 * sc + FBM(uv, 2.0 * sc) * 3.0);
      return mix4(v);
    }`,
  }),
  g({
    id: "chainmail",
    name: "Chainmail",
    category: "Metal",
    blurb: "Interlocked rings on a dark backing.",
    palette: ["#1a1c20", "#6a7078", "#a8b0b8", "#e4eaee"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 8.0 * sc);
      float d = length(b - vec2(0.5, 0.5));
      float ring = smoothstep(0.16, 0.22, d) * (1.0 - smoothstep(0.32, 0.4, d));
      float n = N(uv, 4.0 * sc);
      vec3 steel = mix(uC1, uC2, n);
      return mix(uC0, steel, ring);
    }`,
  }),

  g({
    id: "bark",
    name: "Bark",
    category: "Nature",
    blurb: "Vertical ridges with a little wander.",
    palette: ["#2a1c14", "#5c3a28", "#8a5c40", "#c49a74"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float ridges = abs(fract(uv.x * 7.0 * sc + FBM(uv, 2.0 * sc) * 1.1) - 0.5);
      float r = 1.0 - smoothstep(0.02, 0.18, ridges);
      float n = N(uv, 6.0 * sc);
      vec3 c = pick4(0.18 + 0.6 * n);
      return mix(c, uC0, r * 0.85);
    }`,
  }),
  g({
    id: "marble",
    name: "Marble",
    category: "Nature",
    blurb: "Pale ground cut by a dark vein.",
    palette: ["#2a2c30", "#c8c6c2", "#e6e4e0", "#f7f6f4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float vein = abs(sin((uv.y * 3.0 * sc + n * 1.6) * 6.28318));
      float v = 1.0 - smoothstep(0.0, 0.16, vein);
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, v);
    }`,
  }),
  g({
    id: "ice",
    name: "Ice",
    category: "Nature",
    blurb: "Pale crystal with hairline fractures.",
    palette: ["#1a3040", "#8ec4d4", "#d4eef4", "#f7fcfe"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.5 * sc);
      vec2 w = worley(uv, 3.5 * sc);
      float crack = 1.0 - smoothstep(0.015, 0.055, w.y - w.x);
      float facet = smoothstep(0.08, 0.28, w.x);
      vec3 c = mix(uC1, uC3, clamp(0.25 + 0.7 * n, 0.0, 1.0));
      c = mix(c, uC2, facet * 0.35);
      return mix(c, uC0, crack * 0.7);
    }`,
  }),
  g({
    id: "leather",
    name: "Leather",
    category: "Nature",
    blurb: "Hide grain and small pores.",
    palette: ["#2a160e", "#6a3420", "#a85a38", "#e0b090"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pores = worley(uv, 12.0 * sc).x;
      vec3 c = pick4(0.22 + 0.55 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.04, 0.12, pores)) * 0.75);
    }`,
  }),
  g({
    id: "cloud",
    name: "Cloud Deck",
    category: "Nature",
    blurb: "A slow drift of cloud over a flat sky.",
    motion: true,
    palette: ["#8aa4b8", "#c5d6e2", "#e7eef4", "#f8fbfd"],
    glsl: `vec3 groutStyle(vec2 uv) {
      vec2 p = uv + vec2(uTime * 0.03, 0.0);
      float n = FBM(p, 2.0 * SC());
      float m = smoothstep(0.38, 0.75, n);
      return mix(uC0, uC3, m);
    }`,
  }),
  g({
    id: "coral",
    name: "Coral",
    category: "Nature",
    blurb: "Branching ridges on a deep ground.",
    palette: ["#3a1428", "#a83858", "#e47878", "#f8d0c0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 6.0 * sc);
      float n = FBM(uv, 3.0 * sc);
      float branch = 1.0 - smoothstep(0.04, 0.16, abs(w.x - 0.16));
      vec3 c = mix(uC0, uC1, n);
      return mix(c, uC3, branch);
    }`,
  }),
  g({
    id: "scales",
    name: "Scales",
    category: "Nature",
    blurb: "Offset arcs, like fish or roof scales.",
    palette: ["#14281c", "#1e6848", "#3aaa78", "#d8f2e0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length(b - vec2(0.5, 0.12));
      float s = 1.0 - smoothstep(0.46, 0.58, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC3, (1.0 - smoothstep(0.2, 0.5, d)) * s * 0.35);
      return mix(uC0, c, s);
    }`,
  }),
  g({
    id: "cork",
    name: "Cork",
    category: "Nature",
    blurb: "Warm granules punched with pores.",
    palette: ["#4a3018", "#8a5c34", "#c49058", "#edd2a4"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pore = worley(uv, 8.0 * sc).x;
      vec3 c = pick4(0.2 + 0.6 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.03, 0.1, pore)) * 0.85);
    }`,
  }),
  g({
    id: "bamboo",
    name: "Bamboo",
    category: "Nature",
    blurb: "Culms side by side with a node ring.",
    palette: ["#3a4a20", "#6a8a38", "#a8c868", "#e4f0c0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 6.0 * sc;
      float col = gid(uv, cols);
      float x = fract(uv.x * cols);
      float y = fract(uv.y * 3.0 * sc + H(vec2(col, 2.0)));
      float node = 1.0 - smoothstep(0.0, 0.09, y);
      float culm = face(vec2(x, 0.5), 0.06, 0.0, cols);
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC0, node * 0.8);
      c = mix(c, uC3, (1.0 - node) * N(uv, 16.0 * sc) * 0.2);
      return mix(uC0, c, culm);
    }`,
  }),
  g({
    id: "foam",
    name: "Sea Foam",
    category: "Nature",
    blurb: "Packed bubbles with a thin dark rim.",
    palette: ["#1a4048", "#d5e8ea", "#f4fbfb", "#ffffff"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float f = 7.0 * SC();
      vec2 w = worley(uv, f);
      float bubble = 1.0 - smoothstep(0.06, 0.2, w.x);
      float rim = smoothstep(0.12, 0.2, w.x) * (1.0 - smoothstep(0.2, 0.3, w.x));
      vec3 c = mix(uC0, uC2, bubble);
      return mix(c, uC1, rim);
    }`,
  }),
  g({
    id: "obsidian",
    name: "Obsidian",
    category: "Nature",
    blurb: "Near-black glass with a hard highlight.",
    palette: ["#07080c", "#1a2030", "#3a4860", "#d8e4f0"],
    glsl: `vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 2.0 * SC());
      float shine = smoothstep(0.72, 0.95, n);
      vec3 c = mix(uC0, uC1, n * 0.85);
      return mix(c, uC3, shine);
    }`,
  }),
];

const byId = new Map(STYLES.map((style) => [style.id, style]));

export function getStyle(id: string): StyleDef {
  return byId.get(id) ?? STYLES[0];
}

export function resolvePalette(
  style: StyleDef,
  paletteId: string,
): [string, string, string, string] {
  if (paletteId === "style") return style.palette;
  const found = PALETTES.find((palette) => palette.id === paletteId);
  return found?.colors ?? style.palette;
}

export const STYLE_COUNT = STYLES.length;
