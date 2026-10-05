import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-x0gNcEa4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CATEGORIES = [
	"Reviewed",
	"Bond",
	"Ground",
	"Built",
	"Fiber",
	"Metal",
	"Nature",
	"Signal"
];
var LOOKS = [
	{
		id: "pixel",
		label: "Pixel art",
		value: 0
	},
	{
		id: "painted",
		label: "Painted",
		value: 1
	},
	{
		id: "real",
		label: "Hyper real",
		value: 2
	},
	{
		id: "poster",
		label: "Poster",
		value: 3
	}
];
var SIZES = [
	{
		value: 16,
		label: "16×16"
	},
	{
		value: 32,
		label: "32×32"
	},
	{
		value: 64,
		label: "64×64"
	},
	{
		value: 128,
		label: "128×128"
	},
	{
		value: 0,
		label: "Smooth"
	}
];
function lookValue(id) {
	return LOOKS.find((look) => look.id === id)?.value ?? 0;
}
var PALETTES = [
	{
		id: "style",
		name: "Style"
	},
	{
		id: "mortar",
		name: "Mortar",
		colors: [
			"#2a2724",
			"#6d675f",
			"#b7b0a4",
			"#ece4d6"
		]
	},
	{
		id: "kiln",
		name: "Kiln",
		colors: [
			"#3a221c",
			"#8a3e2d",
			"#d4652f",
			"#f0d2b4"
		]
	},
	{
		id: "moss",
		name: "Moss",
		colors: [
			"#1c2618",
			"#3d5233",
			"#7d9a62",
			"#d5ddc4"
		]
	},
	{
		id: "sea",
		name: "Sea",
		colors: [
			"#102028",
			"#1d4e66",
			"#3e8ea8",
			"#d5eef2"
		]
	},
	{
		id: "ember",
		name: "Ember",
		colors: [
			"#2a120c",
			"#8a2e16",
			"#e26a2c",
			"#f6d36a"
		]
	},
	{
		id: "ink",
		name: "Ink",
		colors: [
			"#14120f",
			"#3a342c",
			"#a39886",
			"#efe6d6"
		]
	},
	{
		id: "copper",
		name: "Copper",
		colors: [
			"#2c1a12",
			"#6e3b28",
			"#b8734a",
			"#e6c2a2"
		]
	},
	{
		id: "bone",
		name: "Bone",
		colors: [
			"#4a3d32",
			"#8a7564",
			"#d9cbb8",
			"#f4efe6"
		]
	}
];
var g = (partial) => partial;
function toonWood(o) {
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
var STYLES = [
	g({
		id: "brick",
		name: "Running Bond",
		category: "Reviewed",
		preset: "brick",
		blurb: "Cookbook brick. Offset courses and a pale mortar joint.",
		palette: [
			"#4a241c",
			"#8d3b2c",
			"#c46a52",
			"#cfc3b2"
		],
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
    }`
	}),
	g({
		id: "stone",
		name: "Rubble",
		category: "Reviewed",
		preset: "stone",
		blurb: "Cookbook stone. Noisy faces broken by dark joints.",
		palette: [
			"#6a6862",
			"#7e7c76",
			"#908e88",
			"#b4b0a6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 9.0 * sc;
      vec2 w = worley(uv, f);
      float edge = 1.0 - smoothstep(0.015, 0.07, w.y - w.x);
      float n = FBM(uv, f);
      vec3 body = mix(uC1, uC2, n);
      body = mix(body, uC3, N(uv, 16.0 * sc) * 0.28);
      return mix(body, uC0, edge * 0.92);
    }`
	}),
	g({
		id: "metal",
		name: "Rivet Panel",
		category: "Reviewed",
		preset: "metal",
		blurb: "Cookbook metal. Vertical seams and paired rivets.",
		palette: [
			"#2c3842",
			"#5d6e7c",
			"#8ea0ae",
			"#d5e2ea"
		],
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
    }`
	}),
	g({
		id: "wood",
		name: "Plank Grain",
		category: "Reviewed",
		preset: "wood",
		blurb: "Cookbook wood. Horizontal grain, plank gaps, and knots.",
		palette: [
			"#3a2418",
			"#6b4228",
			"#a56b3e",
			"#e2c29a"
		],
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
    }`
	}),
	g({
		id: "sawn-oak",
		name: "Sawn Oak",
		category: "Fiber",
		blurb: "Shadertoy mdy3R1 board. Distorted fbm, musgrave grain, and the three wood colors.",
		palette: [
			"#080300",
			"#401c0a",
			"#855230",
			"#e7c39a"
		],
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
    }`
	}),
	g({
		id: "toon-plank",
		name: "Toon Plank",
		category: "Fiber",
		blurb: "Cartoon boards. Grain, knots, cracks, bevel, and 5-step cel light.",
		palette: [
			"#48220b",
			"#9b480d",
			"#d97925",
			"#090401"
		],
		glsl: toonWood({
			cols: 8,
			gap: .0043,
			grainFx: 6,
			grainFy: 4.4,
			grainAmt: .23,
			knot: .455,
			crack: 2.55,
			bevel: .014,
			steps: 5
		})
	}),
	g({
		id: "knot-comic",
		name: "Knot Comic",
		category: "Fiber",
		blurb: "Same plank functions, mismatched: wide boards, a knot on almost every one, cracks off.",
		palette: [
			"#5c2e10",
			"#c46a22",
			"#f0b15a",
			"#1a0c06"
		],
		glsl: toonWood({
			cols: 4,
			gap: .006,
			grainFx: 3.5,
			grainFy: 2.2,
			grainAmt: .4,
			knot: .08,
			crack: 0,
			bevel: .02,
			steps: 3
		})
	}),
	g({
		id: "crack-comic",
		name: "Crack Comic",
		category: "Fiber",
		blurb: "Same plank functions, mismatched: thin boards, heavy cracks, knots almost never.",
		palette: [
			"#2a140c",
			"#6a3818",
			"#c48448",
			"#0c0704"
		],
		glsl: toonWood({
			cols: 12,
			gap: .003,
			grainFx: 9,
			grainFy: 7,
			grainAmt: .08,
			knot: .92,
			crack: 4.2,
			bevel: .008,
			steps: 4
		})
	}),
	g({
		id: "dark-panels",
		name: "Dark Panels",
		category: "Fiber",
		blurb: "Dark stained panels. Warped fbm in a 16×3 stagger with thin seams.",
		palette: [
			"#0c0806",
			"#3a2416",
			"#5e3b22",
			"#100c0a"
		],
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
    }`
	}),
	g({
		id: "grass",
		name: "Turf",
		category: "Reviewed",
		preset: "grass",
		blurb: "Short even turf. Fine blades held in a tight olive range.",
		palette: [
			"#4a611c",
			"#536923",
			"#5c7226",
			"#6a8030"
		],
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
    }`
	}),
	g({
		id: "checkerboard",
		name: "Checker",
		category: "Reviewed",
		preset: "checkerboard",
		blurb: "Cookbook checker. Even tiles, a little scuff.",
		palette: [
			"#1a1816",
			"#efe6d6",
			"#8a8074",
			"#d4652f"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      float c = mod(g.x + g.y, 2.0);
      float dirt = N(uv, n * 2.0);
      return mix(c < 0.5 ? uC0 : uC1, uC2, dirt * 0.12);
    }`
	}),
	g({
		id: "water",
		name: "Shallow Water",
		category: "Reviewed",
		preset: "water",
		blurb: "Shallow turquoise water. Small caustic ripples and pale crests.",
		motion: true,
		palette: [
			"#4ea8a6",
			"#67b6b3",
			"#8ecfc8",
			"#e7f7f4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv + vec2(uTime * 0.015, uTime * 0.01);
      float a = FBM(p, 5.0 * sc);
      float b = FBM(p + vec2(0.37, 0.13), 8.0 * sc);
      float crest = smoothstep(0.58, 0.86, b);
      vec3 c = mix(uC0, uC1, 0.35 + 0.65 * a);
      c = mix(c, uC2, b * 0.7);
      return mix(c, uC3, crest * 0.28);
    }`
	}),
	g({
		id: "lava",
		name: "Magma",
		category: "Reviewed",
		preset: "lava",
		blurb: "Cookbook lava. Hot flow cut by cooled cracks.",
		motion: true,
		palette: [
			"#2a0a06",
			"#9a220c",
			"#e25822",
			"#ffd36a"
		],
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
    }`
	}),
	g({
		id: "sand",
		name: "Dry Sand",
		category: "Reviewed",
		preset: "sand",
		blurb: "Cookbook sand. Fine grain and a few darker pebbles.",
		palette: [
			"#7a6244",
			"#c4a56e",
			"#e6d2a4",
			"#f6ecd0"
		],
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
    }`
	}),
	g({
		id: "buttered",
		name: "Buttered Grout",
		category: "Bond",
		blurb: "Irregular tiles with a thick, pale joint. The mill's namesake.",
		palette: [
			"#6a5346",
			"#b08968",
			"#d8c3a5",
			"#efe4d4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float f = 4.0 * SC();
      vec2 w = worley(uv, f);
      float joint = 1.0 - smoothstep(0.045, 0.13, w.y - w.x);
      float n = N(uv, f * 2.0);
      vec3 tile = pick4(0.08 + 0.78 * n);
      vec3 mortar = mix(uC3, uC2, 0.35);
      return mix(tile, mortar, joint);
    }`
	}),
	g({
		id: "herringbone",
		name: "Herringbone",
		category: "Bond",
		blurb: "Parquet planks that flip direction every cell.",
		palette: [
			"#3e291c",
			"#7a5132",
			"#b58355",
			"#e6d2b4"
		],
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
    }`
	}),
	g({
		id: "basket",
		name: "Basket Weave",
		category: "Bond",
		blurb: "Over-under strips that swap axis each cell.",
		palette: [
			"#4a3424",
			"#8b6240",
			"#c49562",
			"#edd7b0"
		],
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
    }`
	}),
	g({
		id: "subway",
		name: "Subway Tile",
		category: "Bond",
		blurb: "Long ceramic courses with a narrow grout line.",
		palette: [
			"#8e8a84",
			"#d9d4cc",
			"#f4f1ea",
			"#c45a3a"
		],
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
    }`
	}),
	g({
		id: "chevron",
		name: "Chevron",
		category: "Bond",
		blurb: "Sawtooth bands that close on the tile edge.",
		palette: [
			"#241c18",
			"#6e4a34",
			"#c9844a",
			"#f0e2cc"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = fract(uv.y * (4.0 * sc));
      float x = fract(uv.x * (2.0 * sc));
      float v = abs(x - 0.5);
      float band = abs(fract(y + v) - 0.5);
      float on = 1.0 - smoothstep(0.12, 0.22, band);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, mix(uC1, uC2, n), on);
    }`
	}),
	g({
		id: "diamond",
		name: "Diamond Tile",
		category: "Bond",
		blurb: "A diamond set in each cell, joint at the corners.",
		palette: [
			"#2c2824",
			"#6a645c",
			"#b7aea2",
			"#f2ebe1"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 5.0 * SC();
      vec2 f = fract(uv * n);
      float d = abs(f.x - 0.5) + abs(f.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float shade = N(uv, n * 2.0);
      vec3 body = mix(uC1, uC2, shade);
      return mix(uC0, body, m);
    }`
	}),
	g({
		id: "mosaic",
		name: "Tessera",
		category: "Bond",
		blurb: "Small chips, each its own palette index, bright grout.",
		palette: [
			"#1e3a4c",
			"#c4563a",
			"#e0b15a",
			"#f4efe6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float f = 8.0 * SC();
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.03, 0.08, w.y - w.x);
      float n = H(wrap2(floor(uv * f), f));
      vec3 chip = pick4(n);
      return mix(chip, uC3, mortar);
    }`
	}),
	g({
		id: "cobble",
		name: "Cobble",
		category: "Bond",
		blurb: "Rounded fieldstones with deep joints.",
		palette: [
			"#2a2926",
			"#5e5a54",
			"#8d877e",
			"#cfc6b8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float f = 5.0 * SC();
      vec2 w = worley(uv, f);
      float mortar = 1.0 - smoothstep(0.05, 0.14, w.y - w.x);
      float n = N(uv, 10.0 * SC());
      vec3 c = pick4(0.25 + 0.5 * n);
      return mix(c, uC0, mortar);
    }`
	}),
	g({
		id: "hex-bond",
		name: "Hex Bond",
		category: "Bond",
		blurb: "Offset diamonds that read as a hex pavement.",
		palette: [
			"#3d342c",
			"#7d6a58",
			"#c2a88c",
			"#efe4d6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 6.0 * sc, 4.0 * sc);
      float d = abs(b.x - 0.5) * 0.9 + abs(b.y - 0.5);
      float m = 1.0 - smoothstep(0.4, 0.5, d);
      float n = N(uv, 6.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      return mix(uC0, c, m);
    }`
	}),
	g({
		id: "honeycomb",
		name: "Honeycomb",
		category: "Bond",
		blurb: "Tight offset cells with a dark shared wall.",
		palette: [
			"#3a2a12",
			"#a87420",
			"#e2b04a",
			"#f6e2a8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = abs(b.x - 0.5) * 0.85 + abs(b.y - 0.5);
      float wall = smoothstep(0.36, 0.46, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, 0.4 + 0.5 * n);
      return mix(c, uC0, wall);
    }`
	}),
	g({
		id: "dirt",
		name: "Packed Dirt",
		category: "Ground",
		blurb: "Brown earth with the odd pale stone.",
		palette: [
			"#3a2a1c",
			"#6b4a30",
			"#8d6844",
			"#cbb48a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float p = N(uv, 14.0 * sc);
      vec3 c = pick4(n * 0.85);
      return mix(c, uC3, smoothstep(0.8, 0.94, p));
    }`
	}),
	g({
		id: "gravel",
		name: "Gravel",
		category: "Ground",
		blurb: "Loose stones sitting in a darker bed.",
		palette: [
			"#2a2824",
			"#6a655c",
			"#9a9388",
			"#d9d2c6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float f = 9.0 * SC();
      vec2 w = worley(uv, f);
      float stone = 1.0 - smoothstep(0.12, 0.28, w.x);
      float n = H(wrap2(floor(uv * f), f));
      return mix(uC0, pick4(n), stone);
    }`
	}),
	g({
		id: "mud",
		name: "Wet Mud",
		category: "Ground",
		blurb: "Dark soil with glossy low spots.",
		palette: [
			"#1c140e",
			"#4a3424",
			"#6e5034",
			"#c8b49a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 3.0 * SC());
      vec3 c = mix4(0.15 + 0.65 * n);
      float puddle = smoothstep(0.62, 0.82, n);
      return mix(c, uC3, puddle * 0.65);
    }`
	}),
	g({
		id: "snow",
		name: "Snow Field",
		category: "Ground",
		blurb: "Soft drifts and a few cold sparks.",
		palette: [
			"#8aa0b0",
			"#c5d4de",
			"#e7eef2",
			"#f7fbfd"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec3 c = mix(uC0, uC3, 0.45 + 0.55 * n);
      float spark = step(0.93, N(uv, 18.0 * sc));
      return mix(c, uC3, spark);
    }`
	}),
	g({
		id: "ash",
		name: "Ash",
		category: "Ground",
		blurb: "Cool cinders with a rare live ember.",
		motion: true,
		palette: [
			"#1a1918",
			"#4a4744",
			"#8a847c",
			"#e25822"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      vec3 c = pick4(n * 0.8);
      float ember = step(0.975, N(uv + vec2(uTime * 0.02, 0.0), 12.0 * sc));
      return mix(c, uC3, ember);
    }`
	}),
	g({
		id: "clay",
		name: "Raw Clay",
		category: "Ground",
		blurb: "Soft sedimentary bands in kiln clay.",
		palette: [
			"#6a382c",
			"#a85a42",
			"#d48968",
			"#f0c8b0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = 0.65 * N(uv, 5.0 * sc) + 0.35 * N(uv, 2.0 * sc);
      float bands = 0.5 + 0.5 * sin(uv.y * 6.28318 * 3.0 * sc + n * 2.0);
      return pick4(0.15 + 0.55 * n + 0.12 * bands);
    }`
	}),
	g({
		id: "peat",
		name: "Peat",
		category: "Ground",
		blurb: "Dark fibrous soil, almost black between strands.",
		palette: [
			"#14110e",
			"#2c2418",
			"#4a3a24",
			"#7a6840"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fib = 1.0 - smoothstep(0.02, 0.2, abs(fract(uv.y * 14.0 * sc + N(uv, 3.0 * sc)) - 0.5));
      vec3 c = pick4(n * 0.75);
      return mix(c, uC1, fib * 0.45);
    }`
	}),
	g({
		id: "moss",
		name: "Moss Clumps",
		category: "Ground",
		blurb: "Rounded colonies on a bare patch of soil.",
		palette: [
			"#1a1812",
			"#2f4a28",
			"#5e8a44",
			"#c6d6a4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 5.0 * sc);
      float clump = 1.0 - smoothstep(0.12, 0.42, w.x);
      float n = FBM(uv, 6.0 * sc);
      vec3 leaf = pick4(0.35 + 0.55 * n);
      return mix(uC0, leaf, clump);
    }`
	}),
	g({
		id: "granite",
		name: "Granite",
		category: "Ground",
		blurb: "Salt-and-pepper granite. Fine mineral specks, no open cracks.",
		palette: [
			"#6e6e68",
			"#84847e",
			"#94948c",
			"#d2cec4"
		],
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
    }`
	}),
	g({
		id: "asphalt",
		name: "Asphalt",
		category: "Ground",
		blurb: "Tar, pale aggregate, and a wandering crack.",
		palette: [
			"#121212",
			"#2a2a28",
			"#8a8680",
			"#d0ccc4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 6.0 * sc);
      vec3 c = mix(uC0, uC1, n);
      vec2 w = worley(uv, 2.0 * sc);
      float crack = 1.0 - smoothstep(0.012, 0.05, w.y - w.x);
      float stones = step(0.86, N(uv, 18.0 * sc));
      c = mix(c, uC2, stones);
      return mix(c, uC0, crack * 0.92);
    }`
	}),
	g({
		id: "erosion",
		name: "Strata",
		category: "Ground",
		blurb: "Stacked sediment with a dark bed line.",
		palette: [
			"#2c241c",
			"#6a5344",
			"#a78462",
			"#e2d0b4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float strata = fract(uv.y * 6.0 * sc + n * 1.4);
      float line = 1.0 - smoothstep(0.0, 0.08, strata);
      vec3 c = pick4(0.15 + 0.7 * n);
      return mix(c, uC0, line * 0.85);
    }`
	}),
	g({
		id: "concrete",
		name: "Concrete",
		category: "Built",
		blurb: "Flat gray with a crack that skips some cells.",
		palette: [
			"#3a3a38",
			"#6e6e6a",
			"#9a9a94",
			"#d2d0c8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      vec3 c = pick4(0.28 + 0.5 * n);
      vec2 w = worley(uv, 2.0 * sc);
      float crack = 1.0 - smoothstep(0.015, 0.05, w.y - w.x);
      float allow = step(0.55, H(wrap2(floor(uv * 2.0 * sc), 2.0 * sc)));
      return mix(c, uC0, crack * allow);
    }`
	}),
	g({
		id: "stucco",
		name: "Stucco",
		category: "Built",
		blurb: "Fine sandy dash, almost a solid tone.",
		palette: [
			"#c2a88c",
			"#d8c4aa",
			"#ead8c4",
			"#f6eee4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 18.0 * sc);
      float n2 = N(uv, 6.0 * sc);
      return pick4(0.25 + 0.45 * n2 + 0.22 * n);
    }`
	}),
	g({
		id: "cinder",
		name: "Cinder Block",
		category: "Built",
		blurb: "A block face with three core holes.",
		palette: [
			"#1c1c1a",
			"#5c5c58",
			"#8a8a84",
			"#c8c6be"
		],
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
    }`
	}),
	g({
		id: "shingle",
		name: "Shingles",
		category: "Built",
		blurb: "Offset courses with a shadow under each lip.",
		palette: [
			"#2a2420",
			"#5c4638",
			"#8c6850",
			"#c4a080"
		],
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
    }`
	}),
	g({
		id: "pantile",
		name: "Pantile",
		category: "Built",
		blurb: "Overlapping barrel tiles, offset each course.",
		palette: [
			"#6a2c24",
			"#a84838",
			"#d47858",
			"#f0c8b0"
		],
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
    }`
	}),
	g({
		id: "plaster",
		name: "Cracked Plaster",
		category: "Built",
		blurb: "Warm wall color with hairline cracks.",
		palette: [
			"#6a5348",
			"#cbb59a",
			"#e4d4c0",
			"#f6efe6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      vec2 w = worley(uv, 3.0 * sc);
      float crack = 1.0 - smoothstep(0.01, 0.04, w.y - w.x);
      return mix(c, uC0, crack * 0.75);
    }`
	}),
	g({
		id: "terrazzo",
		name: "Terrazzo",
		category: "Built",
		blurb: "Chips scattered in a honed binder.",
		palette: [
			"#2c3a3a",
			"#d8d2c8",
			"#c45a3a",
			"#e0b15a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float f = 7.0 * sc;
      vec2 w = worley(uv, f);
      float chip = 1.0 - smoothstep(0.14, 0.24, w.x);
      float idn = H(wrap2(floor(uv * f), f));
      vec3 base = mix(uC0, uC1, 0.45 + 0.55 * N(uv, 3.0 * sc));
      vec3 fleck = pick4(idn);
      return mix(base, fleck, chip * step(0.42, idn));
    }`
	}),
	g({
		id: "slate",
		name: "Slate",
		category: "Built",
		blurb: "Stacked cleft sheets. Blue-gray faces and thin staggered joints.",
		palette: [
			"#3e464c",
			"#5c656c",
			"#737a82",
			"#8d949b"
		],
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
    }`
	}),
	g({
		id: "rebar",
		name: "Rebar Grid",
		category: "Built",
		blurb: "Concrete seen through a rust-dark bar grid.",
		palette: [
			"#4a2c1c",
			"#8a8a84",
			"#b0aea6",
			"#d8d4cc"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 8.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      float gx = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.x * 3.0 * sc) - 0.5));
      float gy = 1.0 - smoothstep(0.035, 0.08, abs(fract(uv.y * 3.0 * sc) - 0.5));
      return mix(c, uC0, clamp(gx + gy, 0.0, 1.0));
    }`
	}),
	g({
		id: "ceramic",
		name: "Glazed Tile",
		category: "Built",
		blurb: "Square glaze pools inside a dark joint.",
		palette: [
			"#1c2428",
			"#1e6a78",
			"#3aa8a0",
			"#d8f2ee"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float cols = 4.0 * sc;
      vec2 g = fract(uv * cols);
      float m = face(g, 0.06, 0.06, cols);
      float glaze = FBM(uv, 2.0 * sc);
      vec3 c = mix4(0.35 + 0.5 * glaze);
      return mix(uC0, c, m);
    }`
	}),
	g({
		id: "canvas",
		name: "Canvas",
		category: "Fiber",
		blurb: "Plain weave, one thread over the next.",
		palette: [
			"#cbb892",
			"#e4d2ae",
			"#f3e6c8",
			"#faf6ee"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 14.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float thread = alt < 0.5 ? f.y : f.x;
      float v = smoothstep(0.12, 0.5, thread) * (1.0 - smoothstep(0.5, 0.88, thread));
      return mix(uC0, uC2, v);
    }`
	}),
	g({
		id: "linen",
		name: "Linen",
		category: "Fiber",
		blurb: "A loose grid of slubs, almost cloth.",
		palette: [
			"#b7a48c",
			"#d2c2aa",
			"#e6d8c4",
			"#f7f1e8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float vx = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.x * 22.0 * sc) - 0.5));
      float hy = 1.0 - smoothstep(0.32, 0.5, abs(fract(uv.y * 22.0 * sc) - 0.5));
      float n = N(uv, 8.0 * sc);
      return mix(uC1, uC3, clamp(max(vx, hy) * 0.85 + n * 0.2, 0.0, 1.0));
    }`
	}),
	g({
		id: "knit",
		name: "Knit",
		category: "Fiber",
		blurb: "Offset loops, like a ribbed sweater.",
		palette: [
			"#3a2428",
			"#8a4450",
			"#c47078",
			"#f0c8c4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length((b - vec2(0.5, 0.58)) * vec2(1.15, 1.7));
      float loop = (1.0 - smoothstep(0.26, 0.42, d)) * smoothstep(0.1, 0.2, d);
      float n = N(uv, 4.0 * sc);
      vec3 yarn = mix(uC1, uC2, n);
      return mix(uC0, yarn, loop);
    }`
	}),
	g({
		id: "quilt",
		name: "Quilt",
		category: "Fiber",
		blurb: "Stitched squares with alternating diagonals.",
		palette: [
			"#2a2428",
			"#8a3e48",
			"#d4896a",
			"#f2e2c8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 4.0 * SC();
      vec2 g = floor(uv * n);
      vec2 f = fract(uv * n);
      float alt = mod(g.x + g.y, 2.0);
      float d = alt < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float stitch = 1.0 - smoothstep(0.02, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      vec3 c = mix(uC1, uC2, 1.0 - smoothstep(0.0, 0.25, d));
      return mix(c, uC0, stitch);
    }`
	}),
	g({
		id: "thatch",
		name: "Thatch",
		category: "Fiber",
		blurb: "Bundled straw, offset, with a dark tie.",
		palette: [
			"#4a3418",
			"#8a6428",
			"#c49648",
			"#e8d09a"
		],
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
    }`
	}),
	g({
		id: "denim",
		name: "Denim",
		category: "Fiber",
		blurb: "Twill diagonal with a little wash.",
		palette: [
			"#14283c",
			"#1e466e",
			"#3d6ea0",
			"#c5d4e4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float d = fract((uv.x + uv.y * 0.5) * 24.0 * sc);
      float tw = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(0.28, 0.5, d));
      float n = N(uv, 10.0 * sc);
      return mix(uC0, uC2, tw * 0.9 + 0.12 * n);
    }`
	}),
	g({
		id: "corduroy",
		name: "Corduroy",
		category: "Fiber",
		blurb: "Vertical wales with a soft valley between.",
		palette: [
			"#3a241c",
			"#7a4030",
			"#b46848",
			"#e8c4a8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float y = abs(fract(uv.x * 16.0 * sc) - 0.5);
      float wale = 1.0 - smoothstep(0.08, 0.42, y);
      float n = N(uv, 6.0 * sc);
      return mix(uC0, uC2, wale * (0.7 + 0.3 * n));
    }`
	}),
	g({
		id: "burlap",
		name: "Burlap",
		category: "Fiber",
		blurb: "Coarse open weave, gaps at the crossings.",
		palette: [
			"#3a2c18",
			"#8a6a3c",
			"#c4a06a",
			"#ead8b4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 8.0 * SC();
      vec2 f = fract(uv * n);
      float gap = smoothstep(0.08, 0.2, f.x) * smoothstep(0.08, 0.2, f.y)
        * (1.0 - smoothstep(0.72, 0.9, f.x)) * (1.0 - smoothstep(0.72, 0.9, f.y));
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      vec3 thread = alt < 0.5 ? uC1 : uC2;
      return mix(uC0, thread, gap);
    }`
	}),
	g({
		id: "reed",
		name: "Woven Reed",
		category: "Fiber",
		blurb: "Wide flat strands crossing on a square.",
		palette: [
			"#3e3424",
			"#8a7048",
			"#c4a46c",
			"#f0e0bc"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = 6.0 * SC();
      vec2 f = fract(uv * n);
      float alt = mod(floor(uv.x * n) + floor(uv.y * n), 2.0);
      float wave = 0.5 + 0.5 * sin((alt < 0.5 ? f.x : f.y) * 6.28318);
      vec3 c = mix(uC1, uC2, wave);
      float edge = 1.0 - face(f, 0.07, 0.07, n);
      return mix(c, uC0, edge * 0.7);
    }`
	}),
	g({
		id: "paper",
		name: "Laid Paper",
		category: "Fiber",
		blurb: "Warm sheet with fiber flecks.",
		palette: [
			"#8a7a62",
			"#d9cbb0",
			"#f0e6d4",
			"#faf6ee"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 4.0 * sc);
      float fleck = step(0.94, N(uv, 20.0 * sc));
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, fleck);
    }`
	}),
	g({
		id: "brushed",
		name: "Brushed Steel",
		category: "Metal",
		blurb: "Long horizontal grain, cool and flat.",
		palette: [
			"#2a3036",
			"#66727c",
			"#a8b4be",
			"#e6eef2"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 40.0 * sc + (N(uv, 3.0 * sc) - 0.5) * 1.4) - 0.5);
      float b = 1.0 - smoothstep(0.02, 0.22, streaks);
      float n = N(uv, 8.0 * sc);
      return mix(uC0, uC3, 0.28 + 0.45 * b + 0.12 * n);
    }`
	}),
	g({
		id: "rust",
		name: "Rust",
		category: "Metal",
		blurb: "Flaking oxide with dark pits.",
		palette: [
			"#2a140c",
			"#8a3418",
			"#c46228",
			"#e8a85a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float pits = worley(uv, 6.0 * sc).x;
      vec3 c = mix4(n);
      return mix(c, uC0, 1.0 - smoothstep(0.05, 0.16, pits));
    }`
	}),
	g({
		id: "tread",
		name: "Diamond Plate",
		category: "Metal",
		blurb: "Raised treads staggered across a brushed bed.",
		palette: [
			"#24282c",
			"#5a646c",
			"#8e9aa2",
			"#d5dee4"
		],
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
    }`
	}),
	g({
		id: "carbon",
		name: "Carbon Twill",
		category: "Metal",
		blurb: "2×2 twill, dark, with a faint sheen.",
		palette: [
			"#0e0e10",
			"#2a2a30",
			"#6a6a74",
			"#c8c8d0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 p = uv * (8.0 * sc);
      vec2 i = floor(p);
      vec2 f = fract(p);
      float d = mod(i.x + i.y, 2.0) < 0.5 ? abs(f.x - f.y) : abs(f.x + f.y - 1.0);
      float twill = 1.0 - smoothstep(0.12, 0.42, d);
      float n = N(uv, 16.0 * sc);
      return mix(uC0, uC2, twill * 0.85 + n * 0.12);
    }`
	}),
	g({
		id: "copper",
		name: "Copper Sheet",
		category: "Metal",
		blurb: "Brushed copper with a dull stain.",
		palette: [
			"#4a2414",
			"#a85a32",
			"#d48958",
			"#f0d2b0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float streaks = abs(fract(uv.y * 28.0 * sc) - 0.5);
      float b = 1.0 - smoothstep(0.04, 0.28, streaks);
      float stain = FBM(uv, 2.0 * sc);
      vec3 c = mix(uC0, uC2, 0.35 + 0.5 * b);
      return mix(c, uC3, smoothstep(0.62, 0.9, stain) * 0.55);
    }`
	}),
	g({
		id: "hazard",
		name: "Hazard",
		category: "Metal",
		blurb: "Diagonal caution bands. Still seamless.",
		palette: [
			"#1a140c",
			"#c45512",
			"#3a342c",
			"#f0c030"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float s = fract((uv.x + uv.y) * 4.0 * SC());
      float band = step(0.5, s);
      float n = N(uv, 8.0 * SC());
      vec3 c = mix(uC0, uC3, band);
      return mix(c, uC1, n * 0.18);
    }`
	}),
	g({
		id: "vent",
		name: "Vent",
		category: "Metal",
		blurb: "Horizontal slots in a painted housing.",
		palette: [
			"#14181c",
			"#3a444c",
			"#7a868e",
			"#d0d8de"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float rows = 10.0 * sc;
      float y = fract(uv.y * rows);
      float slot = smoothstep(0.18, 0.28, y) * (1.0 - smoothstep(0.62, 0.74, y));
      float n = N(uv, 2.0 * sc);
      vec3 housing = mix(uC1, uC2, n);
      return mix(uC0, housing, 1.0 - slot);
    }`
	}),
	g({
		id: "gold",
		name: "Gold Leaf",
		category: "Metal",
		blurb: "Uneven leaf with bright flakes.",
		palette: [
			"#5a3a12",
			"#a87820",
			"#e2b04a",
			"#fff0c0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      float flake = N(uv, 12.0 * sc);
      vec3 c = mix4(0.3 + 0.55 * n);
      return mix(c, uC3, smoothstep(0.76, 0.95, flake));
    }`
	}),
	g({
		id: "anodized",
		name: "Anodized",
		category: "Metal",
		blurb: "A dyed metal band that shifts across the tile.",
		palette: [
			"#14202c",
			"#1e5a7a",
			"#c45a6a",
			"#f0d2a0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float v = 0.5 + 0.5 * sin(uv.y * 6.28318 * 2.0 * sc + FBM(uv, 2.0 * sc) * 3.0);
      return mix4(v);
    }`
	}),
	g({
		id: "chainmail",
		name: "Chainmail",
		category: "Metal",
		blurb: "Interlocked rings on a dark backing.",
		palette: [
			"#1a1c20",
			"#6a7078",
			"#a8b0b8",
			"#e4eaee"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 8.0 * sc);
      float d = length(b - vec2(0.5, 0.5));
      float ring = smoothstep(0.16, 0.22, d) * (1.0 - smoothstep(0.32, 0.4, d));
      float n = N(uv, 4.0 * sc);
      vec3 steel = mix(uC1, uC2, n);
      return mix(uC0, steel, ring);
    }`
	}),
	g({
		id: "bark",
		name: "Bark",
		category: "Nature",
		blurb: "Vertical ridges with a little wander.",
		palette: [
			"#2a1c14",
			"#5c3a28",
			"#8a5c40",
			"#c49a74"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float ridges = abs(fract(uv.x * 7.0 * sc + FBM(uv, 2.0 * sc) * 1.1) - 0.5);
      float r = 1.0 - smoothstep(0.02, 0.18, ridges);
      float n = N(uv, 6.0 * sc);
      vec3 c = pick4(0.18 + 0.6 * n);
      return mix(c, uC0, r * 0.85);
    }`
	}),
	g({
		id: "marble",
		name: "Marble",
		category: "Nature",
		blurb: "Pale ground cut by a dark vein.",
		palette: [
			"#2a2c30",
			"#c8c6c2",
			"#e6e4e0",
			"#f7f6f4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 2.0 * sc);
      float vein = abs(sin((uv.y * 3.0 * sc + n * 1.6) * 6.28318));
      float v = 1.0 - smoothstep(0.0, 0.16, vein);
      vec3 c = mix(uC2, uC3, n);
      return mix(c, uC0, v);
    }`
	}),
	g({
		id: "ice",
		name: "Ice",
		category: "Nature",
		blurb: "Pale crystal with hairline fractures.",
		palette: [
			"#1a3040",
			"#8ec4d4",
			"#d4eef4",
			"#f7fcfe"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 3.0 * sc);
      vec2 w = worley(uv, 4.0 * sc);
      float crack = 1.0 - smoothstep(0.02, 0.07, w.y - w.x);
      vec3 c = mix(uC1, uC3, 0.35 + 0.65 * n);
      return mix(c, uC0, crack * 0.55);
    }`
	}),
	g({
		id: "leather",
		name: "Leather",
		category: "Nature",
		blurb: "Hide grain and small pores.",
		palette: [
			"#2a160e",
			"#6a3420",
			"#a85a38",
			"#e0b090"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pores = worley(uv, 12.0 * sc).x;
      vec3 c = pick4(0.22 + 0.55 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.04, 0.12, pores)) * 0.75);
    }`
	}),
	g({
		id: "cloud",
		name: "Cloud Deck",
		category: "Nature",
		blurb: "A slow drift of cloud over a flat sky.",
		motion: true,
		palette: [
			"#8aa4b8",
			"#c5d6e2",
			"#e7eef4",
			"#f8fbfd"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      vec2 p = uv + vec2(uTime * 0.03, 0.0);
      float n = FBM(p, 2.0 * SC());
      float m = smoothstep(0.38, 0.75, n);
      return mix(uC0, uC3, m);
    }`
	}),
	g({
		id: "coral",
		name: "Coral",
		category: "Nature",
		blurb: "Branching ridges on a deep ground.",
		palette: [
			"#3a1428",
			"#a83858",
			"#e47878",
			"#f8d0c0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 w = worley(uv, 6.0 * sc);
      float n = FBM(uv, 3.0 * sc);
      float branch = 1.0 - smoothstep(0.04, 0.16, abs(w.x - 0.16));
      vec3 c = mix(uC0, uC1, n);
      return mix(c, uC3, branch);
    }`
	}),
	g({
		id: "scales",
		name: "Scales",
		category: "Nature",
		blurb: "Offset arcs, like fish or roof scales.",
		palette: [
			"#14281c",
			"#1e6848",
			"#3aaa78",
			"#d8f2e0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      vec2 b = brickUv(uv, 8.0 * sc, 6.0 * sc);
      float d = length(b - vec2(0.5, 0.12));
      float s = 1.0 - smoothstep(0.46, 0.58, d);
      float n = N(uv, 4.0 * sc);
      vec3 c = mix(uC1, uC2, n);
      c = mix(c, uC3, (1.0 - smoothstep(0.2, 0.5, d)) * s * 0.35);
      return mix(uC0, c, s);
    }`
	}),
	g({
		id: "cork",
		name: "Cork",
		category: "Nature",
		blurb: "Warm granules punched with pores.",
		palette: [
			"#4a3018",
			"#8a5c34",
			"#c49058",
			"#edd2a4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = FBM(uv, 5.0 * sc);
      float pore = worley(uv, 8.0 * sc).x;
      vec3 c = pick4(0.2 + 0.6 * n);
      return mix(c, uC0, (1.0 - smoothstep(0.03, 0.1, pore)) * 0.85);
    }`
	}),
	g({
		id: "bamboo",
		name: "Bamboo",
		category: "Nature",
		blurb: "Culms side by side with a node ring.",
		palette: [
			"#3a4a20",
			"#6a8a38",
			"#a8c868",
			"#e4f0c0"
		],
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
    }`
	}),
	g({
		id: "foam",
		name: "Sea Foam",
		category: "Nature",
		blurb: "Packed bubbles with a thin dark rim.",
		palette: [
			"#1a4048",
			"#d5e8ea",
			"#f4fbfb",
			"#ffffff"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float f = 7.0 * SC();
      vec2 w = worley(uv, f);
      float bubble = 1.0 - smoothstep(0.06, 0.2, w.x);
      float rim = smoothstep(0.12, 0.2, w.x) * (1.0 - smoothstep(0.2, 0.3, w.x));
      vec3 c = mix(uC0, uC2, bubble);
      return mix(c, uC1, rim);
    }`
	}),
	g({
		id: "obsidian",
		name: "Obsidian",
		category: "Nature",
		blurb: "Near-black glass with a hard highlight.",
		palette: [
			"#07080c",
			"#1a2030",
			"#3a4860",
			"#d8e4f0"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = FBM(uv, 2.0 * SC());
      float shine = smoothstep(0.72, 0.95, n);
      vec3 c = mix(uC0, uC1, n * 0.85);
      return mix(c, uC3, shine);
    }`
	}),
	g({
		id: "circuit",
		name: "Circuit",
		category: "Signal",
		blurb: "Traces and a few square pads on a board.",
		palette: [
			"#102018",
			"#1e6a38",
			"#c6a24a",
			"#e8f6d8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float cols = 8.0 * SC();
      vec2 g = fract(uv * cols);
      vec2 id = wrap2(floor(uv * cols), cols);
      float trace = 0.0;
      if (H(id) > 0.42) trace = max(trace, 1.0 - smoothstep(0.45, 0.55, abs(g.x - 0.5) * 2.0));
      if (H(id + 3.0) > 0.55) trace = max(trace, 1.0 - smoothstep(0.45, 0.55, abs(g.y - 0.5) * 2.0));
      float pad = (1.0 - smoothstep(0.12, 0.2, length(g - vec2(0.5, 0.5)))) * step(0.82, H(id + 8.0));
      vec3 c = uC0;
      c = mix(c, uC2, clamp(trace, 0.0, 1.0));
      return mix(c, uC1, pad);
    }`
	}),
	g({
		id: "panel",
		name: "Sci Panel",
		category: "Signal",
		blurb: "Inset plates. Some of them carry a lamp.",
		palette: [
			"#14181c",
			"#2a343c",
			"#4a5a66",
			"#e2b04a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float cols = 4.0 * SC();
      vec2 g = fract(uv * cols);
      float panel = face(g, 0.08, 0.08, cols);
      float n = N(uv, cols);
      vec3 c = mix(uC0, mix(uC1, uC2, n), panel);
      vec2 id = wrap2(floor(uv * cols), cols);
      float lamp = step(0.8, H(id));
      float ld = length(g - vec2(0.78, 0.22));
      float on = (1.0 - smoothstep(0.035, 0.07, ld)) * lamp * panel;
      return mix(c, uC3, on);
    }`
	}),
	g({
		id: "dither",
		name: "Ordered Dither",
		category: "Signal",
		blurb: "A vertical ramp through a 4-step Bayer threshold.",
		palette: [
			"#1a120e",
			"#6a3a28",
			"#d4652f",
			"#f6e6d4"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      vec2 px = floor(uv * RES());
      float threshold = mod(mod(px.x, 2.0) + mod(px.y, 2.0) * 2.0, 4.0) / 4.0;
      float v = step(threshold, uv.y);
      return mix(uC0, uC3, v);
    }`
	}),
	g({
		id: "plasma",
		name: "Plasma",
		category: "Signal",
		blurb: "Three sine fields, periodic, slowly turning.",
		motion: true,
		palette: [
			"#1a1030",
			"#6a2878",
			"#e25822",
			"#f6d36a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float v = 0.5 + 0.5 * sin(uv.x * 6.28318 * sc + uTime);
      v += 0.5 + 0.5 * sin(uv.y * 6.28318 * 2.0 * sc - uTime * 0.7);
      v += 0.5 + 0.5 * sin((uv.x + uv.y) * 6.28318 * sc + uTime * 0.4);
      return mix4(v / 3.0);
    }`
	}),
	g({
		id: "film",
		name: "Film Grain",
		category: "Signal",
		blurb: "Frame-stepped grain that still tiles.",
		motion: true,
		palette: [
			"#12100e",
			"#3a342c",
			"#a39886",
			"#efe6d6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      vec2 px = wrap2(floor(uv * RES() + vec2(floor(uTime * 12.0), 0.0)), RES());
      float n = H(px);
      return mix(uC0, uC3, n);
    }`
	}),
	g({
		id: "hatch",
		name: "Crosshatch",
		category: "Signal",
		blurb: "Ink lines on a paper ground.",
		palette: [
			"#1a140e",
			"#5c4636",
			"#a89880",
			"#f3eadc"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float a = 1.0 - smoothstep(0.0, 0.06, abs(fract(uv.x * 14.0 * sc) - 0.5));
      float b = 1.0 - smoothstep(0.0, 0.05, abs(fract((uv.x + uv.y) * 10.0 * sc) - 0.5));
      return mix(uC3, uC0, clamp(a + b, 0.0, 1.0));
    }`
	}),
	g({
		id: "oil",
		name: "Oil Slick",
		category: "Signal",
		blurb: "A thin-film shift that keeps the tile period.",
		motion: true,
		palette: [
			"#101820",
			"#1e6a5a",
			"#c43a6a",
			"#f0d36a"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float n = FBM(uv + vec2(uTime * 0.02, 0.0), 2.0 * SC());
      float v = fract(n * 3.0 + uTime * 0.05);
      return mix4(v);
    }`
	}),
	g({
		id: "static",
		name: "Static",
		category: "Signal",
		blurb: "One palette index per pixel. Seed changes the field.",
		palette: [
			"#141210",
			"#3a342c",
			"#a39886",
			"#efe6d6"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float q = H(wrap2(floor(uv * RES()), RES()));
      return pick4(q);
    }`
	}),
	g({
		id: "phosphor",
		name: "Phosphor",
		category: "Signal",
		blurb: "Scanlines over a dim green field.",
		palette: [
			"#04140c",
			"#0e3a22",
			"#3dcc6e",
			"#d8ffd8"
		],
		glsl: `vec3 groutStyle(vec2 uv) {
      float sc = SC();
      float n = N(uv, 6.0 * sc);
      float line = 0.65 + 0.35 * (0.5 + 0.5 * sin(uv.y * 6.28318 * RES() * 0.5));
      vec3 c = mix(uC0, uC2, 0.35 + 0.5 * n);
      return c * line;
    }`
	})
];
var byId = new Map(STYLES.map((style) => [style.id, style]));
function getStyle(id) {
	return byId.get(id) ?? STYLES[0];
}
function resolvePalette(style, paletteId) {
	if (paletteId === "style") return style.palette;
	return PALETTES.find((palette) => palette.id === paletteId)?.colors ?? style.palette;
}
var STYLE_COUNT = STYLES.length;
var VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
var BODY = `
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
var MAIN = `
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
var LIVE_UNIFORMS = `
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
function liveFragment(styleGlsl) {
	return `${PRECISION}${LIVE_UNIFORMS}${BODY}${styleGlsl}\n${MAIN}`;
}
function f3(c) {
	return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;
}
function f1(n) {
	return `${n.toFixed(2)}`;
}
function exportFragment(styleGlsl, tile) {
	const time = tile.motion ? "uniform float uTime;" : "const float uTime = 0.0;";
	return `${`// Grout Shader reusable tile
// ${tile.name} (${tile.id})
// Sample with UV 0..1. The result is periodic — repeat it.
// Vertex: attribute vec2 aPos; varying vec2 vUv; gl_Position = vec4(aPos,0,0,1); vUv = aPos*0.5+0.5;
`}${PRECISION}${`
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
`}${BODY}${styleGlsl}\n${MAIN}`;
}
function hexToRgb(hex) {
	const h = hex.replace("#", "");
	return [
		Number.parseInt(h.slice(0, 2), 16) / 255,
		Number.parseInt(h.slice(2, 4), 16) / 255,
		Number.parseInt(h.slice(4, 6), 16) / 255
	];
}
var QUAD = new Float32Array([
	-1,
	-1,
	1,
	-1,
	-1,
	1,
	-1,
	1,
	1,
	-1,
	1,
	1
]);
function contextFor(canvas, preserve) {
	const gl = canvas.getContext("webgl", {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
		preserveDrawingBuffer: preserve,
		premultipliedAlpha: false
	});
	if (!gl) throw new Error("WebGL is not available in this browser.");
	gl.disable(gl.DITHER);
	return gl;
}
var Target = class {
	gl;
	programs = /* @__PURE__ */ new Map();
	errors = /* @__PURE__ */ new Map();
	buffer;
	constructor(canvas, preserve) {
		this.gl = contextFor(canvas, preserve);
		const buffer = this.gl.createBuffer();
		if (!buffer) throw new Error("Could not allocate a shader buffer.");
		this.buffer = buffer;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, QUAD, this.gl.STATIC_DRAW);
	}
	program(style) {
		const cached = this.programs.get(style.id);
		if (cached) return cached;
		if (this.errors.has(style.id)) return null;
		try {
			const program = linkProgram(this.gl, liveFragment(style.glsl));
			this.programs.set(style.id, program);
			return program;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Shader failed to compile.";
			this.errors.set(style.id, message);
			return null;
		}
	}
	draw(style, params, width, height) {
		const program = this.program(style);
		const gl = this.gl;
		if (!program) return false;
		gl.viewport(0, 0, width, height);
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		const set1 = (name, value) => {
			const loc = gl.getUniformLocation(program, name);
			if (loc) gl.uniform1f(loc, value);
		};
		const set3 = (name, color) => {
			const loc = gl.getUniformLocation(program, name);
			if (loc) gl.uniform3f(loc, color[0], color[1], color[2]);
		};
		set3("uC0", params.colors[0]);
		set3("uC1", params.colors[1]);
		set3("uC2", params.colors[2]);
		set3("uC3", params.colors[3]);
		set1("uTime", params.time);
		set1("uSeed", params.seed);
		set1("uScale", params.scale);
		set1("uPixels", params.pixels);
		set1("uWear", params.wear);
		set1("uRepeat", params.repeat);
		set1("uLook", params.look);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		return true;
	}
	dropPrograms() {
		for (const program of this.programs.values()) this.gl.deleteProgram(program);
		this.programs.clear();
	}
};
function compile(gl, type, source) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Could not create a shader.");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) || "compile failed";
		gl.deleteShader(shader);
		throw new Error(log);
	}
	return shader;
}
function linkProgram(gl, fragment) {
	const program = gl.createProgram();
	if (!program) throw new Error("Could not create a program.");
	const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
	const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.bindAttribLocation(program, 0, "aPos");
	gl.linkProgram(program);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) || "link failed";
		gl.deleteProgram(program);
		throw new Error(log);
	}
	return program;
}
var ShaderMill = class {
	display;
	util;
	thumbs = /* @__PURE__ */ new Map();
	constructor(displayCanvas, utilCanvas) {
		this.display = new Target(displayCanvas, false);
		this.util = new Target(utilCanvas, true);
		const restore = (target) => {
			target.gl.canvas.addEventListener("webglcontextlost", (event) => {
				event.preventDefault();
			});
			target.gl.canvas.addEventListener("webglcontextrestored", () => {
				target.dropPrograms();
				target.errors.clear();
			});
		};
		restore(this.display);
		restore(this.util);
	}
	error(id) {
		return this.display.errors.get(id) ?? this.util.errors.get(id);
	}
	drawDisplay(canvas, style, params) {
		return this.display.draw(style, params, canvas.width, canvas.height);
	}
	drawUtil(canvas, style, params) {
		return this.util.draw(style, params, canvas.width, canvas.height);
	}
	thumbnail(canvas, style, params, key) {
		const cached = this.thumbs.get(key);
		if (cached) return cached;
		canvas.width = 96;
		canvas.height = 96;
		if (!this.util.draw(style, params, 96, 96)) return null;
		const url = canvas.toDataURL("image/jpeg", .72);
		this.thumbs.set(key, url);
		return url;
	}
	clearThumbs() {
		this.thumbs.clear();
	}
	dispose() {
		this.display.dropPrograms();
		this.util.dropPrograms();
	}
};
var JUDGE_REFS = [
	{
		id: "brick",
		label: "Brick",
		file: "/judge/brick.jpg",
		styles: [
			"brick",
			"herringbone",
			"basket",
			"chevron",
			"diamond",
			"hex-bond",
			"honeycomb",
			"pantile",
			"shingle"
		]
	},
	{
		id: "stone",
		label: "Stone",
		file: "/judge/stone.jpg",
		styles: [
			"stone",
			"cobble",
			"gravel",
			"terrazzo"
		]
	},
	{
		id: "metal",
		label: "Metal",
		file: "/judge/metal.jpg",
		styles: [
			"metal",
			"brushed",
			"tread",
			"vent",
			"anodized"
		]
	},
	{
		id: "plank",
		label: "Plank",
		file: "/judge/plank.jpg",
		styles: [
			"wood",
			"bark",
			"cork"
		]
	},
	{
		id: "oak",
		label: "Oak",
		file: "/judge/oak.jpg",
		styles: ["sawn-oak"]
	},
	{
		id: "panels",
		label: "Dark panels",
		file: "/judge/panels.jpg",
		styles: ["dark-panels"]
	},
	{
		id: "toon",
		label: "Toon wood",
		file: "/judge/toon.jpg",
		styles: [
			"toon-plank",
			"knot-comic",
			"crack-comic"
		]
	},
	{
		id: "grass",
		label: "Grass",
		file: "/judge/grass.jpg",
		styles: ["grass", "moss"]
	},
	{
		id: "sand",
		label: "Sand",
		file: "/judge/sand.jpg",
		styles: ["sand", "clay"]
	},
	{
		id: "water",
		label: "Water",
		file: "/judge/water.jpg",
		styles: ["water"]
	},
	{
		id: "granite",
		label: "Granite",
		file: "/judge/granite.jpg",
		styles: ["granite"]
	},
	{
		id: "slate",
		label: "Slate",
		file: "/judge/slate.jpg",
		styles: ["slate"]
	}
];
var REF_BY_STYLE = /* @__PURE__ */ new Map();
for (const ref of JUDGE_REFS) for (const id of ref.styles) REF_BY_STYLE.set(id, ref);
function refForStyle(id) {
	return REF_BY_STYLE.get(id);
}
function lum(r, g, b) {
	return .2126 * r + .7152 * g + .0722 * b;
}
function readFeatures(data, w, h) {
	const n = w * h;
	let mr = 0;
	let mg = 0;
	let mb = 0;
	const hue = [
		0,
		0,
		0,
		0,
		0,
		0
	];
	let hueN = 0;
	for (let i = 0; i < n; i++) {
		const r = data[i * 4] ?? 0;
		const g = data[i * 4 + 1] ?? 0;
		const b = data[i * 4 + 2] ?? 0;
		mr += r;
		mg += g;
		mb += b;
		const max = Math.max(r, g, b);
		const d = max - Math.min(r, g, b);
		if (d < 8 || max < 12) continue;
		let h = 0;
		if (max === r) h = (g - b) / d % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		if (h < 0) h += 6;
		const bin = Math.min(5, Math.floor(h));
		hue[bin] = (hue[bin] ?? 0) + 1;
		hueN += 1;
	}
	mr /= n;
	mg /= n;
	mb /= n;
	if (hueN > 0) for (let i = 0; i < 6; i++) hue[i] = (hue[i] ?? 0) / hueN;
	let varSum = 0;
	let gx = 0;
	let gy = 0;
	const at = (x, y) => {
		const i = (y * w + x) * 4;
		return lum(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
	};
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const l = at(x, y);
		varSum += (l - lum(mr, mg, mb)) ** 2;
		if (x + 1 < w) gx += Math.abs(at(x + 1, y) - l);
		if (y + 1 < h) gy += Math.abs(at(x, y + 1) - l);
	}
	const edges = gx + gy;
	return {
		mean: [
			mr,
			mg,
			mb
		],
		std: Math.sqrt(varSum / n),
		hue,
		energy: edges / n,
		aniso: edges > 1 ? gx / edges : .5
	};
}
function seamError(data, w, h) {
	let err = 0;
	let count = 0;
	const pix = (x, y, c) => data[(y * w + x) * 4 + c] ?? 0;
	for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) {
		err += Math.abs(pix(0, y, c) - pix(w - 1, y, c));
		count += 1;
	}
	for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
		err += Math.abs(pix(x, 0, c) - pix(x, h - 1, c));
		count += 1;
	}
	return err / count / 255;
}
function matchScore(a, b) {
	const color = 1 - Math.min(1, Math.hypot(a.mean[0] - b.mean[0], a.mean[1] - b.mean[1], a.mean[2] - b.mean[2]) / 180);
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < 6; i++) {
		const av = a.hue[i] ?? 0;
		const bv = b.hue[i] ?? 0;
		dot += av * bv;
		na += av * av;
		nb += bv * bv;
	}
	const hue = na < 1e-6 || nb < 1e-6 ? .5 : dot / (Math.sqrt(na) * Math.sqrt(nb));
	const detail = 1 - Math.min(1, Math.abs(a.std - b.std) / 50);
	const energy = 1 - Math.min(1, Math.abs(a.energy - b.energy) / 30);
	const aniso = 1 - Math.abs(a.aniso - b.aniso);
	return .42 * color + .28 * hue + .12 * detail + .08 * energy + .1 * aniso;
}
function verdict(seam, match, flat, compiled) {
	if (!compiled) return {
		pass: false,
		reason: "shader failed"
	};
	if (match === null) return {
		pass: false,
		reason: "no reference"
	};
	if (flat) return {
		pass: false,
		reason: "too flat"
	};
	if (seam > .16) return {
		pass: false,
		reason: "seam"
	};
	if (match < .58) return {
		pass: false,
		reason: "unlike reference"
	};
	return {
		pass: true,
		reason: "matches"
	};
}
function recipeText(style, settings) {
	return JSON.stringify({
		format: "grout-shader/1",
		style: style.id,
		name: style.name,
		category: style.category,
		preset: style.preset ?? null,
		motion: Boolean(style.motion),
		seed: settings.seed,
		scale: settings.scale,
		pixels: settings.pixels,
		wear: Number(settings.wear.toFixed(2)),
		palette: settings.paletteId,
		look: settings.look,
		colors: settings.colors,
		repeatSafe: true
	}, null, 2);
}
function glslText(style, settings) {
	const colors = settings.colors.map(hexToRgb);
	const tile = {
		name: style.name,
		id: style.id,
		motion: Boolean(style.motion),
		seed: settings.seed,
		scale: settings.scale,
		pixels: settings.pixels,
		wear: settings.wear,
		look: lookValue(settings.look),
		colors
	};
	return exportFragment(style.glsl, tile);
}
function crc32(data) {
	let c = -1;
	for (let i = 0; i < data.length; i += 1) {
		c ^= data[i] ?? 0;
		for (let k = 0; k < 8; k += 1) c = c >>> 1 ^ 3988292384 & -(c & 1);
	}
	return ~c >>> 0;
}
function bytes(data) {
	const copy = new ArrayBuffer(data.byteLength);
	new Uint8Array(copy).set(data);
	return copy;
}
function zipStore(files) {
	const parts = [];
	const central = [];
	let offset = 0;
	const enc = new TextEncoder();
	for (const file of files) {
		const name = enc.encode(file.name);
		const crc = crc32(file.data);
		const local = new Uint8Array(30 + name.length);
		const view = new DataView(local.buffer);
		view.setUint32(0, 67324752, true);
		view.setUint16(4, 20, true);
		view.setUint16(8, 0, true);
		view.setUint32(14, crc, true);
		view.setUint32(18, file.data.length, true);
		view.setUint32(22, file.data.length, true);
		view.setUint16(26, name.length, true);
		local.set(name, 30);
		parts.push(bytes(local), bytes(file.data));
		const cen = new Uint8Array(46 + name.length);
		const cv = new DataView(cen.buffer);
		cv.setUint32(0, 33639248, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, file.data.length, true);
		cv.setUint32(24, file.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		cen.set(name, 46);
		central.push(cen);
		offset += local.length + file.data.length;
	}
	const centralSize = central.reduce((sum, part) => sum + part.length, 0);
	const end = /* @__PURE__ */ new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 101010256, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);
	return new Blob([
		...parts,
		...central.map(bytes),
		bytes(end)
	], { type: "application/zip" });
}
var STORAGE_KEY = "grout-shader-v1";
var SCALE_CHOICES = [
	1,
	2,
	3,
	4
];
var REPEAT_CHOICES = [
	1,
	2,
	3,
	4
];
var EXPORT_CHOICES = [
	32,
	64,
	128,
	256,
	512
];
var INITIAL = {
	styleId: "brick",
	seed: 1204,
	scale: 1,
	pixels: 32,
	wear: .35,
	repeat: 2,
	animate: false,
	paletteId: "style",
	look: "pixel",
	exportSize: 256,
	favorites: [],
	category: "All",
	query: ""
};
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
function loadState() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			return {
				...INITIAL,
				animate: !reduce
			};
		}
		const data = JSON.parse(raw);
		const styleId = STYLES.some((style) => style.id === data.styleId) ? data.styleId : INITIAL.styleId;
		const pixels = SIZES.some((size) => size.value === data.pixels) ? data.pixels : INITIAL.pixels;
		const scale = SCALE_CHOICES.includes(data.scale) ? data.scale : 1;
		const repeat = REPEAT_CHOICES.includes(data.repeat) ? data.repeat : 2;
		const exportSize = EXPORT_CHOICES.includes(data.exportSize) ? data.exportSize : 256;
		const paletteId = PALETTES.some((palette) => palette.id === data.paletteId) ? data.paletteId : "style";
		const look = LOOKS.some((item) => item.id === data.look) ? data.look : INITIAL.look;
		let category = "All";
		if (data.category === "All" || data.category === "Kept") category = data.category;
		else if (typeof data.category === "string" && CATEGORIES.includes(data.category)) category = data.category;
		const seedNum = Number(data.seed);
		const wearNum = Number(data.wear);
		const favorites = Array.isArray(data.favorites) ? data.favorites.filter((id) => STYLES.some((style) => style.id === id)) : [];
		return {
			styleId,
			seed: clamp(Number.isFinite(seedNum) ? Math.round(seedNum) : INITIAL.seed, 0, 999999),
			scale,
			pixels,
			wear: clamp(Number.isFinite(wearNum) ? wearNum : INITIAL.wear, 0, 1),
			repeat,
			animate: Boolean(data.animate),
			paletteId,
			look,
			exportSize,
			favorites,
			category,
			query: ""
		};
	} catch {
		return INITIAL;
	}
}
function paramsFor(state, time) {
	const colors = resolvePalette(getStyle(state.styleId), state.paletteId).map(hexToRgb);
	return {
		seed: state.seed,
		scale: state.scale,
		pixels: state.pixels,
		wear: state.wear,
		repeat: state.repeat,
		time,
		look: lookValue(state.look),
		colors
	};
}
function thumbParams(styleId, pixels, look) {
	return {
		seed: 7,
		scale: 1,
		pixels,
		wear: .28,
		repeat: 1,
		time: 0,
		look,
		colors: getStyle(styleId).palette.map(hexToRgb)
	};
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
function snapshot(source) {
	const copy = document.createElement("canvas");
	copy.width = source.width;
	copy.height = source.height;
	const ctx = copy.getContext("2d");
	if (!ctx) return null;
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(source, 0, 0);
	return copy;
}
function canvasPng(source) {
	return new Promise((resolve) => {
		source.toBlob(async (blob) => {
			if (!blob) {
				resolve(null);
				return;
			}
			resolve(new Uint8Array(await blob.arrayBuffer()));
		}, "image/png");
	});
}
function MillApp() {
	const displayRef = (0, import_react.useRef)(null);
	const utilRef = (0, import_react.useRef)(null);
	const millRef = (0, import_react.useRef)(null);
	const stateRef = (0, import_react.useRef)(INITIAL);
	const drawRef = (0, import_react.useRef)(null);
	const restartRef = (0, import_react.useRef)(() => {});
	const catalogBusy = (0, import_react.useRef)(false);
	const selectedRef = (0, import_react.useRef)(null);
	const [state, setState] = (0, import_react.useState)(INITIAL);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const [mixOpen, setMixOpen] = (0, import_react.useState)(false);
	const [judgeOpen, setJudgeOpen] = (0, import_react.useState)(false);
	const [judgeBusy, setJudgeBusy] = (0, import_react.useState)(false);
	const [judgeRows, setJudgeRows] = (0, import_react.useState)(null);
	const [thumbs, setThumbs] = (0, import_react.useState)({});
	const [shaderErrors, setShaderErrors] = (0, import_react.useState)({});
	const [glError, setGlError] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("");
	const [fired, setFired] = (0, import_react.useState)(0);
	stateRef.current = state;
	(0, import_react.useEffect)(() => {
		const canvas = displayRef.current;
		const util = utilRef.current;
		if (!canvas || !util) return;
		let mill;
		try {
			mill = new ShaderMill(canvas, util);
		} catch (error) {
			setGlError(error instanceof Error ? error.message : "WebGL failed to start.");
			return;
		}
		millRef.current = mill;
		let frame = 0;
		let alive = true;
		const startedAt = performance.now();
		const resize = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
			const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
		};
		const paint = (time) => {
			const current = stateRef.current;
			const style = getStyle(current.styleId);
			resize();
			mill.drawDisplay(canvas, style, paramsFor(current, time));
			const message = mill.error(style.id);
			if (message) setShaderErrors((prev) => prev[style.id] === message ? prev : {
				...prev,
				[style.id]: message
			});
		};
		const loop = (now) => {
			if (!alive) return;
			const current = stateRef.current;
			const style = getStyle(current.styleId);
			if (!(current.animate && style.motion) || document.visibilityState === "hidden") return;
			paint((now - startedAt) / 1e3);
			frame = requestAnimationFrame(loop);
		};
		const draw = () => {
			cancelAnimationFrame(frame);
			const current = stateRef.current;
			const style = getStyle(current.styleId);
			if (current.animate && style.motion && document.visibilityState !== "hidden") frame = requestAnimationFrame(loop);
			else paint(0);
		};
		drawRef.current = draw;
		const onResize = () => draw();
		const observer = new ResizeObserver(onResize);
		observer.observe(canvas);
		document.addEventListener("visibilitychange", draw);
		let index = 0;
		let queue = STYLES.slice();
		const pending = {};
		const problems = {};
		let pumpTimer = 0;
		let generation = 0;
		const orderQueue = () => {
			queue = STYLES.slice();
			const currentAt = queue.findIndex((item) => item.id === stateRef.current.styleId);
			if (currentAt > 0) {
				const current = queue[currentAt];
				if (current) {
					queue.splice(currentAt, 1);
					queue.unshift(current);
				}
			}
		};
		const flush = (done) => {
			const thumbKeys = Object.keys(pending);
			if (thumbKeys.length) {
				const batch = { ...pending };
				for (const key of thumbKeys) delete pending[key];
				setThumbs((prev) => ({
					...prev,
					...batch
				}));
			}
			const problemKeys = Object.keys(problems);
			if (problemKeys.length) {
				const batch = { ...problems };
				for (const key of problemKeys) delete problems[key];
				setShaderErrors((prev) => ({
					...prev,
					...batch
				}));
			}
			setFired(done);
		};
		const step = () => {
			if (!alive) return;
			const gen = generation;
			if (document.visibilityState === "hidden") {
				pumpTimer = window.setTimeout(step, 500);
				return;
			}
			const style = queue[index];
			if (!style) {
				flush(index);
				return;
			}
			index += 1;
			const current = stateRef.current;
			const key = `${style.id}:${current.look}:${current.pixels}`;
			const url = mill.thumbnail(util, style, thumbParams(style.id, current.pixels, lookValue(current.look)), key);
			if (gen !== generation) return;
			if (url) pending[style.id] = url;
			const message = mill.error(style.id);
			if (message) problems[style.id] = message;
			if (index === queue.length || index % 4 === 0) flush(index);
			if (index < queue.length) pumpTimer = window.setTimeout(step, index < 8 ? 16 : 48);
		};
		const restart = () => {
			generation += 1;
			index = 0;
			for (const key of Object.keys(pending)) delete pending[key];
			for (const key of Object.keys(problems)) delete problems[key];
			orderQueue();
			mill.clearThumbs();
			window.clearTimeout(pumpTimer);
			pumpTimer = window.setTimeout(step, 32);
		};
		restartRef.current = restart;
		draw();
		return () => {
			alive = false;
			window.clearTimeout(pumpTimer);
			cancelAnimationFrame(frame);
			observer.disconnect();
			document.removeEventListener("visibilitychange", draw);
			mill.dispose();
			millRef.current = null;
			restartRef.current = () => {};
		};
	}, []);
	(0, import_react.useEffect)(() => {
		setState(loadState());
		setHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		setThumbs({});
		setFired(0);
		restartRef.current();
	}, [
		hydrated,
		state.look,
		state.pixels
	]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		drawRef.current?.();
	}, [
		hydrated,
		state.styleId,
		state.seed,
		state.scale,
		state.pixels,
		state.wear,
		state.repeat,
		state.animate,
		state.paletteId,
		state.look
	]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		const { query: _query, ...rest } = state;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
	}, [hydrated, state]);
	const style = getStyle(state.styleId);
	const colors = resolvePalette(style, state.paletteId);
	const visible = (0, import_react.useMemo)(() => {
		const q = state.query.trim().toLowerCase();
		return STYLES.filter((item) => {
			if (state.category === "Kept" && !state.favorites.includes(item.id)) return false;
			if (state.category !== "All" && state.category !== "Kept" && item.category !== state.category) return false;
			if (!q) return true;
			return item.name.toLowerCase().includes(q) || item.id.includes(q) || item.category.toLowerCase().includes(q) || item.blurb.toLowerCase().includes(q) || (item.preset?.includes(q) ?? false);
		});
	}, [
		state.category,
		state.favorites,
		state.query
	]);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
			if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
			const list = visible.length ? visible : STYLES;
			const current = Math.max(0, list.findIndex((item) => item.id === stateRef.current.styleId));
			const next = event.key === "ArrowRight" ? list[(current + 1) % list.length] : list[(current - 1 + list.length) % list.length];
			if (!next) return;
			event.preventDefault();
			setState((prev) => ({
				...prev,
				styleId: next.id
			}));
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [visible]);
	(0, import_react.useEffect)(() => {
		selectedRef.current?.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
	}, [
		state.styleId,
		state.category,
		visible.length
	]);
	(0, import_react.useEffect)(() => {
		if (!mixOpen) return;
		const onKey = (event) => {
			if (event.key === "Escape") setMixOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mixOpen]);
	const recipe = recipeText(style, {
		seed: state.seed,
		scale: state.scale,
		pixels: state.pixels,
		wear: state.wear,
		paletteId: state.paletteId,
		look: state.look,
		colors
	});
	const patch = (partial) => setState((prev) => ({
		...prev,
		...partial
	}));
	const runJudge = async () => {
		setJudgeOpen(true);
		setMixOpen(false);
		setJudgeBusy(true);
		setJudgeRows([]);
		const display = document.createElement("canvas");
		const util = document.createElement("canvas");
		const mill = new ShaderMill(display, util);
		const read = document.createElement("canvas");
		read.width = 96;
		read.height = 96;
		const ctx = read.getContext("2d", { willReadFrequently: true });
		if (!ctx) {
			mill.dispose();
			setJudgeBusy(false);
			return;
		}
		const samples = /* @__PURE__ */ new Map();
		for (const ref of JUDGE_REFS) {
			const img = new Image();
			img.src = ref.file;
			await img.decode();
			ctx.clearRect(0, 0, 96, 96);
			ctx.drawImage(img, 0, 0, 96, 96);
			samples.set(ref.id, readFeatures(ctx.getImageData(0, 0, 96, 96).data, 96, 96));
		}
		const rows = [];
		for (const style of STYLES) {
			const ref = refForStyle(style.id);
			util.width = 96;
			util.height = 96;
			const colors = style.palette.map(hexToRgb);
			const ok = mill.drawUtil(util, style, {
				seed: 7,
				scale: 1,
				pixels: 0,
				wear: .08,
				repeat: 1,
				time: 0,
				look: 2,
				colors
			});
			ctx.clearRect(0, 0, 96, 96);
			if (ok) ctx.drawImage(util, 0, 0, 96, 96);
			const data = ctx.getImageData(0, 0, 96, 96).data;
			const sample = readFeatures(data, 96, 96);
			const seam = ok ? seamError(data, 96, 96) : 1;
			const refSample = ref ? samples.get(ref.id) : void 0;
			const match = refSample ? matchScore(sample, refSample) : null;
			const result = verdict(seam, match, sample.std < 6, ok);
			rows.push({
				id: style.id,
				name: style.name,
				ref: ref?.label ?? "—",
				seam,
				match,
				pass: result.pass,
				reason: result.reason
			});
			setJudgeRows(rows.slice());
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		mill.dispose();
		for (const canvas of [display, util]) canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
		setJudgeBusy(false);
	};
	const fileBase = `grout-${style.id}-s${state.seed}-${state.pixels || "smooth"}`;
	const grabTile = (seed) => {
		const mill = millRef.current;
		const util = utilRef.current;
		if (!mill || !util) return false;
		util.width = state.exportSize;
		util.height = state.exportSize;
		return mill.drawUtil(util, style, {
			...paramsFor(state, 0),
			seed,
			repeat: 1
		});
	};
	const exportPng = () => {
		const util = utilRef.current;
		if (!util || !grabTile(state.seed)) {
			setStatus("Could not render that tile.");
			return;
		}
		const shot = snapshot(util);
		if (!shot) {
			setStatus("Could not render that tile.");
			return;
		}
		shot.toBlob((blob) => {
			if (!blob) return;
			downloadBlob(blob, `${fileBase}.png`);
			setStatus("Tile saved");
		}, "image/png");
	};
	const exportAtlas = () => {
		const util = utilRef.current;
		if (!util) return;
		const size = state.exportSize;
		const atlas = document.createElement("canvas");
		atlas.width = size * 2;
		atlas.height = size * 2;
		const ctx = atlas.getContext("2d");
		if (!ctx) return;
		const seeds = [
			state.seed,
			state.seed + 11,
			state.seed + 29,
			state.seed + 47
		];
		for (let i = 0; i < seeds.length; i += 1) {
			const seed = seeds[i];
			if (seed === void 0 || !grabTile(seed)) {
				setStatus("Could not render the atlas.");
				return;
			}
			ctx.drawImage(util, i % 2 * size, Math.floor(i / 2) * size, size, size);
		}
		atlas.toBlob((blob) => {
			if (!blob) return;
			downloadBlob(blob, `${fileBase}-atlas.png`);
			setStatus("Atlas saved");
		}, "image/png");
	};
	const exportCatalog = async () => {
		if (catalogBusy.current) return;
		catalogBusy.current = true;
		setStatus("Rendering catalog…");
		const display = document.createElement("canvas");
		const util = document.createElement("canvas");
		const mill = new ShaderMill(display, util);
		const size = state.exportSize;
		const files = [];
		try {
			for (const item of STYLES) {
				util.width = size;
				util.height = size;
				const params = paramsFor({
					...state,
					styleId: item.id
				}, 0);
				params.repeat = 1;
				if (!mill.drawUtil(util, item, params)) continue;
				const shot = snapshot(util);
				const data = shot ? await canvasPng(shot) : null;
				if (!data) continue;
				files.push({
					name: `${item.category.toLowerCase()}/${item.id}.png`,
					data
				});
				if (files.length % 6 === 0) setStatus(`Catalog ${files.length} / ${STYLES.length}`);
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		} finally {
			mill.dispose();
			for (const canvas of [display, util]) canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
			catalogBusy.current = false;
		}
		if (!files.length) {
			setStatus("Could not render the catalog.");
			return;
		}
		downloadBlob(zipStore(files), `grout-catalog-${state.pixels || "smooth"}-${state.look}.zip`);
		setStatus(`Catalog saved, ${files.length} PNGs`);
	};
	const kept = state.favorites.includes(style.id);
	const activeError = shaderErrors[style.id] ?? glError;
	const chunky = state.pixels > 0 || state.look === "pixel";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "bench",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "top",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "id",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mark",
						children: fired > 0 && fired < STYLE_COUNT ? `Firing ${fired} / ${STYLE_COUNT}` : style.preset ? "Reviewed" : style.category
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: style.name })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "top-actions",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-expanded": judgeOpen,
							onClick: () => judgeOpen ? setJudgeOpen(false) : void runJudge(),
							children: judgeBusy ? "Judging" : "Judge"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-expanded": mixOpen,
							onClick: () => setMixOpen((open) => !open),
							children: "Adjust"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "primary",
							onClick: exportPng,
							children: "Save"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "stage",
				"aria-label": "Texture preview",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: displayRef,
					className: chunky ? "pixelated" : void 0,
					"aria-label": `${style.name} texture preview`
				}), glError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "stage-error",
					children: glError
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "finder",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "rack-search",
						type: "search",
						value: state.query,
						onChange: (event) => patch({ query: event.target.value }),
						placeholder: "Search textures",
						"aria-label": "Search styles"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "cats",
						role: "tablist",
						"aria-label": "Categories",
						children: [
							"All",
							"Kept",
							...CATEGORIES
						].map((category) => {
							const on = state.category === category;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": on,
								onClick: () => patch({ category }),
								className: "cat",
								children: category
							}, category);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "looks",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "cat-set",
							role: "radiogroup",
							"aria-label": "Look",
							children: LOOKS.map((look) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								role: "radio",
								"aria-checked": state.look === look.id,
								className: "cat",
								onClick: () => patch({
									look: look.id,
									pixels: look.id === "pixel" ? state.pixels || 32 : 0
								}),
								children: look.label
							}, look.id))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "cat-set",
							role: "radiogroup",
							"aria-label": "Size",
							children: SIZES.map((size) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								role: "radio",
								"aria-checked": state.pixels === size.value,
								className: "cat",
								onClick: () => patch({ pixels: size.value }),
								children: size.label
							}, size.value))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid-scroll",
				children: visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "recipe-empty",
					children: "Nothing matches."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "tile-grid",
					children: visible.map((item) => {
						const selected = item.id === style.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							ref: selected ? selectedRef : void 0,
							"aria-pressed": selected,
							"aria-label": item.name,
							onClick: () => patch({ styleId: item.id }),
							className: "tile",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tile-face",
								children: thumbs[item.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: thumbs[item.id],
									alt: "",
									className: chunky ? "pixelated" : void 0
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tile-fallback",
									"aria-hidden": "true",
									children: item.palette.map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: color } }, color))
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tile-name",
								children: item.name
							})]
						}) }, item.id);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: utilRef,
				className: "util-canvas",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "judge",
				"data-open": judgeOpen,
				inert: !judgeOpen,
				"aria-label": "Reference judge",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "judge-head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Reference judge" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setJudgeOpen(false),
							children: "Close"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "lede",
						children: "Each scored texture is compared with a generated seamless tile of the same material. A pass means it tiles and sits close to that tile."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "judge-sum",
						"data-judge-sum": "true",
						children: judgeRows ? `${judgeRows.filter((row) => row.pass).length} pass / ${judgeRows.filter((row) => row.reason !== "no reference").length} scored${judgeBusy ? "…" : ""}` : "Running…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "judge-list",
						children: (judgeRows ?? []).filter((row) => row.reason !== "no reference").map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "judge-row",
							"data-pass": row.pass,
							"data-judge-row": row.id,
							"data-seam": row.seam.toFixed(3),
							"data-match": row.match === null ? "" : row.match.toFixed(3),
							"data-reason": row.reason,
							onClick: () => {
								patch({
									styleId: row.id,
									look: "real",
									pixels: 0
								});
								setJudgeOpen(false);
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.name }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "judge-ref",
									children: row.ref
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.match === null ? "—" : row.match.toFixed(2) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.pass ? "Pass" : row.reason })
							]
						}) }, row.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "details",
				"data-open": mixOpen,
				inert: !mixOpen,
				"aria-label": "Adjust texture",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: style.name }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "lede",
						children: style.blurb
					}),
					activeError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "shader-fault",
						children: activeError
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "fields",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: ["Seed", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										inputMode: "numeric",
										min: 0,
										max: 999999,
										value: state.seed,
										"aria-label": "Seed",
										onChange: (event) => patch({ seed: clamp(Math.round(Number(event.target.value) || 0), 0, 999999) })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ghost",
										onClick: () => patch({ seed: Math.floor(Math.random() * 1e5) }),
										children: "Random"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Repeat",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									"aria-label": "Seam check",
									value: state.repeat,
									onChange: (event) => patch({ repeat: Number(event.target.value) }),
									children: REPEAT_CHOICES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value,
										children: [value, "×"]
									}, value))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Scale",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									"aria-label": "Motif scale",
									value: state.scale,
									onChange: (event) => patch({ scale: Number(event.target.value) }),
									children: SCALE_CHOICES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value,
										children: [value, "×"]
									}, value))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: ["Wear", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: 1,
									step: .01,
									value: state.wear,
									"aria-label": "Wear",
									"aria-valuetext": state.wear.toFixed(2),
									onChange: (event) => patch({ wear: Number(event.target.value) })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Export",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									"aria-label": "Export size",
									value: state.exportSize,
									onChange: (event) => patch({ exportSize: Number(event.target.value) }),
									children: EXPORT_CHOICES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value,
										children: [value, " px"]
									}, value))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "palette-row",
								role: "radiogroup",
								"aria-label": "Palette",
								children: PALETTES.map((palette) => {
									const swatch = palette.colors ?? style.palette;
									const on = state.paletteId === palette.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										role: "radio",
										"aria-label": palette.name,
										"aria-checked": on,
										onClick: () => patch({ paletteId: palette.id }),
										className: "palette-chip",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "swatches",
											"aria-hidden": "true",
											children: swatch.map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { background: color } }, color))
										})
									}, palette.id);
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "links",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-pressed": state.animate,
								onClick: () => patch({ animate: !state.animate }),
								children: ["Drift ", state.animate ? "on" : "off"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": kept,
								onClick: () => patch({ favorites: kept ? state.favorites.filter((id) => id !== style.id) : [...state.favorites, style.id] }),
								children: kept ? "Kept" : "Keep"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: exportAtlas,
								children: "2×2 atlas"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void exportCatalog(),
								children: "PNG catalog"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									copyText(recipe).then((ok) => setStatus(ok ? "Recipe copied" : "Copy failed — select the recipe below"));
								},
								children: "Copy recipe"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									copyText(glslText(style, {
										seed: state.seed,
										scale: state.scale,
										pixels: state.pixels,
										wear: state.wear,
										paletteId: state.paletteId,
										look: state.look,
										colors
									})).then((ok) => setStatus(ok ? "GLSL copied" : "Copy failed"));
								},
								children: "Copy GLSL"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "drawer-status",
						children: status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: recipe }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "done",
						onClick: () => setMixOpen(false),
						children: "Done"
					})
				]
			})
		]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "field",
		children: [label, children]
	});
}
var SplitComponent = MillApp;
//#endregion
export { SplitComponent as component };
